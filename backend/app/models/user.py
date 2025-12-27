"""
User model - synced with Supabase auth.users
"""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
from ..core.datetime_utils import utcnow


class User(SQLModel, table=True):
    """
    User model representing authenticated users.
    This mirrors Supabase auth.users but stores additional profile info.
    """
    __tablename__ = "users"

    id: str = Field(primary_key=True, description="Supabase auth user UUID")
    email: str = Field(unique=True, index=True, description="User email address")
    display_name: Optional[str] = Field(default=None, description="User display name")
    avatar_url: Optional[str] = Field(default=None, description="Profile picture URL")
    
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "email": "user@example.com",
                "display_name": "John Doe",
                "avatar_url": "https://example.com/avatar.jpg",
            }
        }
