"""Datetime utilities for timezone-aware operations"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """
    Get current UTC time as a naive datetime (for PostgreSQL compatibility).
    
    PostgreSQL TIMESTAMP WITHOUT TIME ZONE columns require naive datetimes.
    This function returns the current UTC time without timezone info attached.
    
    Note: When serializing to JSON, use to_utc_isoformat() to add the 'Z' suffix.
    
    Returns:
        datetime: Current UTC time as naive datetime
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_utc_isoformat(dt: datetime) -> str:
    """
    Convert a naive UTC datetime to ISO format string with 'Z' suffix.
    
    This ensures the frontend knows the timestamp is in UTC.
    
    Args:
        dt: Naive datetime assumed to be in UTC
        
    Returns:
        str: ISO format string with 'Z' suffix (e.g., '2025-12-27T17:01:10.830493Z')
    """
    if dt is None:
        return None
    # If datetime has timezone info, convert to UTC and format
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.isoformat() + 'Z'
