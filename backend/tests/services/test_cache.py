"""
Unit tests for app/core/cache.py

Tests the TTLCache class and cached decorator.
"""

import os
import pytest
import asyncio
import time

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.core.cache import TTLCache, CacheEntry, cached, clear_cache, cleanup_expired_cache


class TestCacheEntry:
    def test_not_expired_fresh(self):
        entry = CacheEntry(value="test", expires_at=time.time() + 100)
        assert entry.is_expired() is False

    def test_expired(self):
        entry = CacheEntry(value="test", expires_at=time.time() - 1)
        assert entry.is_expired() is True

    def test_value_stored(self):
        entry = CacheEntry(value={"key": "value"}, expires_at=time.time() + 100)
        assert entry.value == {"key": "value"}


class TestTTLCache:
    def test_set_and_get(self):
        cache = TTLCache()
        cache.set(("key",), "value", 100)
        result = cache.get(("key",))
        assert result == "value"

    def test_get_missing_key_returns_none(self):
        cache = TTLCache()
        result = cache.get(("nonexistent",))
        assert result is None

    def test_expired_entry_returns_none(self):
        cache = TTLCache()
        # Set with 0 TTL (already expired)
        cache.set(("key",), "value", 0)
        time.sleep(0.01)  # Wait for expiry
        result = cache.get(("key",))
        assert result is None

    def test_clear_removes_all(self):
        cache = TTLCache()
        cache.set(("key1",), "value1", 100)
        cache.set(("key2",), "value2", 100)
        cache.clear()
        assert cache.get(("key1",)) is None
        assert cache.get(("key2",)) is None

    def test_cleanup_expired_removes_expired_entries(self):
        cache = TTLCache()
        cache.set(("expired",), "old", 0)
        cache.set(("fresh",), "new", 100)
        time.sleep(0.01)
        cache.cleanup_expired()
        assert cache.get(("expired",)) is None
        assert cache.get(("fresh",)) == "new"

    def test_overwrite_existing_key(self):
        cache = TTLCache()
        cache.set(("key",), "first", 100)
        cache.set(("key",), "second", 100)
        result = cache.get(("key",))
        assert result == "second"

    def test_complex_key(self):
        cache = TTLCache()
        key = ("func_name", ("arg1", "arg2"), (("kw", "val"),))
        cache.set(key, 42, 100)
        assert cache.get(key) == 42


class TestCachedDecorator:
    @pytest.mark.asyncio
    async def test_async_function_cached(self):
        """Async function result is cached on second call."""
        call_count = 0

        @cached(ttl_seconds=60)
        async def my_func(x: str):
            nonlocal call_count
            call_count += 1
            return f"result_{x}"

        result1 = await my_func("test")
        result2 = await my_func("test")

        assert result1 == result2 == "result_test"
        assert call_count == 1, "Should only call the function once due to caching"

    @pytest.mark.asyncio
    async def test_async_different_args_not_cached(self):
        """Different args produce different cache keys."""
        call_count = 0

        @cached(ttl_seconds=60)
        async def my_func(x: str):
            nonlocal call_count
            call_count += 1
            return f"result_{x}"

        await my_func("a")
        await my_func("b")
        assert call_count == 2

    def test_sync_function_cached(self):
        """Sync function result is cached."""
        call_count = 0

        @cached(ttl_seconds=60)
        def my_sync(x: int):
            nonlocal call_count
            call_count += 1
            return x * 2

        result1 = my_sync(5)
        result2 = my_sync(5)
        assert result1 == result2 == 10
        assert call_count == 1

    def test_sync_function_different_args(self):
        call_count = 0

        @cached(ttl_seconds=60)
        def my_sync(x: int):
            nonlocal call_count
            call_count += 1
            return x * 3

        my_sync(1)
        my_sync(2)
        assert call_count == 2


class TestCacheHelpers:
    def test_clear_cache_function(self):
        """clear_cache clears global cache."""
        from app.core.cache import _global_cache
        _global_cache.set(("test_clear",), "value", 100)
        clear_cache()
        assert _global_cache.get(("test_clear",)) is None

    def test_cleanup_expired_cache_function(self):
        """cleanup_expired_cache removes expired entries."""
        from app.core.cache import _global_cache
        _global_cache.set(("expired_test",), "old", 0)
        time.sleep(0.01)
        cleanup_expired_cache()
        assert _global_cache.get(("expired_test",)) is None
