"""Delivery management service."""

from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.delivery import Delivery, DeliveryStatus, DeliveryZone, Driver


class DeliveryService:
    """Service for delivery operations."""

    def __init__(self, db: Session):
        self.db = db

    # ---- Zone management ----

    def create_zone(
        self,
        business_id: str,
        name: str,
        delivery_fee: Decimal,
        estimated_minutes: int,
        description: Optional[str] = None,
    ) -> DeliveryZone:
        """Create a delivery zone."""
        zone = DeliveryZone(
            business_id=business_id,
            name=name,
            delivery_fee=delivery_fee,
            estimated_minutes=estimated_minutes,
            description=description,
        )
        self.db.add(zone)
        self.db.commit()
        self.db.refresh(zone)
        return zone

    def list_zones(self, business_id: str) -> List[DeliveryZone]:
        """List active delivery zones for a business."""
        return (
            self.db.query(DeliveryZone)
            .filter(
                DeliveryZone.business_id == business_id,
                DeliveryZone.is_active.is_(True),
                DeliveryZone.deleted_at.is_(None),
            )
            .order_by(DeliveryZone.name)
            .all()
        )

    def update_zone(
        self, zone_id: str, business_id: str, **kwargs
    ) -> Optional[DeliveryZone]:
        """Update a delivery zone."""
        zone = (
            self.db.query(DeliveryZone)
            .filter(
                DeliveryZone.id == zone_id,
                DeliveryZone.business_id == business_id,
                DeliveryZone.deleted_at.is_(None),
            )
            .first()
        )
        if not zone:
            return None
        for key, value in kwargs.items():
            if hasattr(zone, key):
                setattr(zone, key, value)
        self.db.commit()
        self.db.refresh(zone)
        return zone

    # ---- Driver management ----

    def create_driver(
        self,
        business_id: str,
        name: str,
        phone: str,
        user_id: Optional[str] = None,
        vehicle_type: Optional[str] = None,
        license_plate: Optional[str] = None,
    ) -> Driver:
        """Add a driver."""
        driver = Driver(
            business_id=business_id,
            name=name,
            phone=phone,
            user_id=user_id,
            vehicle_type=vehicle_type,
            license_plate=license_plate,
        )
        self.db.add(driver)
        self.db.commit()
        self.db.refresh(driver)
        return driver

    def list_drivers(
        self, business_id: str, available_only: bool = False
    ) -> List[Driver]:
        """List drivers for a business."""
        query = self.db.query(Driver).filter(
            Driver.business_id == business_id,
            Driver.is_active.is_(True),
            Driver.deleted_at.is_(None),
        )
        if available_only:
            query = query.filter(Driver.is_available.is_(True))
        return query.order_by(Driver.name).all()

    def toggle_driver_availability(
        self, driver_id: str, business_id: str
    ) -> Optional[Driver]:
        """Toggle a driver's availability flag."""
        driver = (
            self.db.query(Driver)
            .filter(
                Driver.id == driver_id,
                Driver.business_id == business_id,
                Driver.deleted_at.is_(None),
            )
            .first()
        )
        if not driver:
            return None
        driver.is_available = not driver.is_available
        self.db.commit()
        self.db.refresh(driver)
        return driver

    # ---- Delivery CRUD ----

    def create_delivery(
        self,
        business_id: str,
        order_id: str,
        address: str,
        phone: str,
        zone_id: Optional[str] = None,
        driver_id: Optional[str] = None,
        delivery_fee: Optional[Decimal] = None,
        notes: Optional[str] = None,
    ) -> Delivery:
        """Create a delivery record."""
        status = DeliveryStatus.ASSIGNED if driver_id else DeliveryStatus.PENDING
        delivery = Delivery(
            business_id=business_id,
            order_id=order_id,
            delivery_address=address,
            customer_phone=phone,
            zone_id=zone_id,
            driver_id=driver_id,
            delivery_fee=delivery_fee or Decimal("0"),
            delivery_notes=notes,
            status=status,
        )
        self.db.add(delivery)
        self.db.commit()
        self.db.refresh(delivery)
        return delivery

    def assign_driver(
        self, delivery_id: str, driver_id: str, business_id: str
    ) -> Optional[Delivery]:
        """Assign a driver to a delivery."""
        delivery = (
            self.db.query(Delivery)
            .filter(
                Delivery.id == delivery_id,
                Delivery.business_id == business_id,
                Delivery.deleted_at.is_(None),
            )
            .first()
        )
        if not delivery:
            return None
        delivery.driver_id = driver_id
        if delivery.status == DeliveryStatus.PENDING:
            delivery.status = DeliveryStatus.ASSIGNED
        self.db.commit()
        self.db.refresh(delivery)
        return delivery

    def update_status(
        self,
        delivery_id: str,
        business_id: str,
        new_status: DeliveryStatus,
        proof: Optional[str] = None,
    ) -> Optional[Delivery]:
        """Update delivery status."""
        delivery = (
            self.db.query(Delivery)
            .filter(
                Delivery.id == delivery_id,
                Delivery.business_id == business_id,
                Delivery.deleted_at.is_(None),
            )
            .first()
        )
        if not delivery:
            return None
        delivery.status = new_status
        if new_status == DeliveryStatus.DELIVERED:
            delivery.actual_delivery_time = datetime.utcnow()
        if proof:
            delivery.proof_of_delivery = proof
        self.db.commit()
        self.db.refresh(delivery)
        return delivery

    def get_delivery(
        self, delivery_id: str, business_id: str
    ) -> Optional[Delivery]:
        """Get a single delivery by ID."""
        return (
            self.db.query(Delivery)
            .filter(
                Delivery.id == delivery_id,
                Delivery.business_id == business_id,
                Delivery.deleted_at.is_(None),
            )
            .first()
        )

    def list_deliveries(
        self,
        business_id: str,
        status: Optional[DeliveryStatus] = None,
        driver_id: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Delivery], int]:
        """List deliveries with optional filters and pagination."""
        query = self.db.query(Delivery).filter(
            Delivery.business_id == business_id,
            Delivery.deleted_at.is_(None),
        )
        if status:
            query = query.filter(Delivery.status == status)
        if driver_id:
            query = query.filter(Delivery.driver_id == driver_id)

        total = query.count()
        items = (
            query.order_by(Delivery.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_active_deliveries(self, business_id: str) -> List[Delivery]:
        """Get deliveries that are not yet completed."""
        terminal = {
            DeliveryStatus.DELIVERED,
            DeliveryStatus.FAILED,
            DeliveryStatus.RETURNED,
        }
        return (
            self.db.query(Delivery)
            .filter(
                Delivery.business_id == business_id,
                Delivery.deleted_at.is_(None),
                ~Delivery.status.in_(terminal),
            )
            .order_by(Delivery.created_at.desc())
            .all()
        )

    def get_driver_stats(
        self,
        driver_id: str,
        business_id: str,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> Dict:
        """Get driver performance statistics."""
        filters = [
            Delivery.driver_id == driver_id,
            Delivery.business_id == business_id,
            Delivery.deleted_at.is_(None),
        ]
        if date_from:
            filters.append(Delivery.created_at >= date_from)
        if date_to:
            filters.append(Delivery.created_at <= date_to)

        base = self.db.query(Delivery).filter(and_(*filters))
        total = base.count()
        delivered = base.filter(
            Delivery.status == DeliveryStatus.DELIVERED
        ).count()
        failed = base.filter(Delivery.status == DeliveryStatus.FAILED).count()
        total_fees = (
            base.filter(Delivery.status == DeliveryStatus.DELIVERED)
            .with_entities(func.coalesce(func.sum(Delivery.delivery_fee), 0))
            .scalar()
        )

        return {
            "driver_id": str(driver_id),
            "total_deliveries": total,
            "delivered": delivered,
            "failed": failed,
            "success_rate": round(delivered / total * 100, 1) if total else 0,
            "total_fees_collected": float(total_fees),
        }
