"""
Pydantic schemas for Member API endpoints
"""

from typing import Optional
from pydantic import BaseModel, Field, model_validator


class MemberAdd(BaseModel):
    """Schema for adding a member to a trip
    
    Status is auto-determined by backend:
    - Email provided + user exists -> 'active'
    - Email provided + user doesn't exist -> 'pending'
    - No email -> 'placeholder'
    """

    nickname: str = Field(
        ..., min_length=1, max_length=100, description="Member display name"
    )
    email: Optional[str] = Field(
        None, description="Optional email - if provided, creates pending invitation or adds existing user"
    )
    is_admin: bool = Field(default=False, description="Grant admin privileges")

    @model_validator(mode="after")
    def validate_member_data(self):
        """Validate member data"""
        # Clean nickname
        if self.nickname:
            self.nickname = self.nickname.strip()
            if not self.nickname:
                raise ValueError("Nickname cannot be empty or just whitespace")

        # Clean email
        if self.email:
            self.email = self.email.strip().lower()

        return self


class MemberUpdate(BaseModel):
    """Schema for updating a member"""

    nickname: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[str] = Field(None, description="Update email for pending/placeholder members")
    is_admin: Optional[bool] = None

    @model_validator(mode="after")
    def validate_member_data(self):
        """Validate member update data"""
        # Clean nickname
        if self.nickname is not None:
            self.nickname = self.nickname.strip()
            if not self.nickname:
                raise ValueError("Nickname cannot be empty or just whitespace")

        # Clean email
        if self.email is not None:
            self.email = self.email.strip().lower()

        return self


class MemberResponse(BaseModel):
    """Schema for member in responses"""

    id: int
    trip_id: int
    nickname: str
    status: str  # 'active', 'pending', 'placeholder'
    is_admin: bool
    user_id: Optional[str] = None
    email: Optional[str] = None  # Only for active members
    display_name: Optional[str] = None  # User's real name
    avatar_url: Optional[str] = None  # Only for active members
    invited_email: Optional[str] = None  # For pending members
    invited_at: Optional[str] = None  # When invitation was sent
    created_at: Optional[str] = None  # When member was created/added
    joined_at: Optional[str] = None  # When member joined (pending->active)

    class Config:
        from_attributes = True


class InviteLinkResponse(BaseModel):
    """Schema for invite link response"""

    invite_code: str
    invite_url: str
    expires_at: Optional[str] = None


class InviteInfoResponse(BaseModel):
    """Response for decode invite endpoint with trip preview info"""

    code: str
    trip_id: int
    trip_name: str
    trip_description: Optional[str] = None
    base_currency: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    member_count: int
    is_already_member: bool
