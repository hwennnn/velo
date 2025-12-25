"""
Database connection and session management using SQLModel with async support.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlmodel import SQLModel
from sqlalchemy.pool import NullPool
from app.core.config import settings


# Create async database engine
# Note: Use postgresql+asyncpg:// for async connections
async_database_url = settings.database_url.replace(
    "postgresql://", "postgresql+asyncpg://"
).replace("postgresql+psycopg2://", "postgresql+asyncpg://")

engine = create_async_engine(
    async_database_url,
    echo=settings.db_echo,
    poolclass=NullPool if settings.database_url.startswith("sqlite") else None,
    pool_pre_ping=True,
    pool_size=(
        settings.db_pool_size
        if not settings.database_url.startswith("sqlite")
        else None
    ),
    max_overflow=(
        settings.db_max_overflow
        if not settings.database_url.startswith("sqlite")
        else None
    ),
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
