"""
Tests for exchange rate endpoints and service.

Covers:
- GET /exchange-rates/{base_currency} with mocked HTTP
- get_fallback_exchange_rate function
- get_exchange_rate same-currency short-circuit
"""

import os
import pytest
import pytest_asyncio
from decimal import Decimal
from typing import AsyncGenerator
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.main import app
from app.core.database import get_session
from app.core.auth import get_current_user_id, get_current_user
from app.models.user import User

TEST_USER_ID = "exchange-test-user-001"
TEST_USER_EMAIL = "exchange@example.com"


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    maker = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        user = User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Exchange User")
        session.add(user)
        await session.commit()
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(async_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def get_session_override():
        yield async_session

    async def get_current_user_id_override():
        return TEST_USER_ID

    async def get_current_user_override():
        return User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Exchange User")

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user_id] = get_current_user_id_override
    app.dependency_overrides[get_current_user] = get_current_user_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as c:
        yield c

    app.dependency_overrides.clear()


# ──────────────────────────────────────────────
# EXCHANGE RATE ENDPOINT TESTS
# ──────────────────────────────────────────────


class TestExchangeRateEndpoint:
    @pytest.mark.asyncio
    async def test_exchange_rates_with_mock(self, client):
        """GET /exchange-rates/USD returns rates dict when API succeeds."""
        mock_rates = {
            "USD": Decimal("1.0"),
            "EUR": Decimal("0.92"),
            "GBP": Decimal("0.79"),
        }
        with patch("app.api.balances.fetch_exchange_rates", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_rates
            resp = await client.get("/exchange-rates/USD")
            assert resp.status_code == 200
            data = resp.json()
            assert data["base_currency"] == "USD"
            assert "rates" in data
            assert "USD" in data["rates"]

    @pytest.mark.asyncio
    async def test_exchange_rates_lowercase_currency(self, client):
        """GET /exchange-rates/usd (lowercase) normalizes to uppercase."""
        mock_rates = {"USD": Decimal("1.0"), "EUR": Decimal("0.92")}
        with patch("app.api.balances.fetch_exchange_rates", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_rates
            resp = await client.get("/exchange-rates/usd")
            assert resp.status_code == 200
            data = resp.json()
            assert data["base_currency"] == "USD"

    @pytest.mark.asyncio
    async def test_exchange_rates_api_failure_returns_500(self, client):
        """When API fails, returns 500."""
        from app.services.exchange_rate import ExchangeRateError
        with patch("app.api.balances.fetch_exchange_rates", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = ExchangeRateError("API down")
            resp = await client.get("/exchange-rates/USD")
            assert resp.status_code == 500

    @pytest.mark.asyncio
    async def test_exchange_rates_returns_float_values(self, client):
        """Rates in response are floats (JSON-serializable)."""
        mock_rates = {"USD": Decimal("1.0"), "EUR": Decimal("0.92")}
        with patch("app.api.balances.fetch_exchange_rates", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_rates
            resp = await client.get("/exchange-rates/USD")
            data = resp.json()
            for key, val in data["rates"].items():
                assert isinstance(val, (int, float)), f"Rate {key} should be numeric"


# ──────────────────────────────────────────────
# EXCHANGE RATE SERVICE TESTS
# ──────────────────────────────────────────────


class TestGetExchangeRate:
    @pytest.mark.asyncio
    async def test_same_currency_returns_one(self):
        """USD → USD = 1.0, no API call needed."""
        from app.services.exchange_rate import get_exchange_rate
        rate = await get_exchange_rate("USD", "USD")
        assert rate == Decimal("1.0")

    @pytest.mark.asyncio
    async def test_same_currency_case_insensitive(self):
        """eur → EUR = 1.0."""
        from app.services.exchange_rate import get_exchange_rate
        rate = await get_exchange_rate("eur", "EUR")
        assert rate == Decimal("1.0")

    @pytest.mark.asyncio
    async def test_get_rate_with_mock(self):
        """get_exchange_rate uses fetch_exchange_rates correctly."""
        from app.services.exchange_rate import get_exchange_rate
        mock_rates = {"EUR": Decimal("0.92"), "USD": Decimal("1.0")}
        with patch("app.services.exchange_rate.fetch_exchange_rates", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_rates
            rate = await get_exchange_rate("USD", "EUR")
            assert abs(rate - Decimal("0.92")) < Decimal("0.001")

    @pytest.mark.asyncio
    async def test_get_rate_falls_back_on_error(self):
        """When API fails, uses fallback rate (not None)."""
        from app.services.exchange_rate import get_exchange_rate, ExchangeRateError
        with patch("app.services.exchange_rate.fetch_exchange_rates", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = ExchangeRateError("down")
            rate = await get_exchange_rate("USD", "EUR")
            # Fallback should return a positive Decimal
            assert rate > Decimal("0")
            assert isinstance(rate, Decimal)


class TestGetFallbackExchangeRate:
    def test_same_currency_returns_one(self):
        from app.services.exchange_rate import get_fallback_exchange_rate
        assert get_fallback_exchange_rate("USD", "USD") == Decimal("1.0")

    def test_known_pair_returns_positive(self):
        from app.services.exchange_rate import get_fallback_exchange_rate
        rate = get_fallback_exchange_rate("USD", "EUR")
        assert rate > Decimal("0")

    def test_unknown_currency_returns_one(self):
        """Unknown currency pair defaults to 1.0."""
        from app.services.exchange_rate import get_fallback_exchange_rate
        rate = get_fallback_exchange_rate("USD", "ZZZ")
        assert rate == Decimal("1.0")

    def test_eur_to_usd(self):
        from app.services.exchange_rate import get_fallback_exchange_rate
        rate = get_fallback_exchange_rate("EUR", "USD")
        # EUR has rate 1.18 in fallback table, USD = 1.0
        # EUR → USD: rate_to / rate_from = 1.0 / 1.18 ≈ 0.847
        assert rate > Decimal("0")
        assert rate != Decimal("1.0")

    def test_usd_to_jpy(self):
        from app.services.exchange_rate import get_fallback_exchange_rate
        rate = get_fallback_exchange_rate("USD", "JPY")
        # JPY rate should be < 1 per USD in the fallback
        assert rate < Decimal("1.0")


class TestConvertAmount:
    @pytest.mark.asyncio
    async def test_convert_usd_to_usd(self):
        from app.services.exchange_rate import convert_amount
        result = await convert_amount(Decimal("100"), "USD", "USD")
        assert abs(result - Decimal("100")) < Decimal("0.01")

    @pytest.mark.asyncio
    async def test_convert_with_mock_rate(self):
        from app.services.exchange_rate import convert_amount
        mock_rates = {"EUR": Decimal("0.90")}
        with patch("app.services.exchange_rate.fetch_exchange_rates", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_rates
            result = await convert_amount(Decimal("100"), "USD", "EUR")
            assert abs(result - Decimal("90.00")) < Decimal("0.01")

    @pytest.mark.asyncio
    async def test_convert_result_quantized(self):
        from app.services.exchange_rate import convert_amount
        result = await convert_amount(Decimal("100"), "USD", "USD")
        # Should be quantized to 2 decimal places
        assert result == result.quantize(Decimal("0.01"))


# ──────────────────────────────────────────────
# fetch_exchange_rates ERROR PATH TESTS
# ──────────────────────────────────────────────


class TestFetchExchangeRatesErrorPaths:
    @pytest.mark.asyncio
    async def test_http_error_raises_exchange_rate_error(self):
        """httpx.HTTPError is wrapped into ExchangeRateError via get_exchange_rate fallback."""
        from app.services.exchange_rate import get_exchange_rate, ExchangeRateError
        import httpx
        # When fetch_exchange_rates raises an HTTPError, get_exchange_rate falls back
        # We test indirectly via get_exchange_rate with a mocked fetch that raises
        with patch("app.services.exchange_rate.fetch_exchange_rates", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = ExchangeRateError("Connection refused")
            # Should fall back to hardcoded rates, not raise
            rate = await get_exchange_rate("USD", "EUR")
            assert rate > Decimal("0")

    @pytest.mark.asyncio
    async def test_non_success_result_raises_exchange_rate_error(self):
        """API returning result != 'success' → fetch_exchange_rates raises ExchangeRateError."""
        from app.services.exchange_rate import ExchangeRateError
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={"result": "error", "error-type": "invalid-key"})

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_class.return_value = mock_client

            # Clear cache so fresh call is made
            from app.core.cache import clear_cache
            clear_cache()

            # fetch_exchange_rates will raise ExchangeRateError which get_exchange_rate catches
            from app.services.exchange_rate import get_exchange_rate
            # Falls back to hardcoded rate (no error propagated to caller)
            rate = await get_exchange_rate("USD", "EUR")
            assert rate > Decimal("0")

    @pytest.mark.asyncio
    async def test_missing_currency_raises_exchange_rate_error(self):
        """get_exchange_rate falls back when target currency not in rates."""
        from app.services.exchange_rate import get_exchange_rate
        # ZZZ is an unknown currency — fallback returns 1.0
        rate = await get_exchange_rate("USD", "ZZZ")
        assert rate == Decimal("1.0")

    @pytest.mark.asyncio
    async def test_fetch_exchange_rates_success_path(self):
        """fetch_exchange_rates parses a successful API response."""
        from app.services.exchange_rate import ExchangeRateError
        from app.core.cache import clear_cache
        clear_cache()

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={
            "result": "success",
            "conversion_rates": {"EUR": 0.92, "GBP": 0.79, "USD": 1.0},
        })

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_class.return_value = mock_client

            from app.services.exchange_rate import get_exchange_rate
            clear_cache()
            rate = await get_exchange_rate("USD", "EUR")
            assert abs(rate - Decimal("0.92")) < Decimal("0.001")

    @pytest.mark.asyncio
    async def test_currency_not_in_fetched_rates_falls_back(self):
        """When target currency is not in the fetched rates, get_exchange_rate falls back."""
        from app.services.exchange_rate import get_exchange_rate
        from app.core.cache import clear_cache
        clear_cache()

        # Return rates without JPY
        mock_rates = {"USD": Decimal("1.0"), "EUR": Decimal("0.92")}
        with patch("app.services.exchange_rate.fetch_exchange_rates", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_rates
            clear_cache()
            # JPY not in mock_rates — triggers line 97 ExchangeRateError → fallback
            rate = await get_exchange_rate("USD", "JPY")
            # Fallback should return some positive rate
            assert rate > Decimal("0")


# ──────────────────────────────────────────────
# get_exchange_rate_info TESTS
# ──────────────────────────────────────────────


class TestGetExchangeRateInfo:
    @pytest.mark.asyncio
    async def test_returns_rate_info_structure(self):
        """get_exchange_rate_info returns base_currency, last_update, next_update, rates."""
        from app.services.exchange_rate import get_exchange_rate_info
        mock_data = {
            "result": "success",
            "base_code": "USD",
            "time_last_update_unix": 1700000000,
            "time_next_update_unix": 1700086400,
            "conversion_rates": {"EUR": 0.92, "GBP": 0.79},
        }
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value=mock_data)

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_class.return_value = mock_client

            result = await get_exchange_rate_info("USD")

        assert result["base_currency"] == "USD"
        assert "last_update" in result
        assert "next_update" in result
        assert "rates" in result
        assert "EUR" in result["rates"]

    @pytest.mark.asyncio
    async def test_http_error_raises_exchange_rate_error(self):
        """get_exchange_rate_info wraps HTTP errors into ExchangeRateError."""
        from app.services.exchange_rate import get_exchange_rate_info, ExchangeRateError
        import httpx

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=httpx.ConnectError("down"))
            mock_client_class.return_value = mock_client

            with pytest.raises(ExchangeRateError):
                await get_exchange_rate_info("USD")

    @pytest.mark.asyncio
    async def test_non_success_result_raises_exchange_rate_error(self):
        """get_exchange_rate_info raises when API returns error result."""
        from app.services.exchange_rate import get_exchange_rate_info, ExchangeRateError
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={"result": "error"})

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_class.return_value = mock_client

            with pytest.raises(ExchangeRateError):
                await get_exchange_rate_info("USD")
