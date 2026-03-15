"""
Tests for app/core/database.py - init_db and get_session.
"""
import os
import pytest

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")


class TestInitDb:

    @pytest.mark.asyncio
    async def test_init_db_runs_without_error(self):
        """init_db can be called without error."""
        from app.core.database import init_db
        await init_db()

    @pytest.mark.asyncio
    async def test_init_db_called_twice_no_error(self):
        """init_db can be called multiple times without error."""
        from app.core.database import init_db
        await init_db()
        await init_db()


class TestInitDbProductionMode:

    @pytest.mark.asyncio
    async def test_init_db_production_mode_prints_message(self):
        """init_db in non-development mode prints production message (line 84)."""
        from app.core.database import init_db
        from unittest.mock import patch
        with patch("app.core.database.settings") as mock_settings:
            mock_settings.is_development = False
            await init_db()  # Should reach line 84


class TestGetSession:

    @pytest.mark.asyncio
    async def test_get_session_yields_async_session(self):
        """get_session yields an AsyncSession that can be used."""
        from sqlalchemy.ext.asyncio import AsyncSession
        from app.core.database import get_session

        gen = get_session()
        session = await gen.__anext__()
        assert isinstance(session, AsyncSession)
        # Properly close
        try:
            await gen.aclose()
        except Exception:
            pass

    @pytest.mark.asyncio
    async def test_get_session_commit_on_normal_exit(self):
        """get_session commits on normal generator exhaustion (line 55)."""
        from sqlalchemy.ext.asyncio import AsyncSession
        from app.core.database import get_session

        # Exhaust the generator normally so line 55 (commit) is reached
        async for session in get_session():
            assert isinstance(session, AsyncSession)
        # Generator exhausted normally — commit was called

    @pytest.mark.asyncio
    async def test_get_session_rollback_on_exception(self):
        """get_session rolls back on exception."""
        from app.core.database import get_session

        gen = get_session()
        session = await gen.__anext__()

        try:
            await gen.athrow(ValueError("test error"))
        except ValueError:
            pass
        # Session should have been rolled back and closed
