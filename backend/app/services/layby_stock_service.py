"""Stock reservation service for layby inventory management.

Manages stock reservations through the layby lifecycle: reserve on creation,
release on cancellation, and collect (remove from inventory) on completion.

Validates: Requirements 9.1-9.7
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem, InventoryTransaction, TransactionType
from app.models.stock_reservation import StockReservation


class LaybyStockService:
    """Service for managing stock reservations tied to laybys."""

    def __init__(self, db: Session):
        self.db = db

    def check_availability(
        self,
        items: List[dict],
        business_id: UUID,
        location_id: Optional[UUID] = None,
    ) -> Tuple[bool, List[str]]:
        """Validate that all items have sufficient stock for reservation.

        Args:
            items: List of dicts with keys ``product_id`` and ``quantity``.
            business_id: Business owning the inventory.
            location_id: Optional location filter.

        Returns:
            Tuple of (all_available, list_of_error_messages).
        """
        errors: List[str] = []
        for item in items:
            product_id = item["product_id"]
            required_qty = int(item.get("quantity", 1))

            inv = self._get_inventory_item(product_id, business_id, location_id)
            if inv is None:
                errors.append(
                    f"Product {item.get('product_name', product_id)} has no inventory record."
                )
                continue

            available = inv.quantity_available
            if available < required_qty:
                errors.append(
                    f"Insufficient stock for {item.get('product_name', product_id)}: "
                    f"available {available}, requested {required_qty}."
                )

        return (len(errors) == 0, errors)

    def reserve_stock(
        self,
        layby_id: UUID,
        items: List[dict],
        business_id: UUID,
        location_id: Optional[UUID] = None,
    ) -> List[StockReservation]:
        """Reserve stock for a newly created layby.

        Creates StockReservation records and increments ``quantity_reserved``
        on each InventoryItem.  An InventoryTransaction is logged for auditability.

        Args:
            layby_id: The layby these reservations belong to.
            items: List of dicts with ``product_id``, ``quantity``, and optionally
                   ``product_name`` and ``unit_price``.
            business_id: Business owning the inventory.
            location_id: Optional location for location-scoped reservation.

        Returns:
            List of created StockReservation instances.

        Raises:
            ValueError: If any product has insufficient available stock.
        """
        all_ok, errors = self.check_availability(items, business_id, location_id)
        if not all_ok:
            raise ValueError("Insufficient stock: " + "; ".join(errors))

        reservations: List[StockReservation] = []
        now = datetime.now(timezone.utc)

        for item in items:
            product_id = str(item["product_id"])
            quantity = int(item.get("quantity", 1))

            inv = self._get_inventory_item(item["product_id"], business_id, location_id)

            # Create reservation record (Req 9.1)
            reservation = StockReservation(
                layby_id=str(layby_id),
                product_id=product_id,
                location_id=str(location_id) if location_id else None,
                quantity=quantity,
                status="reserved",
                reserved_at=now,
            )
            self.db.add(reservation)

            # Update inventory reserved count (Req 9.4)
            qty_before = inv.quantity_reserved or 0
            inv.quantity_reserved = qty_before + quantity

            # Audit transaction
            self._log_transaction(
                business_id=business_id,
                product_id=item["product_id"],
                inventory_item=inv,
                transaction_type=TransactionType.ADJUSTMENT,
                quantity_change=0,  # on_hand unchanged; reserved increased
                reference_type="layby_reservation",
                reference_id=layby_id,
                notes=f"Reserved {quantity} unit(s) for layby",
            )

            reservations.append(reservation)

        return reservations

    def release_stock(
        self,
        layby_id: UUID,
        business_id: UUID,
    ) -> int:
        """Release reserved stock when a layby is cancelled.

        Updates each StockReservation status to ``released`` and decrements
        ``quantity_reserved`` on the corresponding InventoryItem.

        Args:
            layby_id: The layby whose reservations should be released.
            business_id: Business owning the inventory.

        Returns:
            Total number of units released.
        """
        reservations = (
            self.db.query(StockReservation)
            .filter(
                StockReservation.layby_id == str(layby_id),
                StockReservation.status == "reserved",
            )
            .all()
        )

        total_released = 0
        now = datetime.now(timezone.utc)

        for res in reservations:
            res.status = "released"
            res.released_at = now

            inv = self._get_inventory_item(res.product_id, business_id)
            if inv:
                inv.quantity_reserved = max(0, (inv.quantity_reserved or 0) - res.quantity)

                self._log_transaction(
                    business_id=business_id,
                    product_id=res.product_id,
                    inventory_item=inv,
                    transaction_type=TransactionType.ADJUSTMENT,
                    quantity_change=0,
                    reference_type="layby_release",
                    reference_id=layby_id,
                    notes=f"Released {res.quantity} unit(s) — layby cancelled",
                )

            total_released += res.quantity

        return total_released

    def collect_stock(
        self,
        layby_id: UUID,
        business_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> int:
        """Finalise stock for a collected layby.

        Decrements both ``quantity_on_hand`` and ``quantity_reserved`` on the
        InventoryItem, effectively removing the stock from inventory.  A SALE
        transaction is recorded for each product.

        Args:
            layby_id: The layby being collected.
            business_id: Business owning the inventory.
            user_id: The user collecting the items (for audit).

        Returns:
            Total number of units removed from inventory.
        """
        reservations = (
            self.db.query(StockReservation)
            .filter(
                StockReservation.layby_id == str(layby_id),
                StockReservation.status == "reserved",
            )
            .all()
        )

        total_collected = 0
        now = datetime.now(timezone.utc)

        for res in reservations:
            res.status = "collected"
            res.released_at = now

            inv = self._get_inventory_item(res.product_id, business_id)
            if inv:
                qty_before = inv.quantity_on_hand or 0
                inv.quantity_on_hand = max(0, qty_before - res.quantity)
                inv.quantity_reserved = max(0, (inv.quantity_reserved or 0) - res.quantity)
                inv.last_sold_at = now

                self._log_transaction(
                    business_id=business_id,
                    product_id=res.product_id,
                    inventory_item=inv,
                    transaction_type=TransactionType.SALE,
                    quantity_change=-res.quantity,
                    reference_type="layby_collection",
                    reference_id=layby_id,
                    notes=f"Collected {res.quantity} unit(s) — layby completed",
                    user_id=user_id,
                    qty_before=qty_before,
                )

            total_collected += res.quantity

        return total_collected

    def get_reserved_quantity(
        self,
        product_id: UUID,
        business_id: UUID,
        location_id: Optional[UUID] = None,
    ) -> int:
        """Return total reserved quantity for a product across active laybys.

        Args:
            product_id: The product to check.
            business_id: Business scope.
            location_id: Optional location filter.

        Returns:
            Sum of reserved quantities.
        """
        from sqlalchemy import func as sa_func

        query = (
            self.db.query(sa_func.coalesce(sa_func.sum(StockReservation.quantity), 0))
            .filter(
                StockReservation.product_id == str(product_id),
                StockReservation.status == "reserved",
            )
        )
        if location_id:
            query = query.filter(StockReservation.location_id == str(location_id))

        return int(query.scalar())

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_inventory_item(
        self,
        product_id: UUID,
        business_id: UUID,
        location_id: Optional[UUID] = None,
    ) -> Optional[InventoryItem]:
        """Look up the InventoryItem for a product in a business."""
        query = self.db.query(InventoryItem).filter(
            InventoryItem.product_id == str(product_id),
            InventoryItem.business_id == str(business_id),
        )
        if location_id:
            query = query.filter(InventoryItem.location == str(location_id))
        return query.first()

    def _log_transaction(
        self,
        business_id: UUID,
        product_id: UUID,
        inventory_item: InventoryItem,
        transaction_type: TransactionType,
        quantity_change: int,
        reference_type: str,
        reference_id: UUID,
        notes: str,
        user_id: Optional[UUID] = None,
        qty_before: Optional[int] = None,
    ) -> None:
        """Create an InventoryTransaction audit record."""
        if qty_before is None:
            qty_before = inventory_item.quantity_on_hand or 0

        txn = InventoryTransaction(
            business_id=str(business_id),
            product_id=str(product_id),
            inventory_item_id=str(inventory_item.id) if inventory_item.id else None,
            transaction_type=transaction_type,
            quantity_change=quantity_change,
            quantity_before=qty_before,
            quantity_after=max(0, qty_before + quantity_change),
            unit_cost=inventory_item.average_cost,
            total_cost=(
                Decimal(str(abs(quantity_change))) * (inventory_item.average_cost or Decimal("0"))
                if quantity_change != 0
                else Decimal("0")
            ),
            reference_type=reference_type,
            reference_id=str(reference_id),
            notes=notes,
            user_id=str(user_id) if user_id else None,
        )
        self.db.add(txn)
