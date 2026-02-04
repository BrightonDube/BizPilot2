"""Authentication service for user management."""

import uuid
from typing import Optional, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.user import User, UserStatus
from app.core.security import get_password_hash, verify_password
from app.schemas.auth import UserCreate


class AuthService:
    """Service for authentication operations. Supports both sync and async sessions."""

    def __init__(self, db: Union[AsyncSession, Session]):
        self.db = db
        self._is_async = isinstance(db, AsyncSession)

    async def _execute(self, stmt):
        """Execute a statement, handling both sync and async sessions."""
        if self._is_async:
            return await self.db.execute(stmt)
        else:
            return self.db.execute(stmt)

    async def _commit(self):
        """Commit the session, handling both sync and async sessions."""
        if self._is_async:
            await self.db.commit()
        else:
            self.db.commit()

    async def _refresh(self, obj):
        """Refresh an object, handling both sync and async sessions."""
        if self._is_async:
            await self.db.refresh(obj)
        else:
            self.db.refresh(obj)

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get a user by email."""
        stmt = select(User).filter(User.email == email)
        result = await self._execute(stmt)
        return result.scalars().first()

    async def get_user_by_id(self, user_id: Union[str, uuid.UUID]) -> Optional[User]:
        """Get a user by ID."""
        # Convert string to UUID if needed for PostgreSQL
        if isinstance(user_id, str):
            try:
                user_id = uuid.UUID(user_id)
            except ValueError:
                return None
        stmt = select(User).filter(User.id == user_id)
        result = await self._execute(stmt)
        return result.scalars().first()

    async def create_user(self, user_data: UserCreate) -> User:
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
        await self._commit()
        await self._refresh(user)
        return user

    async def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate a user with email and password."""
        user = await self.get_user_by_email(email)
        if not user:
            return None
        if not user.hashed_password:
            return None  # OAuth user without password
        if not verify_password(password, user.hashed_password):
            return None
        return user

    async def verify_email(self, email: str) -> bool:
        """Mark a user's email as verified."""
        user = await self.get_user_by_email(email)
        if not user:
            return False

        user.is_email_verified = True
        user.status = UserStatus.ACTIVE
        await self._commit()
        return True

    async def update_password(self, user: User, new_password: str) -> bool:
        """Update a user's password."""
        user.hashed_password = get_password_hash(new_password)
        await self._commit()
        return True

    async def reset_password(self, email: str, new_password: str) -> bool:
        """Reset a user's password."""
        user = await self.get_user_by_email(email)
        if not user:
            return False

        user.hashed_password = get_password_hash(new_password)
        await self._commit()
        return True
