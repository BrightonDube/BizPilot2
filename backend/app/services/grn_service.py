"""Goods Received Note (GRN) service.

Manages the formal receiving workflow: creating GRN documents,
tracking variances, and updating both PO item quantities and
product stock levels upon receiving.

Why a separate GRN service instead of extending ReorderService?
Receiving is a distinct domain concern (warehouse ops) from reorder
orchestration (procurement).  Keeping them in separate services makes
each easier to test and evolve independently.
"""

from datetime import datetime
from typing import List, Optional, Tuple
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.reorder import (
    GoodsReceivedNote,
    GRNItem,
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrderStatus,
    ReorderAuditLog,
)
from app.schemas.reorder import GRNCreate


class GRNService:
    """Service for goods receiving workflow against purchase orders."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # GRN number generation
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_grn_number() -> str:
        """Generate a unique GRN reference number.

        Why timestamp + UUID suffix instead of auto-increment?
        Distributed systems can't guarantee sequential counters.
        A time-based prefix gives human-readable ordering while the
        UUID suffix guarantees uniqueness.
        """
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        suffix = uuid4().hex[:6].upper()
        return f"GRN-{ts}-{suffix}"

    # ------------------------------------------------------------------
    # Create GRN (receive goods)
    # ------------------------------------------------------------------

    def create_grn(
        self,
        data: GRNCreate,
        business_id: UUID,
        received_by: Optional[UUID] = None,
    ) -> GoodsReceivedNote:
        """Create a goods received note and update PO item received quantities.

        Steps:
        1. Validate the PO exists and is in a receivable state.
        2. Create the GRN header.
        3. For each item: create GRN line, update PO item received_quantity,
           update product stock.
        4. If all PO items fully received, mark PO as RECEIVED;
           otherwise mark PARTIALLY_RECEIVED.
        5. Log the action to the audit trail.
        """
        # Validate purchase order
        po = (
            self.db.query(PurchaseRequest)
            .filter(
                PurchaseRequest.id == str(data.purchase_order_id),
                PurchaseRequest.business_id == str(business_id),
                PurchaseRequest.deleted_at.is_(None),
            )
            .first()
        )

        if not po:
            raise ValueError("Purchase order not found")

        receivable_statuses = {
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.ORDERED,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
        }
        if po.status not in receivable_statuses:
            raise ValueError(
                f"Purchase order status '{po.status.value}' is not receivable. "
                f"Must be one of: {', '.join(s.value for s in receivable_statuses)}"
            )

        # Create GRN header
        grn = GoodsReceivedNote(
            id=uuid4(),
            purchase_order_id=po.id,
            business_id=business_id,
            grn_number=self._generate_grn_number(),
            received_by=received_by,
            received_at=datetime.utcnow(),
            notes=data.notes,
        )
        self.db.add(grn)
        self.db.flush()

        # Process each item
        for item_data in data.items:
            po_item = (
                self.db.query(PurchaseRequestItem)
                .filter(
                    PurchaseRequestItem.id == str(item_data.po_item_id),
                    PurchaseRequestItem.request_id == po.id,
                )
                .first()
            )

            if not po_item:
                raise ValueError(
                    f"PO item {item_data.po_item_id} not found on this purchase order"
                )

            # Create GRN line item
            grn_item = GRNItem(
                id=uuid4(),
                grn_id=grn.id,
                po_item_id=po_item.id,
                quantity_received=item_data.quantity_received,
                variance=item_data.variance,
                variance_reason=item_data.variance_reason,
            )
            self.db.add(grn_item)

            # Update PO item received quantity
            po_item.received_quantity = (
                (po_item.received_quantity or 0) + item_data.quantity_received
            )

            # Update product stock level
            product = (
                self.db.query(Product)
                .filter(Product.id == po_item.product_id)
                .first()
            )
            if product:
                product.stock_quantity = (
                    (product.stock_quantity or 0) + item_data.quantity_received
                )

        # Update PO status based on whether all items are fully received
        all_received = all(
            (item.received_quantity or 0) >= item.quantity
            for item in po.items
        )
        if all_received:
            po.status = PurchaseOrderStatus.RECEIVED
        else:
            po.status = PurchaseOrderStatus.PARTIALLY_RECEIVED

        # Audit log
        audit = ReorderAuditLog(
            id=uuid4(),
            business_id=business_id,
            action="goods_received",
            entity_type="goods_received_note",
            entity_id=grn.id,
            details={
                "grn_number": grn.grn_number,
                "po_reference": po.reference,
                "items_count": len(data.items),
                "po_status": po.status.value,
            },
            performed_by=received_by,
            is_automated=False,
        )
        self.db.add(audit)

        self.db.commit()
        self.db.refresh(grn)
        return grn

    # ------------------------------------------------------------------
    # List GRNs for a PO
    # ------------------------------------------------------------------

    def list_grns(
        self,
        business_id: UUID,
        *,
        purchase_order_id: Optional[UUID] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[GoodsReceivedNote], int]:
        """List goods received notes, optionally filtered by PO."""
        query = self.db.query(GoodsReceivedNote).filter(
            GoodsReceivedNote.business_id == str(business_id),
            GoodsReceivedNote.deleted_at.is_(None),
        )

        if purchase_order_id:
            query = query.filter(
                GoodsReceivedNote.purchase_order_id == str(purchase_order_id)
            )

        query = query.order_by(GoodsReceivedNote.received_at.desc())
        total = query.count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()
        return items, total

    # ------------------------------------------------------------------
    # Get single GRN
    # ------------------------------------------------------------------

    def get_grn(self, grn_id: UUID, business_id: UUID) -> Optional[GoodsReceivedNote]:
        """Get a single GRN by ID."""
        return (
            self.db.query(GoodsReceivedNote)
            .filter(
                GoodsReceivedNote.id == str(grn_id),
                GoodsReceivedNote.business_id == str(business_id),
                GoodsReceivedNote.deleted_at.is_(None),
            )
            .first()
        )
