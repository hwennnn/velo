"""
Upload API endpoints
Handles file uploads to Supabase Storage
"""

import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from supabase import Client, create_client

from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User

router = APIRouter()

# Allowed image MIME types
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}

# Maximum file size: 5MB
MAX_FILE_SIZE = 5 * 1024 * 1024

# Supabase storage bucket name
AVATAR_BUCKET = "avatars"


def get_supabase_client() -> Client:
    """Get Supabase client for storage operations"""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


class UploadResponse(BaseModel):
    """Response schema for file upload"""

    url: str
    filename: str


def extract_storage_path(url: str) -> Optional[str]:
    """
    Extract storage path from Supabase public URL.
    Returns None if URL is not from our Supabase storage.
    """
    try:
        # Supabase storage URLs follow pattern:
        # https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
        if (
            settings.supabase_url in url
            and f"/storage/v1/object/public/{AVATAR_BUCKET}/" in url
        ):
            # Extract path after bucket name
            parts = url.split(f"/storage/v1/object/public/{AVATAR_BUCKET}/")
            if len(parts) == 2:
                return parts[1]
    except Exception:
        pass
    return None


@router.post(
    "/avatar", response_model=UploadResponse, status_code=status.HTTP_201_CREATED
)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> UploadResponse:
    """
    Upload a profile picture to Supabase Storage.

    - Validates file type (JPEG, PNG, GIF, WebP)
    - Validates file size (max 5MB)
    - Generates unique filename
    - Deletes old avatar if it exists in Supabase Storage
    - Returns public URL of uploaded image
    """
    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB",
        )

    # Generate unique filename
    file_ext = os.path.splitext(file.filename or "image.jpg")[1]
    unique_filename = f"{current_user.id}/{uuid.uuid4()}{file_ext}"

    try:
        # Initialize Supabase client
        supabase = get_supabase_client()

        # Delete old avatar if it exists and is stored in our Supabase storage
        if current_user.avatar_url:
            old_path = extract_storage_path(current_user.avatar_url)
            if old_path:
                try:
                    supabase.storage.from_(AVATAR_BUCKET).remove([old_path])
                except Exception:
                    # Ignore errors when deleting old file (it might not exist)
                    pass

        # Upload new file
        response = supabase.storage.from_(AVATAR_BUCKET).upload(
            path=unique_filename,
            file=content,
            file_options={"content-type": file.content_type},
        )

        # Get public URL
        public_url = supabase.storage.from_(AVATAR_BUCKET).get_public_url(
            unique_filename
        )

        return UploadResponse(
            url=public_url,
            filename=unique_filename,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )
