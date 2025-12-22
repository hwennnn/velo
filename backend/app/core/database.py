"""
Database connection and session management using SQLModel.
"""
from typing import Generator
from sqlmodel import create_engine, Session, SQLModel
from sqlalchemy.pool import QueuePool
from app.core.config import settings


# Create database engine with connection pooling
engine = create_engine(
    settings.database_url,
    echo=settings.db_echo,
    poolclass=QueuePool,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,  # Verify connections before using them
    pool_recycle=3600,   # Recycle connections after 1 hour
)


def create_db_and_tables() -> None:
    """
    Create all database tables.
    This is typically used in development or for initial setup.
    In production, use Alembic migrations instead.
    """
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """
    Dependency function to get a database session.

    Usage in FastAPI routes:
        @app.get("/items")
        def get_items(session: Session = Depends(get_session)):
            # Use session here
            pass

    Yields:
        Session: SQLModel database session
    """
    with Session(engine) as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


def init_db() -> None:
    """
    Initialize database on application startup.

    IMPORTANT: In production, use Alembic migrations instead of auto-creating tables.
    The create_db_and_tables() approach is only for quick local SQLite development.

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

    # Only auto-create tables for local SQLite development
    if settings.is_development and settings.database_url.startswith("sqlite"):
        print("⚠️  Auto-creating tables (SQLite development mode)")
        create_db_and_tables()
    elif settings.is_development:
        print("ℹ️  Using PostgreSQL - please run Alembic migrations")
    else:
        print("✓ Production mode - ensure Alembic migrations are up to date")
