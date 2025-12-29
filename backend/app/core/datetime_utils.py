"""Datetime utilities for timezone-aware operations"""

from datetime import datetime, date, timezone


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


def to_utc_isoformat(dt: datetime | date) -> str:
    """
    Convert a naive UTC datetime to ISO format string with 'Z' suffix.
    For date objects, returns just the date in ISO format (no 'Z' suffix).

    This ensures the frontend knows the timestamp is in UTC.

    Args:
        dt: Naive datetime assumed to be in UTC, or a date object

    Returns:
        str: ISO format string with 'Z' suffix for datetime (e.g., '2025-12-27T17:01:10.830493Z')
             or just the date for date objects (e.g., '2025-12-27')
    """
    if dt is None:
        return None
    # Handle date objects (which don't have tzinfo)
    # Check for date-only by ensuring it's not a datetime (datetime is a subclass of date)
    if isinstance(dt, date) and not isinstance(dt, datetime):
        return dt.isoformat()
    # If datetime has timezone info, convert to UTC and format
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.isoformat() + "Z"
