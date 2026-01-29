"""Device service for managing device registration and limits.

This service handles:
- Device registration (upsert pattern)
- Device limit enforcement
- Device unlinking (SuperAdmin action)
- Inactive device cleanup

Feature: granular-permissions-subscription
Task: 2.8 Implement DeviceService
Requirements: 3.1, 3.2, 3.3
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.subscription import DeviceRegistry


class DeviceLimitExceeded(Exception):
    """Exception raised when device limit is exceeded."""
    pass


class DeviceService:
    """
    Service for managing device registration and limits.
    
    Validates: Requirements 3.1, 3.2, 3.3
    - 3.1: Check device limits before registration
    - 3.2: Reject new devices when limit reached
    - 3.3: Mark inactive devices after 30 days
    """
    
    # Devices inactive after 30 days of no sync
    INACTIVE_THRESHOLD_DAYS = 30
    
    def __init__(self, db: AsyncSession):
        """Initialize device service with database session.
        
        Args:
            db: Async SQLAlchemy session
        """
        self.db = db
    
    async def register_device(
        self,
        device_id: str,
        business_id: str,
        device_name: str = "Unknown Device",
        user_id: Optional[str] = None
    ) -> DeviceRegistry:
        """
        Register or update a device for a business.
        
        Algorithm:
        1. Check if device already exists for this business (upsert pattern)
        2. If exists, update last_sync_time to NOW() and set is_active = TRUE
        3. If not exists, check device limit
        4. If limit reached, raise HTTPException(403)
        5. Create new device registry entry
        6. Return device registry
        
        Args:
            device_id: Unique device identifier (UUID)
            business_id: Business UUID
            device_name: Human-readable device name
            user_id: User UUID who registered the device
            
        Returns:
            DeviceRegistry instance
            
        Raises:
            HTTPException: 403 if device limit exceeded
            
        Validates: Requirements 3.1, 3.2
        """
        # Check if device already exists for this business
        result = await self.db.execute(
            select(DeviceRegistry)
            .where(
                and_(
                    DeviceRegistry.business_id == business_id,
                    DeviceRegistry.device_id == device_id
                )
            )
        )
        existing_device = result.scalar_one_or_none()
        
        if existing_device:
            # Update existing device - refresh last_sync_time and reactivate
            existing_device.last_sync_time = datetime.now(timezone.utc)
            existing_device.is_active = True
            await self.db.commit()
            await self.db.refresh(existing_device)
            return existing_device
        
        # New device - check if limit allows registration
        can_register = await self.check_device_limit(business_id, device_id)
        
        if not can_register:
            # Get active count for error message
            active_count = await self.get_active_device_count(business_id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Device limit reached. {active_count} devices are already active for this business."
            )
        
        # Create new device
        new_device = DeviceRegistry(
            device_id=device_id,
            business_id=business_id,
            device_name=device_name,
            user_id=user_id,
            last_sync_time=datetime.now(timezone.utc),
            is_active=True
        )
        
        self.db.add(new_device)
        
        try:
            await self.db.commit()
            await self.db.refresh(new_device)
            return new_device
        except IntegrityError:
            await self.db.rollback()
            # Race condition - device was created by another request
            # Try to fetch it again
            result = await self.db.execute(
                select(DeviceRegistry)
                .where(
                    and_(
                        DeviceRegistry.business_id == business_id,
                        DeviceRegistry.device_id == device_id
                    )
                )
            )
            device = result.scalar_one_or_none()
            if device:
                return device
            raise
    
    async def check_device_limit(
        self,
        business_id: str,
        device_id: Optional[str] = None
    ) -> bool:
        """
        Check if a business can add a new device.
        
        Algorithm:
        1. Get business subscription to find device limit
        2. Count active devices (is_active=TRUE)
        3. If device_id provided and already exists, return True (existing device)
        4. If count < max_devices, return True
        5. Otherwise, return False
        
        Args:
            business_id: Business UUID
            device_id: Optional device ID to check (for existing devices)
            
        Returns:
            True if device can be registered, False if limit reached
            
        Validates: Requirements 3.1, 3.2
        """
        # If device_id provided, check if it already exists
        if device_id:
            result = await self.db.execute(
                select(DeviceRegistry)
                .where(
                    and_(
                        DeviceRegistry.business_id == business_id,
                        DeviceRegistry.device_id == device_id
                    )
                )
            )
            existing_device = result.scalar_one_or_none()
            if existing_device:
                # Existing device - always allow
                return True
        
        # Get device limit from subscription
        # Import here to avoid circular dependency
        from app.services.permission_service import PermissionService
        
        permission_service = PermissionService(self.db)
        permissions = await permission_service.get_business_permissions(business_id)
        max_devices = permissions.get('device_limit', 1)
        
        # Count active devices
        active_count = await self.get_active_device_count(business_id)
        
        # Check if limit exceeded
        return active_count < max_devices
    
    async def get_active_device_count(
        self,
        business_id: str
    ) -> int:
        """
        Count active devices for a business.
        
        Active devices are those with is_active=TRUE.
        
        Args:
            business_id: Business UUID
            
        Returns:
            Count of active devices
            
        Validates: Requirements 3.1
        """
        result = await self.db.execute(
            select(DeviceRegistry)
            .where(
                and_(
                    DeviceRegistry.business_id == business_id,
                    DeviceRegistry.is_active
                )
            )
        )
        devices = result.scalars().all()
        return len(devices)

    
    async def mark_inactive_devices(self) -> int:
        """
        Background job: Mark devices as inactive if last_sync > 30 days.
        
        This method is designed to be called by a scheduled background job
        to automatically clean up devices that haven't synced in 30+ days.
        
        Algorithm:
        1. Calculate cutoff date (NOW - 30 days)
        2. Query devices where is_active=TRUE and last_sync_time < cutoff
        3. Update is_active = FALSE for matching devices
        4. Return count of updated devices
        
        Returns:
            Number of devices marked as inactive
            
        Validates: Requirements 3.3
        """
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=self.INACTIVE_THRESHOLD_DAYS)
        
        # Update devices that haven't synced in 30+ days
        stmt = (
            update(DeviceRegistry)
            .where(
                and_(
                    DeviceRegistry.is_active,
                    DeviceRegistry.last_sync_time < cutoff_date
                )
            )
            .values(is_active=False)
        )
        
        result = await self.db.execute(stmt)
        await self.db.commit()
        
        return result.rowcount
    
    async def unlink_device(
        self,
        business_id: str,
        device_id: str
    ) -> None:
        """
        Unlink a device from a business (SuperAdmin action).
        Sets is_active = FALSE.
        
        Args:
            business_id: Business UUID
            device_id: Device ID to unlink
            
        Raises:
            HTTPException: 404 if device not found
        """
        result = await self.db.execute(
            select(DeviceRegistry)
            .where(
                and_(
                    DeviceRegistry.business_id == business_id,
                    DeviceRegistry.device_id == device_id
                )
            )
        )
        device = result.scalar_one_or_none()
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found for business {business_id}"
            )
        
        device.is_active = False
        await self.db.commit()
    
    async def get_business_devices(
        self,
        business_id: str
    ) -> List[DeviceRegistry]:
        """
        Get all devices for a business.
        
        Args:
            business_id: Business UUID
            
        Returns:
            List of DeviceRegistry objects
        """
        result = await self.db.execute(
            select(DeviceRegistry)
            .where(DeviceRegistry.business_id == business_id)
            .order_by(DeviceRegistry.last_sync_time.desc())
        )
        devices = result.scalars().all()
        return list(devices)
