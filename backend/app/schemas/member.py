"""
Pydantic schemas for Member API endpoints
"""
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class MemberAdd(BaseModel):
    """Schema for adding a member to a trip"""
    nickname: str = Field(..., min_length=1, max_length=100,
                          description="Member display name")
    is_fictional: bool = Field(
        default=False, description="Is this a fictional member?")
    user_email: Optional[str] = Field(
        None, description="Email to search for real user (if not fictional)")
    is_admin: bool = Field(default=False, description="Grant admin privileges")

    @model_validator(mode='after')
    def validate_member_data(self):
        """Validate member data"""
        # Clean nickname
        if self.nickname:
            self.nickname = self.nickname.strip()
            if not self.nickname:
                raise ValueError('Nickname cannot be empty or just whitespace')

        # For real members, email is required
        if not self.is_fictional and not self.user_email:
            raise ValueError('Email is required for real members')

        # Clean email
        if self.user_email:
            self.user_email = self.user_email.strip().lower()

        return self


class MemberUpdate(BaseModel):
    """Schema for updating a member"""
    nickname: Optional[str] = Field(None, min_length=1, max_length=100)
    is_admin: Optional[bool] = None

    @model_validator(mode='after')
    def validate_member_data(self):
        """Validate member update data"""
        # Clean nickname
        if self.nickname is not None:
            self.nickname = self.nickname.strip()
            if not self.nickname:
                raise ValueError('Nickname cannot be empty or just whitespace')

        return self


class MemberClaimRequest(BaseModel):
    """Schema for claiming a fictional member"""
    claim_code: Optional[str] = Field(
        None, description="Optional claim code for verification")


class MemberResponse(BaseModel):
    """Schema for member in responses"""
    id: int
    trip_id: int
    nickname: str
    is_fictional: bool
    is_admin: bool
    user_id: Optional[str] = None
    email: Optional[str] = None  # Only for real members
    avatar_url: Optional[str] = None  # Only for real members

    class Config:
        from_attributes = True


class InviteLinkResponse(BaseModel):
    """Schema for invite link response"""
    invite_code: str
    invite_url: str
    expires_at: Optional[str] = None
