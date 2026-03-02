"""Tracked bulk operation service with progress, validation, and audit.

This service wraps the existing BulkOperationsService with operation
tracking, per-item status recording, before/after snapshots, and
error handling.  It is the central orchestrator for all tracked bulk
operations.

Why a separate service?  The original BulkOperationsService returns
simple counts and commits immediately.  This service creates a
BulkOperation header, processes items one-by-one with snapshots, and
tracks success/failure per record — enabling progress monitoring,
partial rollback, and audit queries.
"""

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.base import utc_now
from app.models.bulk_operation import (
    BulkOperation,
    BulkOperationItem,
    BulkOperationType,
    ItemStatus,
    OperationStatus,
)
from app.models.customer import Customer
from app.models.inventory import InventoryItem
from app.models.product import Product, ProductStatus
from app.models.product_supplier import ProductSupplier
from app.schemas.bulk_operations import ValidationError, ValidationResult

logger = logging.getLogger(__name__)


class TrackedBulkOperationService:
    """Service for creating and executing tracked bulk operations.

    Every operation is persisted as a BulkOperation with per-record
    BulkOperationItems.  This enables:
    - Progress tracking (processed / total counters)
    - Before/after audit snapshots
    - Partial rollback via stored before_data
    - Error isolation (one bad record doesn't abort the batch)
    """

    def __init__(self, db: Session):
        self.db = db

    # ── Operation lifecycle ──────────────────────────────────────────────

    def create_operation(
        self,
        *,
        operation_type: BulkOperationType,
        user_id: str,
        business_id: str,
        total_records: int,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> BulkOperation:
        """Create a new pending bulk operation header."""
        operation = BulkOperation(
            id=uuid.uuid4(),
            operation_type=operation_type.value,
            status=OperationStatus.PENDING.value,
            user_id=user_id,
            business_id=business_id,
            total_records=total_records,
            # Why: Explicitly zero-initialize counters so the object is valid
            # even before a DB flush applies column defaults.  This prevents
            # NoneType arithmetic errors when the service increments counters
            # during execution (and makes unit-testing with mocked sessions
            # straightforward).
            processed_records=0,
            successful_records=0,
            failed_records=0,
            parameters=parameters or {},
        )
        self.db.add(operation)
        self.db.flush()
        return operation

    def get_operation(self, operation_id: str) -> Optional[BulkOperation]:
        """Retrieve a single operation by ID."""
        return self.db.query(BulkOperation).filter(
            BulkOperation.id == operation_id
        ).first()

    def list_operations(
        self,
        business_id: str,
        *,
        page: int = 1,
        per_page: int = 20,
        status: Optional[str] = None,
        operation_type: Optional[str] = None,
    ) -> Tuple[List[BulkOperation], int]:
        """List operations for a business with optional filtering."""
        query = self.db.query(BulkOperation).filter(
            and_(
                BulkOperation.business_id == business_id,
                BulkOperation.deleted_at.is_(None),
            )
        )
        if status:
            query = query.filter(BulkOperation.status == status)
        if operation_type:
            query = query.filter(BulkOperation.operation_type == operation_type)

        total = query.count()
        items = (
            query.order_by(BulkOperation.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def cancel_operation(self, operation_id: str) -> bool:
        """Cancel a pending or processing operation.

        Returns True if cancelled, False if operation is already terminal.
        """
        op = self.get_operation(operation_id)
        if not op or op.is_terminal:
            return False

        op.status = OperationStatus.CANCELLED.value
        op.completed_at = utc_now()
        self.db.commit()
        return True

    # ── Validation / preview ─────────────────────────────────────────────

    def validate_price_update(
        self,
        business_id: str,
        product_ids: List[str],
        adjustment_type: str,
        adjustment_value: float,
    ) -> ValidationResult:
        """Dry-run validation for a price update operation.

        Checks that all product IDs exist, that the adjustment type is
        valid, and that resulting prices would be non-negative.
        """
        errors: List[ValidationError] = []
        warnings: List[str] = []

        # Validate adjustment type
        valid_types = ("percentage", "fixed", "increment")
        if adjustment_type not in valid_types:
            errors.append(ValidationError(
                message=f"Invalid adjustment_type '{adjustment_type}'. Must be one of: {valid_types}"
            ))
            return ValidationResult(
                is_valid=False,
                total_records=len(product_ids),
                valid_records=0,
                invalid_records=len(product_ids),
                errors=errors,
            )

        products = (
            self.db.query(Product)
            .filter(
                and_(
                    Product.business_id == business_id,
                    Product.id.in_(product_ids),
                    Product.deleted_at.is_(None),
                )
            )
            .all()
        )
        found_ids = {str(p.id) for p in products}
        valid_count = 0

        # Check for missing products
        for pid in product_ids:
            if pid not in found_ids:
                errors.append(ValidationError(
                    record_id=pid,
                    message=f"Product {pid} not found",
                ))

        # Check resulting prices
        for product in products:
            price = float(product.selling_price or 0)
            if adjustment_type == "percentage":
                new_price = price * (1 + adjustment_value / 100)
            elif adjustment_type == "fixed":
                new_price = adjustment_value
            elif adjustment_type == "increment":
                new_price = price + adjustment_value
            else:
                new_price = price

            if new_price < 0:
                errors.append(ValidationError(
                    record_id=str(product.id),
                    field="selling_price",
                    message=f"Resulting price would be negative ({new_price:.2f})",
                ))
            else:
                valid_count += 1

        return ValidationResult(
            is_valid=len(errors) == 0,
            total_records=len(product_ids),
            valid_records=valid_count,
            invalid_records=len(product_ids) - valid_count,
            errors=errors,
            warnings=warnings,
        )

    def validate_stock_adjustment(
        self,
        business_id: str,
        adjustments: List[Dict[str, Any]],
    ) -> ValidationResult:
        """Dry-run validation for stock adjustments.

        Checks that inventory items exist and resulting quantities stay ≥ 0.
        """
        errors: List[ValidationError] = []
        valid_count = 0

        for idx, adj in enumerate(adjustments):
            product_id = adj.get("product_id")
            qty_change = adj.get("quantity_change", 0)

            item = (
                self.db.query(InventoryItem)
                .filter(
                    and_(
                        InventoryItem.business_id == business_id,
                        InventoryItem.product_id == product_id,
                        InventoryItem.deleted_at.is_(None),
                    )
                )
                .first()
            )

            if not item:
                errors.append(ValidationError(
                    row=idx,
                    record_id=product_id,
                    message=f"Inventory item for product {product_id} not found",
                ))
                continue

            new_qty = float(item.quantity_on_hand or 0) + qty_change
            if new_qty < 0:
                errors.append(ValidationError(
                    row=idx,
                    record_id=product_id,
                    field="quantity_on_hand",
                    message=f"Resulting quantity would be negative ({new_qty})",
                ))
            else:
                valid_count += 1

        return ValidationResult(
            is_valid=len(errors) == 0,
            total_records=len(adjustments),
            valid_records=valid_count,
            invalid_records=len(adjustments) - valid_count,
            errors=errors,
        )

    # ── Tracked execution ────────────────────────────────────────────────

    def execute_price_update(
        self,
        user_id: str,
        business_id: str,
        product_ids: List[str],
        adjustment_type: str,
        adjustment_value: float,
    ) -> BulkOperation:
        """Execute a tracked price update across products.

        Creates a BulkOperation + per-product BulkOperationItems with
        before/after snapshots.  Each product is processed independently
        so one failure doesn't abort the batch.
        """
        operation = self.create_operation(
            operation_type=BulkOperationType.PRICE_UPDATE,
            user_id=user_id,
            business_id=business_id,
            total_records=len(product_ids),
            parameters={
                "adjustment_type": adjustment_type,
                "adjustment_value": adjustment_value,
                "product_ids": product_ids,
            },
        )
        operation.status = OperationStatus.PROCESSING.value
        operation.started_at = utc_now()
        self.db.flush()

        products = (
            self.db.query(Product)
            .filter(
                and_(
                    Product.business_id == business_id,
                    Product.id.in_(product_ids),
                    Product.deleted_at.is_(None),
                )
            )
            .all()
        )
        product_map = {str(p.id): p for p in products}

        for pid in product_ids:
            product = product_map.get(pid)
            item = BulkOperationItem(
                id=uuid.uuid4(),
                bulk_operation_id=operation.id,
                record_id=pid if product else None,
            )

            if not product:
                item.status = ItemStatus.FAILED.value
                item.error_message = f"Product {pid} not found"
                item.processed_at = utc_now()
                self.db.add(item)
                operation.failed_records += 1
                operation.processed_records += 1
                continue

            try:
                old_price = float(product.selling_price or 0)
                item.before_data = {"selling_price": old_price}

                if adjustment_type == "percentage":
                    factor = Decimal(str(1 + adjustment_value / 100))
                    product.selling_price = (product.selling_price * factor).quantize(Decimal("0.01"))
                elif adjustment_type == "fixed":
                    product.selling_price = Decimal(str(adjustment_value))
                elif adjustment_type == "increment":
                    product.selling_price = (
                        product.selling_price + Decimal(str(adjustment_value))
                    ).quantize(Decimal("0.01"))

                item.after_data = {"selling_price": float(product.selling_price)}
                item.status = ItemStatus.SUCCESS.value
                item.processed_at = utc_now()
                operation.successful_records += 1

            except Exception as exc:
                item.status = ItemStatus.FAILED.value
                item.error_message = str(exc)
                item.processed_at = utc_now()
                operation.failed_records += 1
                logger.error("Price update failed for product %s: %s", pid, exc)

            self.db.add(item)
            operation.processed_records += 1

        # Finalise
        operation.status = (
            OperationStatus.COMPLETED.value
            if operation.failed_records == 0
            else OperationStatus.COMPLETED.value  # completed with partial failures
        )
        if operation.successful_records == 0 and operation.failed_records > 0:
            operation.status = OperationStatus.FAILED.value
            operation.error_summary = "All records failed"

        operation.completed_at = utc_now()
        self.db.commit()
        return operation

    def execute_stock_adjustment(
        self,
        user_id: str,
        business_id: str,
        adjustments: List[Dict[str, Any]],
    ) -> BulkOperation:
        """Execute tracked stock adjustments with per-item audit trail."""
        operation = self.create_operation(
            operation_type=BulkOperationType.STOCK_ADJUSTMENT,
            user_id=user_id,
            business_id=business_id,
            total_records=len(adjustments),
            parameters={"adjustments": adjustments},
        )
        operation.status = OperationStatus.PROCESSING.value
        operation.started_at = utc_now()
        self.db.flush()

        for adj in adjustments:
            product_id = adj.get("product_id")
            qty_change = adj.get("quantity_change", 0)
            reason = adj.get("reason", "")

            item = BulkOperationItem(
                id=uuid.uuid4(),
                bulk_operation_id=operation.id,
                record_id=product_id,
            )

            inv = (
                self.db.query(InventoryItem)
                .filter(
                    and_(
                        InventoryItem.business_id == business_id,
                        InventoryItem.product_id == product_id,
                        InventoryItem.deleted_at.is_(None),
                    )
                )
                .first()
            )

            if not inv:
                item.status = ItemStatus.FAILED.value
                item.error_message = f"Inventory item not found for product {product_id}"
                item.processed_at = utc_now()
                self.db.add(item)
                operation.failed_records += 1
                operation.processed_records += 1
                continue

            try:
                old_qty = float(inv.quantity_on_hand or 0)
                item.before_data = {"quantity_on_hand": old_qty, "reason": reason}

                inv.quantity_on_hand = (inv.quantity_on_hand or 0) + qty_change

                item.after_data = {"quantity_on_hand": float(inv.quantity_on_hand)}
                item.status = ItemStatus.SUCCESS.value
                item.processed_at = utc_now()
                operation.successful_records += 1

            except Exception as exc:
                item.status = ItemStatus.FAILED.value
                item.error_message = str(exc)
                item.processed_at = utc_now()
                operation.failed_records += 1
                logger.error("Stock adjustment failed for %s: %s", product_id, exc)

            self.db.add(item)
            operation.processed_records += 1

        self._finalise_operation(operation)
        return operation

    def execute_category_assign(
        self,
        user_id: str,
        business_id: str,
        product_ids: List[str],
        category_id: str,
    ) -> BulkOperation:
        """Execute tracked bulk category assignment."""
        operation = self.create_operation(
            operation_type=BulkOperationType.CATEGORY_ASSIGN,
            user_id=user_id,
            business_id=business_id,
            total_records=len(product_ids),
            parameters={"category_id": category_id, "product_ids": product_ids},
        )
        operation.status = OperationStatus.PROCESSING.value
        operation.started_at = utc_now()
        self.db.flush()

        products = (
            self.db.query(Product)
            .filter(
                and_(
                    Product.business_id == business_id,
                    Product.id.in_(product_ids),
                    Product.deleted_at.is_(None),
                )
            )
            .all()
        )
        product_map = {str(p.id): p for p in products}

        for pid in product_ids:
            product = product_map.get(pid)
            item = BulkOperationItem(
                id=uuid.uuid4(),
                bulk_operation_id=operation.id,
                record_id=pid if product else None,
            )

            if not product:
                item.status = ItemStatus.FAILED.value
                item.error_message = f"Product {pid} not found"
                item.processed_at = utc_now()
                self.db.add(item)
                operation.failed_records += 1
                operation.processed_records += 1
                continue

            try:
                item.before_data = {"category_id": str(product.category_id) if product.category_id else None}
                product.category_id = category_id
                item.after_data = {"category_id": category_id}
                item.status = ItemStatus.SUCCESS.value
                item.processed_at = utc_now()
                operation.successful_records += 1
            except Exception as exc:
                item.status = ItemStatus.FAILED.value
                item.error_message = str(exc)
                item.processed_at = utc_now()
                operation.failed_records += 1

            self.db.add(item)
            operation.processed_records += 1

        self._finalise_operation(operation)
        return operation

    def execute_supplier_assign(
        self,
        user_id: str,
        business_id: str,
        product_ids: List[str],
        supplier_id: str,
        is_primary: bool = False,
    ) -> BulkOperation:
        """Execute tracked bulk supplier assignment.

        Creates or updates ProductSupplier records for each product.
        """
        operation = self.create_operation(
            operation_type=BulkOperationType.SUPPLIER_ASSIGN,
            user_id=user_id,
            business_id=business_id,
            total_records=len(product_ids),
            parameters={
                "supplier_id": supplier_id,
                "is_primary": is_primary,
                "product_ids": product_ids,
            },
        )
        operation.status = OperationStatus.PROCESSING.value
        operation.started_at = utc_now()
        self.db.flush()

        for pid in product_ids:
            item = BulkOperationItem(
                id=uuid.uuid4(),
                bulk_operation_id=operation.id,
                record_id=pid,
            )

            try:
                # Check if ProductSupplier link already exists
                existing = (
                    self.db.query(ProductSupplier)
                    .filter(
                        and_(
                            ProductSupplier.product_id == pid,
                            ProductSupplier.supplier_id == supplier_id,
                            ProductSupplier.deleted_at.is_(None),
                        )
                    )
                    .first()
                )

                if existing:
                    item.before_data = {"is_primary": existing.is_primary}
                    existing.is_primary = is_primary
                    item.after_data = {"is_primary": is_primary}
                    item.status = ItemStatus.SUCCESS.value
                else:
                    ps = ProductSupplier(
                        id=uuid.uuid4(),
                        product_id=pid,
                        supplier_id=supplier_id,
                        is_primary=is_primary,
                    )
                    self.db.add(ps)
                    item.before_data = None
                    item.after_data = {
                        "supplier_id": supplier_id,
                        "is_primary": is_primary,
                    }
                    item.status = ItemStatus.SUCCESS.value

                item.processed_at = utc_now()
                operation.successful_records += 1

            except Exception as exc:
                item.status = ItemStatus.FAILED.value
                item.error_message = str(exc)
                item.processed_at = utc_now()
                operation.failed_records += 1
                logger.error("Supplier assign failed for product %s: %s", pid, exc)

            self.db.add(item)
            operation.processed_records += 1

        self._finalise_operation(operation)
        return operation

    # ── Rollback ─────────────────────────────────────────────────────────

    def rollback_operation(self, operation_id: str) -> Tuple[int, int]:
        """Roll back a completed operation using stored before_data snapshots.

        Returns (rolled_back_count, failed_count).

        Why partial rollback?  Some items may have already been modified by
        later operations.  We attempt each independently and report failures.
        """
        operation = self.get_operation(operation_id)
        if not operation:
            return 0, 0

        operation.status = OperationStatus.ROLLING_BACK.value
        self.db.flush()

        rolled_back = 0
        failed = 0

        items = (
            self.db.query(BulkOperationItem)
            .filter(
                and_(
                    BulkOperationItem.bulk_operation_id == operation_id,
                    BulkOperationItem.status == ItemStatus.SUCCESS.value,
                    BulkOperationItem.before_data.isnot(None),
                )
            )
            .all()
        )

        for item in items:
            try:
                self._rollback_item(operation, item)
                item.status = ItemStatus.SKIPPED.value  # Mark as rolled back
                rolled_back += 1
            except Exception as exc:
                item.error_message = f"Rollback failed: {exc}"
                failed += 1
                logger.error("Rollback failed for item %s: %s", item.id, exc)

        operation.status = OperationStatus.COMPLETED.value
        operation.error_summary = f"Rollback: {rolled_back} restored, {failed} failed"
        self.db.commit()
        return rolled_back, failed

    def _rollback_item(self, operation: BulkOperation, item: BulkOperationItem) -> None:
        """Restore a single item to its before_data state."""
        if not item.before_data or not item.record_id:
            return

        op_type = operation.operation_type

        if op_type == BulkOperationType.PRICE_UPDATE.value:
            product = self.db.query(Product).filter(Product.id == item.record_id).first()
            if product and "selling_price" in item.before_data:
                product.selling_price = Decimal(str(item.before_data["selling_price"]))

        elif op_type == BulkOperationType.STOCK_ADJUSTMENT.value:
            inv = (
                self.db.query(InventoryItem)
                .filter(InventoryItem.product_id == item.record_id)
                .first()
            )
            if inv and "quantity_on_hand" in item.before_data:
                inv.quantity_on_hand = item.before_data["quantity_on_hand"]

        elif op_type == BulkOperationType.CATEGORY_ASSIGN.value:
            product = self.db.query(Product).filter(Product.id == item.record_id).first()
            if product and "category_id" in item.before_data:
                product.category_id = item.before_data["category_id"]

    # ── Template management ──────────────────────────────────────────────

    def get_operation_items(
        self,
        operation_id: str,
        *,
        page: int = 1,
        per_page: int = 50,
        status: Optional[str] = None,
    ) -> Tuple[List[BulkOperationItem], int]:
        """Get paginated items for an operation."""
        query = self.db.query(BulkOperationItem).filter(
            BulkOperationItem.bulk_operation_id == operation_id
        )
        if status:
            query = query.filter(BulkOperationItem.status == status)

        total = query.count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()
        return items, total

    # ── Internal helpers ─────────────────────────────────────────────────

    def _finalise_operation(self, operation: BulkOperation) -> None:
        """Set terminal status and commit."""
        if operation.successful_records == 0 and operation.failed_records > 0:
            operation.status = OperationStatus.FAILED.value
            operation.error_summary = "All records failed"
        else:
            operation.status = OperationStatus.COMPLETED.value
            if operation.failed_records > 0:
                operation.error_summary = (
                    f"{operation.failed_records} of {operation.total_records} records failed"
                )

        operation.completed_at = utc_now()
        self.db.commit()
