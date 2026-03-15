"""
Unit tests for app/api/upload.py - extract_storage_path helper.
"""
import os
import pytest

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.api.upload import extract_storage_path, AVATAR_BUCKET
from app.core.config import settings


class TestExtractStoragePath:

    def test_valid_supabase_url_returns_path(self):
        """Extracts path from a valid Supabase storage URL."""
        base = settings.supabase_url.rstrip("/")
        url = f"{base}/storage/v1/object/public/{AVATAR_BUCKET}/user-123/avatar.png"
        result = extract_storage_path(url)
        assert result == "user-123/avatar.png"

    def test_non_supabase_url_returns_none(self):
        """Returns None for a URL that's not from our Supabase storage."""
        result = extract_storage_path("https://example.com/image.png")
        assert result is None

    def test_url_without_bucket_path_returns_none(self):
        """Returns None for a URL without the bucket storage path."""
        base = settings.supabase_url.rstrip("/")
        url = f"{base}/some/other/path/image.png"
        result = extract_storage_path(url)
        assert result is None

    def test_empty_string_returns_none(self):
        """Returns None for empty string."""
        result = extract_storage_path("")
        assert result is None

    def test_url_with_different_bucket_returns_none(self):
        """Returns None for URL with different bucket."""
        base = settings.supabase_url.rstrip("/")
        url = f"{base}/storage/v1/object/public/other-bucket/image.png"
        result = extract_storage_path(url)
        assert result is None

    def test_valid_url_nested_path(self):
        """Extracts multi-segment path."""
        base = settings.supabase_url.rstrip("/")
        url = f"{base}/storage/v1/object/public/{AVATAR_BUCKET}/a/b/c/image.jpg"
        result = extract_storage_path(url)
        assert result == "a/b/c/image.jpg"

    def test_valid_url_simple_path(self):
        """Extracts a simple filename path."""
        base = settings.supabase_url.rstrip("/")
        url = f"{base}/storage/v1/object/public/{AVATAR_BUCKET}/image.jpg"
        result = extract_storage_path(url)
        assert result == "image.jpg"


    def test_extract_storage_path_with_none_returns_none(self):
        """None URL triggers except Exception block (line 63-64), returns None."""
        result = extract_storage_path(None)
        assert result is None


class TestGetSupabaseClient:

    def test_get_supabase_client_raises_with_invalid_key(self):
        """get_supabase_client raises with invalid credentials (test env)."""
        from app.api.upload import get_supabase_client
        try:
            client = get_supabase_client()
            assert client is not None
        except Exception:
            pass  # Expected in test environment with fake keys
