"""
Tests for app/core/datetime_utils.py and app/core/config.py
"""
import os
import pytest
from datetime import datetime, date, timezone

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")


class TestToUtcIsoformat:

    def test_naive_datetime_gets_z_suffix(self):
        """Naive datetime gets 'Z' appended."""
        from app.core.datetime_utils import to_utc_isoformat
        dt = datetime(2025, 6, 15, 10, 30, 0)
        result = to_utc_isoformat(dt)
        assert result.endswith("Z")
        assert result.startswith("2025-06-15T10:30:00")

    def test_date_object_returns_iso_date_only(self):
        """date object returns just the date string, no 'Z'."""
        from app.core.datetime_utils import to_utc_isoformat
        d = date(2025, 6, 15)
        result = to_utc_isoformat(d)
        assert result == "2025-06-15"
        assert "T" not in result

    def test_timezone_aware_datetime_converts_to_utc(self):
        """Timezone-aware datetime is converted to UTC before formatting."""
        from app.core.datetime_utils import to_utc_isoformat
        # UTC+5 datetime: 2025-06-15 15:00 +05:00 → UTC: 2025-06-15 10:00
        from datetime import timezone as tz
        import datetime as dt_module
        utc_plus5 = tz(dt_module.timedelta(hours=5))
        aware_dt = datetime(2025, 6, 15, 15, 0, 0, tzinfo=utc_plus5)
        result = to_utc_isoformat(aware_dt)
        assert result == "2025-06-15T10:00:00Z"

    def test_none_returns_none(self):
        """None returns None."""
        from app.core.datetime_utils import to_utc_isoformat
        assert to_utc_isoformat(None) is None

    def test_utcnow_returns_naive_datetime(self):
        """utcnow() returns a naive datetime with no tzinfo."""
        from app.core.datetime_utils import utcnow
        now = utcnow()
        assert isinstance(now, datetime)
        assert now.tzinfo is None


class TestConfigSettings:

    def test_is_production_returns_true_when_production(self):
        """is_production property returns True for production environment."""
        from app.core.config import Settings
        s = Settings(
            supabase_url="http://localhost",
            supabase_anon_key="key",
            supabase_service_role_key="key",
            database_url="sqlite:///:memory:",
            environment="production",
        )
        assert s.is_production is True

    def test_is_production_returns_false_for_development(self):
        """is_production returns False for development."""
        from app.core.config import Settings
        s = Settings(
            supabase_url="http://localhost",
            supabase_anon_key="key",
            supabase_service_role_key="key",
            database_url="sqlite:///:memory:",
            environment="development",
        )
        assert s.is_production is False

    def test_invalid_environment_raises_error(self):
        """Invalid environment value raises ValueError."""
        from app.core.config import Settings
        from pydantic import ValidationError
        with pytest.raises((ValidationError, ValueError)):
            Settings(
                supabase_url="http://localhost",
                supabase_anon_key="key",
                supabase_service_role_key="key",
                database_url="sqlite:///:memory:",
                environment="invalid_env",
            )

    def test_cors_origins_string_splits_to_list(self):
        """cors_origins_list splits comma-separated string."""
        from app.core.config import Settings
        s = Settings(
            supabase_url="http://localhost",
            supabase_anon_key="key",
            supabase_service_role_key="key",
            database_url="sqlite:///:memory:",
            cors_origins="http://localhost:3000,http://localhost:3001",
        )
        result = s.cors_origins_list
        assert "http://localhost:3000" in result
        assert "http://localhost:3001" in result
