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
    Creates tables if they don't exist (development only).
    """
    # Import all models here to ensure they are registered with SQLModel
    # This will be populated as we create models
    # from app.models.user import User
    # from app.models.trip import Trip
    # from app.models.trip_member import TripMember
    # from app.models.expense import Expense
    # from app.models.split import Split
    
    if settings.is_development:
        create_db_and_tables()
