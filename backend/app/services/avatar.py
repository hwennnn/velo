"""
Avatar generation service for members without profile pictures
"""

import hashlib
from typing import Optional


def generate_avatar_url(
    member_id: int, 
    nickname: str, 
    style: str = "initials"
) -> str:
    """
    Generate a deterministic avatar URL for a member.
    
    Args:
        member_id: Unique member ID for consistent colors
        nickname: Member's display name
        style: Avatar style ('initials', 'identicon', 'robohash')
        
    Returns:
        URL to generated avatar image
    """
    if style == "initials":
        return generate_initials_avatar(member_id, nickname)
    elif style == "identicon":
        return generate_identicon_avatar(member_id, nickname)
    elif style == "robohash":
        return generate_robohash_avatar(member_id, nickname)
    else:
        return generate_initials_avatar(member_id, nickname)


def generate_initials_avatar(member_id: int, nickname: str) -> str:
    """
    Generate an avatar URL using DiceBear Initials API.
    Creates consistent avatars based on member ID and initials.
    """
    # Get initials (up to 2 characters)
    initials = get_member_initials(nickname)
    
    # Generate consistent background color based on member_id
    colors = [
        "3b82f6",  # blue-500
        "10b981",  # emerald-500  
        "8b5cf6",  # violet-500
        "ec4899",  # pink-500
        "f59e0b",  # amber-500
        "ef4444",  # red-500
        "6366f1",  # indigo-500
        "06b6d4",  # cyan-500
        "84cc16",  # lime-500
        "f97316",  # orange-500
    ]
    
    bg_color = colors[member_id % len(colors)]
    
    # DiceBear Initials API
    # https://dicebear.com/styles/initials
    return f"https://api.dicebear.com/7.x/initials/svg?seed={initials}&backgroundColor={bg_color}&textColor=ffffff&fontSize=40"


def generate_identicon_avatar(member_id: int, nickname: str) -> str:
    """
    Generate an identicon-style avatar using DiceBear.
    Creates geometric patterns based on nickname hash.
    """
    # Create a hash seed from member_id and nickname for consistency
    seed = hashlib.md5(f"{member_id}-{nickname}".encode()).hexdigest()[:8]
    
    return f"https://api.dicebear.com/7.x/identicon/svg?seed={seed}&backgroundColor=random"


def generate_robohash_avatar(member_id: int, nickname: str) -> str:
    """
    Generate a robot-style avatar using RoboHash.
    Creates cute robot avatars based on nickname.
    """
    # Create a hash seed from member_id and nickname for consistency
    seed = hashlib.md5(f"{member_id}-{nickname}".encode()).hexdigest()[:8]
    
    return f"https://robohash.org/{seed}.png?size=200x200&set=set1"


def get_member_initials(nickname: str) -> str:
    """
    Extract initials from a nickname.
    
    Args:
        nickname: Member's display name
        
    Returns:
        Up to 2 character initials in uppercase
    """
    if not nickname:
        return "?"
        
    # Split by spaces and take first letter of each word
    words = nickname.strip().split()
    if not words:
        return "?"
        
    initials = ""
    for word in words:
        if word and word[0].isalpha():
            initials += word[0].upper()
            if len(initials) >= 2:
                break
                
    # If we don't have enough initials, pad with first letters
    if len(initials) == 0:
        # Take first alphabetic character
        for char in nickname:
            if char.isalpha():
                initials = char.upper()
                break
        if not initials:
            initials = "?"
    elif len(initials) == 1:
        # Try to get a second initial from remaining characters
        remaining = nickname[1:] if len(nickname) > 1 else ""
        for char in remaining:
            if char.isalpha() and char.upper() != initials:
                initials += char.upper()
                break
                
    return initials[:2]


def get_member_color_class(member_id: int) -> str:
    """
    Get a consistent Tailwind CSS color class for a member.
    Used as fallback for frontend avatar backgrounds.
    
    Args:
        member_id: Unique member ID
        
    Returns:
        Tailwind CSS background color class
    """
    colors = [
        "bg-blue-500",
        "bg-emerald-500", 
        "bg-violet-500",
        "bg-pink-500",
        "bg-amber-500",
        "bg-red-500",
        "bg-indigo-500",
        "bg-cyan-500",
        "bg-lime-500",
        "bg-orange-500",
    ]
    
    return colors[member_id % len(colors)]


def get_avatar_for_member(
    member_id: int,
    nickname: str,
    user_avatar_url: Optional[str] = None,
    style: str = "initials"
) -> dict:
    """
    Get the best avatar for a member.
    Prefers user's profile picture, falls back to generated avatar.
    
    Args:
        member_id: Unique member ID
        nickname: Member's display name  
        user_avatar_url: User's profile picture URL (if any)
        style: Generated avatar style if no profile picture
        
    Returns:
        Dict with avatar_url, fallback_color, and initials
    """
    # Use user's avatar URL if available (not None and not empty string)
    has_user_avatar = user_avatar_url and user_avatar_url.strip()
    
    return {
        "avatar_url": user_avatar_url if has_user_avatar else generate_avatar_url(member_id, nickname, style),
        "fallback_color": get_member_color_class(member_id),
        "initials": get_member_initials(nickname),
        "is_generated": not has_user_avatar
    }
