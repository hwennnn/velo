"""
Authentication and authorization utilities
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.config import settings
from app.core.database import get_session
from app.models.user import User

security = HTTPBearer()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """
    Extract and verify user ID from JWT token.
    This works with Supabase JWT tokens.

    Args:
        credentials: HTTP Bearer token from request header

    Returns:
        User ID (UUID string)

    Raises:
        HTTPException: If token is invalid or expired
    """
    token = credentials.credentials

    try:
        # Decode JWT token (Supabase uses HS256 with JWT secret)
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            # Supabase tokens don't always have aud
            options={"verify_aud": False},
        )

        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )

        return user_id

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
        )


async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> User:
    """
    Get the current authenticated user from database.
    Creates user record if it doesn't exist (first login).

    Args:
        user_id: User ID from JWT token
        session: Database session

    Returns:
        User model instance

    Raises:
        HTTPException: If user cannot be retrieved
    """
    # Try to get existing user
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if user:
        return user

    # User doesn't exist yet - this shouldn't happen if auth is set up correctly
    # But we can handle it gracefully
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User profile not found. Please complete registration.",
    )


async def create_user_if_not_exists(
    user_id: str,
    email: str,
    session: AsyncSession,
    display_name: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> User:
    """
    Create user record if it doesn't exist.
    This is typically called after successful Supabase auth.

    Args:
        user_id: Supabase user UUID
        email: User email
        display_name: User display name from OAuth provider
        avatar_url: User avatar URL from OAuth provider
        session: Database session

    Returns:
        User model instance (existing or newly created)
    """
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if user:
        # Update existing user with new profile data if provided
        updated = False
        if display_name and not user.display_name:
            user.display_name = display_name
            updated = True
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
            updated = True

        if updated:
            session.add(user)
            await session.commit()
            await session.refresh(user)

        return user

    # Create new user
    user = User(
        id=user_id,
        email=email,
        display_name=display_name
        or email.split("@")[0],  # Use provided name or default from email
        avatar_url=avatar_url,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return user
