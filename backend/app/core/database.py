"""
Database connection and session management using SQLModel with async support.
"""

import socket
import time
from urllib.parse import urlparse, urlunparse
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlmodel import SQLModel
from sqlalchemy.pool import NullPool
from app.core.config import settings


def _resolve_db_url(url: str) -> str:
    """Resolve hostname in DATABASE_URL to IP to avoid Docker DNS issues.
    Retries until DNS is available (Docker DNS can take time to initialize)."""
    parsed = urlparse(url)
    if parsed.hostname:
        for attempt in range(30):
            try:
                ip = socket.getaddrinfo(parsed.hostname, parsed.port or 5432)[0][4][0]
                netloc = parsed.netloc.replace(parsed.hostname, ip)
                resolved = urlunparse(parsed._replace(netloc=netloc))
                print(f"Resolved DB host {parsed.hostname} -> {ip}")
                return resolved
            except socket.gaierror:
                print(f"DNS not ready (attempt {attempt + 1}/30), waiting...")
                time.sleep(2)
        print(f"ERROR: Could not resolve {parsed.hostname} after 30 attempts")
    return url


# Create async database engine
# Note: Use postgresql+asyncpg:// for async connections
async_database_url = settings.database_url.replace(
    "postgresql://", "postgresql+asyncpg://"
).replace("postgresql+psycopg2://", "postgresql+asyncpg://")

# Resolve hostname to IP to avoid Docker/uvloop DNS resolution issues
async_database_url = _resolve_db_url(async_database_url)

engine = create_async_engine(
    async_database_url,
    echo=settings.db_echo,
    poolclass=None,
    pool_pre_ping=True,
    pool_size=(settings.db_pool_size),
    max_overflow=(settings.db_max_overflow),
)

# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get an async database session.

    Usage in FastAPI routes:
        @app.get("/items")
        async def get_items(session: AsyncSession = Depends(get_session)):
            result = await session.execute(select(Item))
            items = result.scalars().all()
            return items

    Yields:
        AsyncSession: SQLAlchemy async database session
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initialize database on application startup.

    IMPORTANT: In production, use Alembic migrations instead of auto-creating tables.

    For Supabase PostgreSQL:
    1. Generate migration: alembic revision --autogenerate -m "description"
    2. Review the generated migration file
    3. Apply migration: alembic upgrade head
    """
    # Import all models here to ensure they are registered with SQLModel
    from app.models.user import User
    from app.models.trip import Trip
    from app.models.trip_member import TripMember
    from app.models.expense import Expense
    from app.models.split import Split

    if settings.is_development:
        print("ℹ️  Using PostgreSQL - please run Alembic migrations")
    else:
        print("✓ Production mode - ensure Alembic migrations are up to date")
