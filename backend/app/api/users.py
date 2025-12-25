"""
User API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.auth import get_current_user, create_user_if_not_exists
from app.core.database import get_session
from app.models.user import User

router = APIRouter()


class UserRegister(BaseModel):
    """Schema for user registration after Supabase auth"""

    user_id: str
    email: EmailStr
    display_name: str | None = None
    avatar_url: str | None = None


class UserUpdate(BaseModel):
    """Schema for updating user profile"""

    display_name: str | None = None
    avatar_url: str | None = None


class UserResponse(BaseModel):
    """Schema for user in responses"""

    id: str
    email: str
    display_name: str | None
    avatar_url: str | None

    class Config:
        from_attributes = True


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register_user(
    user_data: UserRegister,
    session: AsyncSession = Depends(get_session),
) -> User:
    """
    Register a new user after Supabase authentication.
    This creates the user profile in our database.
    """
    user = await create_user_if_not_exists(
        user_id=user_data.user_id,
        email=user_data.email,
        session=session,
        display_name=user_data.display_name,
        avatar_url=user_data.avatar_url,
    )
    return user


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current user's profile"""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Update current user's profile"""
    update_data = user_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)

    return current_user
