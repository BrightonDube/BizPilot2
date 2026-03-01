"""Location management service."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.location import (
    Location,
    LocationStock,
    StockTransfer,
    StockTransferItem,
    TransferStatus,
)


class LocationService:
    """Service for multi-location inventory operations."""

    def __init__(self, db: Session):
        self.db = db

    # ── Locations ──────────────────────────────────────────────

    def create_location(
        self,
        business_id: str,
        name: str,
        code: Optional[str] = None,
        address: Optional[str] = None,
        city: Optional[str] = None,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        is_warehouse: bool = False,
        is_primary: bool = False,
    ) -> Location:
        """Create a new business location."""
        location = Location(
            business_id=business_id,
            name=name,
            code=code,
            address=address,
            city=city,
            phone=phone,
            email=email,
            is_warehouse=is_warehouse,
            is_primary=is_primary,
        )
        self.db.add(location)
        self.db.flush()
        return location

    def list_locations(
        self, business_id: str, include_inactive: bool = False
    ) -> List[Location]:
        """List locations for a business."""
        query = self.db.query(Location).filter(
            Location.business_id == business_id,
            Location.deleted_at.is_(None),
        )
        if not include_inactive:
            query = query.filter(Location.is_active.is_(True))
        return query.order_by(Location.name).all()

    def get_location(self, location_id: str, business_id: str) -> Optional[Location]:
        """Get a single location with its stock levels."""
        return (
            self.db.query(Location)
            .filter(
                Location.id == location_id,
                Location.business_id == business_id,
                Location.deleted_at.is_(None),
            )
            .first()
        )

    def update_location(
        self, location_id: str, business_id: str, **kwargs
    ) -> Optional[Location]:
        """Update location fields."""
        location = self.get_location(location_id, business_id)
        if not location:
            return None
        for key, value in kwargs.items():
            if hasattr(location, key) and value is not None:
                setattr(location, key, value)
        self.db.flush()
        return location

    def delete_location(self, location_id: str, business_id: str) -> bool:
        """Soft-delete a location."""
        location = self.get_location(location_id, business_id)
        if not location:
            return False
        location.soft_delete()
        self.db.flush()
        return True

    # ── Stock levels ──────────────────────────────────────────

    def set_stock_level(
        self,
        location_id: str,
        product_id: str,
        quantity: int,
        min_quantity: int = 0,
        max_quantity: Optional[int] = None,
    ) -> LocationStock:
        """Set / upsert stock level for a product at a location."""
        stock = (
            self.db.query(LocationStock)
            .filter(
                LocationStock.location_id == location_id,
                LocationStock.product_id == product_id,
                LocationStock.deleted_at.is_(None),
            )
            .first()
        )
        if stock:
            stock.quantity = quantity
            stock.min_quantity = min_quantity
            stock.max_quantity = max_quantity
        else:
            stock = LocationStock(
                location_id=location_id,
                product_id=product_id,
                quantity=quantity,
                min_quantity=min_quantity,
                max_quantity=max_quantity,
            )
            self.db.add(stock)
        self.db.flush()
        return stock

    def get_stock_levels(
        self, location_id: str, page: int = 1, per_page: int = 20
    ) -> Tuple[List[LocationStock], int]:
        """Get stock levels at a location with pagination."""
        query = self.db.query(LocationStock).filter(
            LocationStock.location_id == location_id,
            LocationStock.deleted_at.is_(None),
        )
        total = query.count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()
        return items, total

    def get_product_across_locations(
        self, business_id: str, product_id: str
    ) -> List[LocationStock]:
        """Get stock for a product across all active locations."""
        return (
            self.db.query(LocationStock)
            .join(Location, Location.id == LocationStock.location_id)
            .filter(
                Location.business_id == business_id,
                Location.deleted_at.is_(None),
                Location.is_active.is_(True),
                LocationStock.product_id == product_id,
                LocationStock.deleted_at.is_(None),
            )
            .all()
        )

    # ── Transfers ─────────────────────────────────────────────

    def _generate_reference(self) -> str:
        now = datetime.now(timezone.utc)
        short = uuid.uuid4().hex[:4].upper()
        return f"TRF-{now.strftime('%Y%m%d')}-{short}"

    def create_transfer(
        self,
        business_id: str,
        from_location_id: str,
        to_location_id: str,
        items: list,
        notes: Optional[str] = None,
        initiated_by: Optional[str] = None,
    ) -> StockTransfer:
        """Create a stock transfer between locations."""
        transfer = StockTransfer(
            business_id=business_id,
            from_location_id=from_location_id,
            to_location_id=to_location_id,
            status=TransferStatus.PENDING,
            reference_number=self._generate_reference(),
            notes=notes,
            initiated_by=initiated_by,
        )
        self.db.add(transfer)
        self.db.flush()

        for item in items:
            ti = StockTransferItem(
                transfer_id=transfer.id,
                product_id=item["product_id"],
                quantity=item["quantity"],
            )
            self.db.add(ti)
        self.db.flush()
        self.db.refresh(transfer)
        return transfer

    def list_transfers(
        self,
        business_id: str,
        status: Optional[TransferStatus] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[StockTransfer], int]:
        """List transfers with optional status filter and pagination."""
        query = self.db.query(StockTransfer).filter(
            StockTransfer.business_id == business_id,
            StockTransfer.deleted_at.is_(None),
        )
        if status:
            query = query.filter(StockTransfer.status == status)
        total = query.count()
        items = (
            query.order_by(StockTransfer.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_transfer(
        self, transfer_id: str, business_id: str
    ) -> Optional[StockTransfer]:
        """Get a single transfer with its items."""
        return (
            self.db.query(StockTransfer)
            .filter(
                StockTransfer.id == transfer_id,
                StockTransfer.business_id == business_id,
                StockTransfer.deleted_at.is_(None),
            )
            .first()
        )

    def receive_transfer(
        self,
        transfer_id: str,
        business_id: str,
        received_items: list,
    ) -> Optional[StockTransfer]:
        """
        Mark a transfer as received and update stock levels.

        received_items: list of {product_id, received_quantity}
        """
        transfer = self.get_transfer(transfer_id, business_id)
        if not transfer or transfer.status not in (
            TransferStatus.PENDING,
            TransferStatus.IN_TRANSIT,
        ):
            return None

        received_map = {
            str(ri["product_id"]): ri["received_quantity"] for ri in received_items
        }

        for ti in transfer.items:
            pid = str(ti.product_id)
            qty = received_map.get(pid, ti.quantity)
            ti.received_quantity = qty

            # Decrease stock at source
            src = (
                self.db.query(LocationStock)
                .filter(
                    LocationStock.location_id == transfer.from_location_id,
                    LocationStock.product_id == ti.product_id,
                    LocationStock.deleted_at.is_(None),
                )
                .first()
            )
            if src:
                src.quantity = max(0, src.quantity - qty)

            # Increase stock at destination (upsert)
            dst = (
                self.db.query(LocationStock)
                .filter(
                    LocationStock.location_id == transfer.to_location_id,
                    LocationStock.product_id == ti.product_id,
                    LocationStock.deleted_at.is_(None),
                )
                .first()
            )
            if dst:
                dst.quantity += qty
            else:
                dst = LocationStock(
                    location_id=transfer.to_location_id,
                    product_id=ti.product_id,
                    quantity=qty,
                )
                self.db.add(dst)

        transfer.status = TransferStatus.RECEIVED
        self.db.flush()
        self.db.refresh(transfer)
        return transfer

    def cancel_transfer(
        self, transfer_id: str, business_id: str
    ) -> Optional[StockTransfer]:
        """Cancel a pending transfer."""
        transfer = self.get_transfer(transfer_id, business_id)
        if not transfer or transfer.status != TransferStatus.PENDING:
            return None
        transfer.status = TransferStatus.CANCELLED
        self.db.flush()
        return transfer

    # ── Alerts ────────────────────────────────────────────────

    def get_low_stock_alerts(self, business_id: str) -> List[LocationStock]:
        """Products below min_quantity at any location."""
        return (
            self.db.query(LocationStock)
            .join(Location, Location.id == LocationStock.location_id)
            .filter(
                Location.business_id == business_id,
                Location.deleted_at.is_(None),
                Location.is_active.is_(True),
                LocationStock.deleted_at.is_(None),
                LocationStock.quantity < LocationStock.min_quantity,
                LocationStock.min_quantity > 0,
            )
            .all()
        )
