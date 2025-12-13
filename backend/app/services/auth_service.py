"""Authentication service for user management."""

import uuid
from typing import Optional, Union
from sqlalchemy.orm import Session

from app.models.user import User, UserStatus
from app.core.security import get_password_hash, verify_password
from app.schemas.auth import UserCreate


class AuthService:
    """Service for authentication operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get a user by email."""
        return self.db.query(User).filter(User.email == email).first()

    def get_user_by_id(self, user_id: Union[str, uuid.UUID]) -> Optional[User]:
        """Get a user by ID."""
        # Convert string to UUID if needed for PostgreSQL
        if isinstance(user_id, str):
            try:
                user_id = uuid.UUID(user_id)
            except ValueError:
                return None
        return self.db.query(User).filter(User.id == user_id).first()

    def create_user(self, user_data: UserCreate) -> User:
        """Create a new user."""
        hashed_password = get_password_hash(user_data.password)
        
        user = User(
            email=user_data.email,
            hashed_password=hashed_password,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            status=UserStatus.PENDING,
            is_email_verified=False,
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate a user with email and password."""
        user = self.get_user_by_email(email)
        if not user:
            return None
        if not user.hashed_password:
            return None  # OAuth user without password
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def verify_email(self, email: str) -> bool:
        """Mark a user's email as verified."""
        user = self.get_user_by_email(email)
        if not user:
            return False
        
        user.is_email_verified = True
        user.status = UserStatus.ACTIVE
        self.db.commit()
        return True

    def update_password(self, user: User, new_password: str) -> bool:
        """Update a user's password."""
        user.hashed_password = get_password_hash(new_password)
        self.db.commit()
        return True

    def reset_password(self, email: str, new_password: str) -> bool:
        """Reset a user's password."""
        user = self.get_user_by_email(email)
        if not user:
            return False
        
        user.hashed_password = get_password_hash(new_password)
        self.db.commit()
        return True
