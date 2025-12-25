"""
FastAPI application entry point for Velo Travel Expense Tracker.
"""
from app.api import trips, users, members, expenses, balances
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    print(f"Starting {settings.app_name} v{settings.app_version}")
    print(f"Environment: {settings.environment}")
    await init_db()
    print("Database initialized")

    yield

    # Shutdown
    print("Shutting down application")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint - health check."""
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "status": "online",
        "environment": settings.environment,
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "service": settings.app_name,
    }


# API routes

app.include_router(
    users.router, prefix=f"{settings.api_prefix}/users", tags=["users"])
app.include_router(
    trips.router, prefix=f"{settings.api_prefix}/trips", tags=["trips"])
app.include_router(
    members.router, prefix=f"{settings.api_prefix}", tags=["members"])
app.include_router(
    expenses.router, prefix=f"{settings.api_prefix}", tags=["expenses"])
app.include_router(
    balances.router, prefix=f"{settings.api_prefix}", tags=["balances"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
        loop="asyncio",
    )
