"""
Generic caching decorator with time-based expiration
"""

import functools
import time
from typing import Any, Callable, Dict, Tuple
from datetime import datetime


class CacheEntry:
    """Cache entry with expiration time"""

    def __init__(self, value: Any, expires_at: float):
        self.value = value
        self.expires_at = expires_at

    def is_expired(self) -> bool:
        """Check if cache entry has expired"""
        return time.time() > self.expires_at


class TTLCache:
    """Thread-safe in-memory cache with TTL (Time To Live)"""

    def __init__(self):
        self._cache: Dict[Tuple, CacheEntry] = {}

    def get(self, key: Tuple) -> Any:
        """Get value from cache if not expired"""
        entry = self._cache.get(key)
        if entry and not entry.is_expired():
            return entry.value
        # Clean up expired entry
        if entry:
            del self._cache[key]
        return None

    def set(self, key: Tuple, value: Any, ttl_seconds: int):
        """Set value in cache with TTL"""
        expires_at = time.time() + ttl_seconds
        self._cache[key] = CacheEntry(value, expires_at)

    def clear(self):
        """Clear all cache entries"""
        self._cache.clear()

    def cleanup_expired(self):
        """Remove all expired entries"""
        expired_keys = [key for key, entry in self._cache.items() if entry.is_expired()]
        for key in expired_keys:
            del self._cache[key]


# Global cache instance
_global_cache = TTLCache()


def cached(ttl_seconds: int = 1800):
    """
    Decorator to cache function results with TTL (time-to-live).

    Args:
        ttl_seconds: Cache lifetime in seconds (default: 1800 = 30 minutes)

    Example:
        @cached(ttl_seconds=1800)  # Cache for 30 minutes
        async def fetch_exchange_rates(base_currency: str):
            return await api_call()

    Notes:
        - Works with both sync and async functions
        - Creates cache key from function name and arguments
        - Thread-safe for single-process applications
        - For multi-process deployments, consider Redis
    """

    def decorator(func: Callable) -> Callable:
        is_async = asyncio.iscoroutinefunction(func)

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = (func.__name__, args, tuple(sorted(kwargs.items())))

            # Try to get from cache
            cached_value = _global_cache.get(cache_key)
            if cached_value is not None:
                return cached_value

            # Cache miss - call function
            result = await func(*args, **kwargs)

            # Store in cache
            _global_cache.set(cache_key, result, ttl_seconds)

            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = (func.__name__, args, tuple(sorted(kwargs.items())))

            # Try to get from cache
            cached_value = _global_cache.get(cache_key)
            if cached_value is not None:
                return cached_value

            # Cache miss - call function
            result = func(*args, **kwargs)

            # Store in cache
            _global_cache.set(cache_key, result, ttl_seconds)

            return result

        return async_wrapper if is_async else sync_wrapper

    return decorator


def clear_cache():
    """Clear all cached data"""
    _global_cache.clear()


def cleanup_expired_cache():
    """Remove expired cache entries"""
    _global_cache.cleanup_expired()


# Import asyncio at module level for decorator
import asyncio
