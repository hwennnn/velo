"""
Tests for app/core/currencies.py

Covers:
- get_currency_info: valid, invalid
- is_supported_currency: true/false cases
- get_currency_symbol, get_currency_name helpers
- CURRENCY_CODES and CURRENCY_MAP constants
"""

import os
import pytest

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.core.currencies import (
    get_currency_info,
    is_supported_currency,
    get_currency_symbol,
    get_currency_name,
    SUPPORTED_CURRENCIES,
    CURRENCY_CODES,
    CURRENCY_MAP,
    DEFAULT_CURRENCY,
)


class TestIsSupportedCurrency:
    def test_usd_is_supported(self):
        assert is_supported_currency("USD") is True

    def test_eur_is_supported(self):
        assert is_supported_currency("EUR") is True

    def test_gbp_is_supported(self):
        assert is_supported_currency("GBP") is True

    def test_jpy_is_supported(self):
        assert is_supported_currency("JPY") is True

    def test_cad_is_supported(self):
        assert is_supported_currency("CAD") is True

    def test_aud_is_supported(self):
        assert is_supported_currency("AUD") is True

    def test_unsupported_currency_false(self):
        assert is_supported_currency("XYZ") is False

    def test_empty_string_false(self):
        assert is_supported_currency("") is False

    def test_lowercase_usd_supported(self):
        """Case-insensitive check: lowercase should still work."""
        assert is_supported_currency("usd") is True

    def test_mixed_case_supported(self):
        assert is_supported_currency("Eur") is True

    def test_invalid_code_abc_false(self):
        assert is_supported_currency("ABC") is False

    def test_numeric_code_false(self):
        assert is_supported_currency("123") is False


class TestGetCurrencyInfo:
    def test_usd_info(self):
        info = get_currency_info("USD")
        assert info.code == "USD"
        assert info.symbol == "$"
        assert "Dollar" in info.name

    def test_eur_info(self):
        info = get_currency_info("EUR")
        assert info.code == "EUR"
        assert info.symbol == "€"
        assert "Euro" in info.name

    def test_gbp_info(self):
        info = get_currency_info("GBP")
        assert info.code == "GBP"
        assert info.symbol == "£"

    def test_jpy_info(self):
        info = get_currency_info("JPY")
        assert info.code == "JPY"

    def test_lowercase_lookup_works(self):
        """get_currency_info should handle lowercase."""
        info = get_currency_info("usd")
        assert info.code == "USD"

    def test_unsupported_raises_value_error(self):
        with pytest.raises(ValueError, match="Unsupported currency"):
            get_currency_info("XYZ")

    def test_all_supported_currencies_retrievable(self):
        """All currencies in SUPPORTED_CURRENCIES should be retrievable."""
        for curr in SUPPORTED_CURRENCIES:
            info = get_currency_info(curr.code)
            assert info.code == curr.code


class TestGetCurrencySymbol:
    def test_usd_symbol(self):
        assert get_currency_symbol("USD") == "$"

    def test_eur_symbol(self):
        assert get_currency_symbol("EUR") == "€"

    def test_gbp_symbol(self):
        assert get_currency_symbol("GBP") == "£"

    def test_unsupported_raises(self):
        with pytest.raises(ValueError):
            get_currency_symbol("XYZ")


class TestGetCurrencyName:
    def test_usd_name(self):
        assert "Dollar" in get_currency_name("USD")

    def test_eur_name(self):
        assert "Euro" in get_currency_name("EUR")

    def test_unsupported_raises(self):
        with pytest.raises(ValueError):
            get_currency_name("XYZ")


class TestCurrencyConstants:
    def test_currency_codes_not_empty(self):
        assert len(CURRENCY_CODES) > 0

    def test_currency_map_keys_match_codes(self):
        assert set(CURRENCY_MAP.keys()) == set(CURRENCY_CODES)

    def test_default_currency_is_usd(self):
        assert DEFAULT_CURRENCY == "USD"

    def test_supported_currencies_at_least_5(self):
        """We should support at least USD, EUR, GBP, JPY, CAD."""
        assert len(SUPPORTED_CURRENCIES) >= 5

    def test_currency_map_has_usd(self):
        assert "USD" in CURRENCY_MAP

    def test_all_currencies_have_code_symbol_name(self):
        for curr in SUPPORTED_CURRENCIES:
            assert curr.code
            assert curr.symbol
            assert curr.name
