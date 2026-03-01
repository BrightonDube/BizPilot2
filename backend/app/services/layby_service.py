"""Layby management service for creating, paying, cancelling, and collecting laybys."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.layby import Layby, LaybyStatus, PaymentFrequency
from app.models.layby_config import LaybyConfig
from app.models.layby_item import LaybyItem
from app.models.layby_payment import LaybyPayment, PaymentType, PaymentStatus
from app.models.layby_schedule import LaybySchedule, ScheduleStatus
from app.models.layby_audit import LaybyAudit


class LaybyService:
    """Service for managing layby lifecycle operations."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_config(self, business_id: UUID, location_id: UUID = None) -> LaybyConfig:
        """Get layby configuration for a business, falling back to business-level config."""
        query = self.db.query(LaybyConfig).filter(
            LaybyConfig.business_id == str(business_id),
            LaybyConfig.deleted_at.is_(None),
        )
        if location_id:
            config = query.filter(LaybyConfig.location_id == str(location_id)).first()
            if config:
                return config
        # Fallback: business-level config (no location)
        config = query.filter(LaybyConfig.location_id.is_(None)).first()
        return config

    def _generate_reference_number(self, business_id: UUID) -> str:
        """Generate a unique reference number in LAY-YYYYMMDD-XXXX format."""
        today_str = date.today().strftime("%Y%m%d")
        prefix = f"LAY-{today_str}-"

        last = (
            self.db.query(Layby)
            .filter(
                Layby.business_id == str(business_id),
                Layby.reference_number.like(f"{prefix}%"),
            )
            .order_by(Layby.reference_number.desc())
            .first()
        )

        if last:
            try:
                last_seq = int(last.reference_number.split("-")[-1])
            except (ValueError, IndexError):
                last_seq = 0
            next_seq = last_seq + 1
        else:
            next_seq = 1

        return f"{prefix}{next_seq:04d}"

    def _calculate_installment_dates(
        self, start: date, end: date, frequency: PaymentFrequency
    ) -> List[date]:
        """Return a list of installment due dates between start and end."""
        delta_map = {
            PaymentFrequency.WEEKLY: timedelta(weeks=1),
            PaymentFrequency.BI_WEEKLY: timedelta(weeks=2),
            PaymentFrequency.MONTHLY: timedelta(days=30),
        }
        delta = delta_map[frequency]
        dates: List[date] = []
        current = start + delta
        while current <= end:
            dates.append(current)
            current += delta
        # Ensure at least one installment
        if not dates:
            dates.append(end)
        return dates

    def _create_audit(
        self,
        layby_id: UUID,
        action: str,
        performed_by: UUID,
        old_value: dict = None,
        new_value: dict = None,
        details: str = None,
    ) -> LaybyAudit:
        """Create an audit record for a layby action."""
        audit = LaybyAudit(
            layby_id=layby_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
            details=details,
            performed_by=performed_by,
        )
        self.db.add(audit)
        return audit

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    def create_layby(
        self,
        business_id: UUID,
        customer_id: UUID,
        items: List[dict],
        deposit_amount: Decimal,
        frequency: PaymentFrequency,
        created_by: UUID,
        location_id: UUID = None,
        end_date: date = None,
        notes: str = None,
    ) -> Layby:
        """Create a new layby with items and payment schedule.

        Args:
            business_id: The business UUID.
            customer_id: The customer UUID.
            items: List of dicts with keys: product_id, product_name, product_sku,
                   quantity, unit_price, discount_amount, tax_amount.
            deposit_amount: Initial deposit amount.
            frequency: Payment frequency (weekly, bi_weekly, monthly).
            created_by: User UUID who created the layby.
            location_id: Optional location UUID.
            end_date: Optional custom end date.
            notes: Optional notes.

        Returns:
            The newly created Layby instance.

        Raises:
            ValueError: If validation fails.
        """
        config = self._get_config(business_id, location_id)
        if config and not config.is_enabled:
            raise ValueError("Layby feature is disabled for this business.")

        # Calculate totals from items
        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        for item in items:
            qty = Decimal(str(item.get("quantity", 1)))
            unit_price = Decimal(str(item["unit_price"]))
            discount = Decimal(str(item.get("discount_amount", "0.00")))
            tax = Decimal(str(item.get("tax_amount", "0.00")))
            item_total = (qty * unit_price) - discount
            subtotal += item_total
            tax_total += tax

        total_amount = subtotal + tax_total

        if total_amount <= Decimal("0.00"):
            raise ValueError("Total amount must be greater than zero.")

        # Validate deposit against config minimum
        if config:
            min_deposit = total_amount * (config.min_deposit_percentage / Decimal("100"))
            if deposit_amount < min_deposit:
                raise ValueError(
                    f"Deposit must be at least {config.min_deposit_percentage}% "
                    f"of total (minimum R{min_deposit:.2f})."
                )

        if deposit_amount > total_amount:
            raise ValueError("Deposit cannot exceed total amount.")

        balance_due = total_amount - deposit_amount
        start = date.today()

        # Determine end date
        if end_date is None:
            max_days = config.max_duration_days if config else 90
            end_date = start + timedelta(days=max_days)
        elif config and (end_date - start).days > config.max_duration_days:
            raise ValueError(
                f"Layby duration cannot exceed {config.max_duration_days} days."
            )

        reference_number = self._generate_reference_number(business_id)

        # Calculate installment dates
        installment_dates = self._calculate_installment_dates(start, end_date, frequency)
        num_installments = len(installment_dates)
        installment_amount = (
            (balance_due / Decimal(str(num_installments))).quantize(Decimal("0.01"))
            if num_installments > 0
            else Decimal("0.00")
        )

        # Create layby record
        layby = Layby(
            reference_number=reference_number,
            business_id=str(business_id),
            location_id=str(location_id) if location_id else None,
            customer_id=str(customer_id),
            status=LaybyStatus.ACTIVE,
            subtotal=subtotal,
            tax_amount=tax_total,
            total_amount=total_amount,
            deposit_amount=deposit_amount,
            amount_paid=deposit_amount,
            balance_due=balance_due,
            payment_frequency=frequency,
            start_date=start,
            end_date=end_date,
            original_end_date=end_date,
            next_payment_date=installment_dates[0] if installment_dates else None,
            next_payment_amount=installment_amount,
            extension_count=0,
            notes=notes,
            created_by=created_by,
        )
        self.db.add(layby)
        self.db.flush()

        # Create line items
        for item_data in items:
            qty = int(item_data.get("quantity", 1))
            unit_price = Decimal(str(item_data["unit_price"]))
            discount = Decimal(str(item_data.get("discount_amount", "0.00")))
            tax = Decimal(str(item_data.get("tax_amount", "0.00")))
            item_total = (Decimal(str(qty)) * unit_price) - discount + tax

            li = LaybyItem(
                layby_id=layby.id,
                product_id=str(item_data["product_id"]),
                product_name=item_data["product_name"],
                product_sku=item_data.get("product_sku"),
                quantity=qty,
                unit_price=unit_price,
                discount_amount=discount,
                tax_amount=tax,
                total_amount=item_total,
                notes=item_data.get("notes"),
            )
            self.db.add(li)

        # Create deposit payment record
        deposit_payment = LaybyPayment(
            layby_id=layby.id,
            payment_type=PaymentType.DEPOSIT,
            amount=deposit_amount,
            payment_method="cash",
            status=PaymentStatus.COMPLETED,
            processed_by=created_by,
        )
        self.db.add(deposit_payment)

        # Create payment schedule entries
        for idx, due_dt in enumerate(installment_dates, start=1):
            # Last installment absorbs rounding remainder
            if idx == num_installments:
                amt = balance_due - (installment_amount * Decimal(str(num_installments - 1)))
            else:
                amt = installment_amount

            schedule = LaybySchedule(
                layby_id=layby.id,
                installment_number=idx,
                due_date=due_dt,
                amount_due=amt,
                amount_paid=Decimal("0.00"),
                status=ScheduleStatus.PENDING,
            )
            self.db.add(schedule)

        # Audit
        self._create_audit(
            layby_id=layby.id,
            action="created",
            performed_by=created_by,
            new_value={
                "reference_number": reference_number,
                "total_amount": str(total_amount),
                "deposit_amount": str(deposit_amount),
                "frequency": frequency.value,
            },
            details=f"Layby created with deposit R{deposit_amount:.2f}",
        )

        self.db.commit()
        self.db.refresh(layby)
        return layby

    def get_layby(self, business_id: UUID, layby_id: UUID) -> Optional[Layby]:
        """Get a single layby by ID, scoped to a business."""
        return (
            self.db.query(Layby)
            .filter(
                Layby.id == str(layby_id),
                Layby.business_id == str(business_id),
                Layby.deleted_at.is_(None),
            )
            .first()
        )

    def list_laybys(
        self,
        business_id: UUID,
        status: Optional[LaybyStatus] = None,
        customer_id: Optional[UUID] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Layby], int]:
        """List laybys with filtering and pagination.

        Returns:
            Tuple of (list of laybys, total count).
        """
        query = self.db.query(Layby).filter(
            Layby.business_id == str(business_id),
            Layby.deleted_at.is_(None),
        )

        if status is not None:
            query = query.filter(Layby.status == status)
        if customer_id is not None:
            query = query.filter(Layby.customer_id == str(customer_id))
        if search:
            query = query.filter(Layby.reference_number.ilike(f"%{search}%"))

        total = query.count()
        laybys = (
            query.order_by(Layby.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return laybys, total

    def make_payment(
        self,
        business_id: UUID,
        layby_id: UUID,
        amount: Decimal,
        payment_method: str,
        processed_by: UUID,
        payment_reference: str = None,
        notes: str = None,
    ) -> LaybyPayment:
        """Record a payment against a layby.

        Updates balance_due, amount_paid, schedule entries, and transitions
        status to READY_FOR_COLLECTION when fully paid.

        Raises:
            ValueError: If layby not found, not payable, or amount invalid.
        """
        layby = self.get_layby(business_id, layby_id)
        if not layby:
            raise ValueError("Layby not found.")
        if not layby.can_make_payment:
            raise ValueError("This layby is not eligible for payments.")
        if amount <= Decimal("0.00"):
            raise ValueError("Payment amount must be greater than zero.")
        if amount > layby.balance_due:
            raise ValueError(
                f"Payment amount (R{amount:.2f}) exceeds balance due (R{layby.balance_due:.2f})."
            )

        old_balance = layby.balance_due
        old_status = layby.status.value

        # Determine payment type
        new_balance = layby.balance_due - amount
        if new_balance <= Decimal("0.00"):
            payment_type = PaymentType.FINAL
        else:
            payment_type = PaymentType.INSTALLMENT

        # Find the next unpaid schedule entry and allocate payment
        remaining = amount
        schedules = (
            self.db.query(LaybySchedule)
            .filter(
                LaybySchedule.layby_id == str(layby_id),
                LaybySchedule.status.in_([ScheduleStatus.PENDING.value, ScheduleStatus.PARTIAL.value, ScheduleStatus.OVERDUE.value]),
            )
            .order_by(LaybySchedule.installment_number)
            .all()
        )

        target_schedule_id = None
        for sched in schedules:
            if remaining <= Decimal("0.00"):
                break
            sched_remaining = sched.amount_due - sched.amount_paid
            if sched_remaining <= Decimal("0.00"):
                continue
            apply = min(remaining, sched_remaining)
            sched.amount_paid += apply
            remaining -= apply

            if target_schedule_id is None:
                target_schedule_id = sched.id

            if sched.amount_paid >= sched.amount_due:
                sched.status = ScheduleStatus.PAID
                sched.paid_at = datetime.now(timezone.utc)
            else:
                sched.status = ScheduleStatus.PARTIAL

        # Create payment record
        payment = LaybyPayment(
            layby_id=layby.id,
            schedule_id=target_schedule_id,
            payment_type=payment_type,
            amount=amount,
            payment_method=payment_method,
            payment_reference=payment_reference,
            status=PaymentStatus.COMPLETED,
            notes=notes,
            processed_by=processed_by,
        )
        self.db.add(payment)

        # Update layby totals
        layby.amount_paid += amount
        layby.balance_due -= amount

        # Determine next payment info
        next_sched = (
            self.db.query(LaybySchedule)
            .filter(
                LaybySchedule.layby_id == str(layby_id),
                LaybySchedule.status.in_([ScheduleStatus.PENDING.value, ScheduleStatus.PARTIAL.value, ScheduleStatus.OVERDUE.value]),
            )
            .order_by(LaybySchedule.installment_number)
            .first()
        )
        if next_sched:
            layby.next_payment_date = next_sched.due_date
            layby.next_payment_amount = next_sched.amount_due - next_sched.amount_paid
        else:
            layby.next_payment_date = None
            layby.next_payment_amount = None

        # Status transition
        if layby.balance_due <= Decimal("0.00"):
            layby.status = LaybyStatus.READY_FOR_COLLECTION

        # Audit
        self._create_audit(
            layby_id=layby.id,
            action="payment",
            performed_by=processed_by,
            old_value={"balance_due": str(old_balance), "status": old_status},
            new_value={"balance_due": str(layby.balance_due), "status": layby.status.value},
            details=f"Payment of R{amount:.2f} via {payment_method}",
        )

        self.db.commit()
        self.db.refresh(payment)
        return payment

    def cancel_layby(
        self,
        business_id: UUID,
        layby_id: UUID,
        reason: str,
        cancelled_by: UUID,
    ) -> Layby:
        """Cancel a layby, calculate cancellation fee, and create a refund record.

        Raises:
            ValueError: If layby cannot be cancelled.
        """
        layby = self.get_layby(business_id, layby_id)
        if not layby:
            raise ValueError("Layby not found.")
        if not layby.can_be_cancelled:
            raise ValueError("This layby cannot be cancelled.")

        config = self._get_config(business_id, layby.location_id)
        old_status = layby.status.value

        # Calculate cancellation fee
        cancellation_fee = Decimal("0.00")
        if config:
            fee_pct = config.cancellation_fee_percentage / Decimal("100")
            fee_from_pct = layby.total_amount * fee_pct
            cancellation_fee = max(fee_from_pct, config.cancellation_fee_minimum)

            # Add restocking fee
            item_count = layby.item_count
            restocking = config.restocking_fee_per_item * Decimal(str(item_count))
            cancellation_fee += restocking

        # Refund = amount_paid - cancellation_fee (never negative)
        refund_amount = max(layby.amount_paid - cancellation_fee, Decimal("0.00"))

        # Create refund payment record if there is a refund
        if refund_amount > Decimal("0.00"):
            refund_payment = LaybyPayment(
                layby_id=layby.id,
                payment_type=PaymentType.INSTALLMENT,
                amount=Decimal("0.00"),
                payment_method="refund",
                status=PaymentStatus.REFUNDED,
                refund_amount=refund_amount,
                refund_reason=reason,
                refunded_at=datetime.now(timezone.utc),
                refunded_by=cancelled_by,
                processed_by=cancelled_by,
                notes=f"Cancellation refund. Fee: R{cancellation_fee:.2f}",
            )
            self.db.add(refund_payment)

        # Update layby status
        layby.status = LaybyStatus.CANCELLED
        layby.cancelled_at = datetime.now(timezone.utc)
        layby.cancelled_by = cancelled_by
        layby.cancellation_reason = reason

        # Mark remaining schedules as cancelled (overwrite pending/partial)
        self.db.query(LaybySchedule).filter(
            LaybySchedule.layby_id == str(layby_id),
            LaybySchedule.status.in_([ScheduleStatus.PENDING.value, ScheduleStatus.PARTIAL.value, ScheduleStatus.OVERDUE.value]),
        ).update(
            {LaybySchedule.status: ScheduleStatus.PAID},
            synchronize_session="fetch",
        )

        layby.next_payment_date = None
        layby.next_payment_amount = None

        # Audit
        self._create_audit(
            layby_id=layby.id,
            action="cancelled",
            performed_by=cancelled_by,
            old_value={"status": old_status},
            new_value={
                "status": LaybyStatus.CANCELLED.value,
                "cancellation_fee": str(cancellation_fee),
                "refund_amount": str(refund_amount),
            },
            details=f"Cancelled: {reason}. Fee R{cancellation_fee:.2f}, Refund R{refund_amount:.2f}",
        )

        self.db.commit()
        self.db.refresh(layby)
        return layby

    def collect_layby(
        self,
        business_id: UUID,
        layby_id: UUID,
        collected_by: UUID,
    ) -> Layby:
        """Mark a layby as collected/completed.

        Raises:
            ValueError: If layby is not ready for collection.
        """
        layby = self.get_layby(business_id, layby_id)
        if not layby:
            raise ValueError("Layby not found.")
        if not layby.can_be_collected:
            raise ValueError("This layby is not ready for collection.")

        old_status = layby.status.value
        layby.status = LaybyStatus.COMPLETED
        layby.collected_at = datetime.now(timezone.utc)
        layby.collected_by = collected_by

        self._create_audit(
            layby_id=layby.id,
            action="collected",
            performed_by=collected_by,
            old_value={"status": old_status},
            new_value={"status": LaybyStatus.COMPLETED.value},
            details="Items collected by customer",
        )

        self.db.commit()
        self.db.refresh(layby)
        return layby

    def extend_layby(
        self,
        business_id: UUID,
        layby_id: UUID,
        new_end_date: date,
        extended_by: UUID,
    ) -> Layby:
        """Extend the layby end date and recalculate remaining schedule.

        Raises:
            ValueError: If layby cannot be extended or limits exceeded.
        """
        layby = self.get_layby(business_id, layby_id)
        if not layby:
            raise ValueError("Layby not found.")
        if not layby.can_be_extended:
            raise ValueError("This layby cannot be extended.")
        if new_end_date <= layby.end_date:
            raise ValueError("New end date must be after the current end date.")

        config = self._get_config(business_id, layby.location_id)
        if config and layby.extension_count >= config.max_extensions:
            raise ValueError(
                f"Maximum number of extensions ({config.max_extensions}) reached."
            )

        old_end = layby.end_date
        old_count = layby.extension_count

        # Apply extension fee if configured
        extension_fee = Decimal("0.00")
        if config and config.extension_fee > Decimal("0.00"):
            extension_fee = config.extension_fee
            layby.total_amount += extension_fee
            layby.balance_due += extension_fee

        layby.end_date = new_end_date
        layby.extension_count += 1

        # If overdue, transition back to active
        if layby.status == LaybyStatus.OVERDUE:
            layby.status = LaybyStatus.ACTIVE

        # Recalculate remaining schedule from today
        # Remove unpaid future schedule entries
        self.db.query(LaybySchedule).filter(
            LaybySchedule.layby_id == str(layby_id),
            LaybySchedule.status.in_([ScheduleStatus.PENDING.value, ScheduleStatus.OVERDUE.value]),
        ).delete(synchronize_session="fetch")

        # Build new installments for the remaining balance
        remaining_balance = layby.balance_due
        if remaining_balance > Decimal("0.00"):
            new_dates = self._calculate_installment_dates(
                date.today(), new_end_date, layby.payment_frequency
            )
            num = len(new_dates)
            inst_amt = (remaining_balance / Decimal(str(num))).quantize(Decimal("0.01")) if num else remaining_balance

            # Get next installment number
            max_num = (
                self.db.query(func.max(LaybySchedule.installment_number))
                .filter(LaybySchedule.layby_id == str(layby_id))
                .scalar()
            ) or 0

            for idx, due_dt in enumerate(new_dates, start=1):
                if idx == num:
                    amt = remaining_balance - (inst_amt * Decimal(str(num - 1)))
                else:
                    amt = inst_amt
                sched = LaybySchedule(
                    layby_id=layby.id,
                    installment_number=max_num + idx,
                    due_date=due_dt,
                    amount_due=amt,
                    amount_paid=Decimal("0.00"),
                    status=ScheduleStatus.PENDING,
                )
                self.db.add(sched)

            layby.next_payment_date = new_dates[0]
            layby.next_payment_amount = inst_amt

        self._create_audit(
            layby_id=layby.id,
            action="extended",
            performed_by=extended_by,
            old_value={"end_date": str(old_end), "extension_count": old_count},
            new_value={
                "end_date": str(new_end_date),
                "extension_count": layby.extension_count,
                "extension_fee": str(extension_fee),
            },
            details=f"Extended from {old_end} to {new_end_date}",
        )

        self.db.commit()
        self.db.refresh(layby)
        return layby

    def get_payment_history(
        self, business_id: UUID, layby_id: UUID
    ) -> List[LaybyPayment]:
        """Get all payments for a layby."""
        layby = self.get_layby(business_id, layby_id)
        if not layby:
            raise ValueError("Layby not found.")

        return (
            self.db.query(LaybyPayment)
            .filter(LaybyPayment.layby_id == str(layby_id))
            .order_by(LaybyPayment.created_at.asc())
            .all()
        )

    def get_schedule(
        self, business_id: UUID, layby_id: UUID
    ) -> List[LaybySchedule]:
        """Get the payment schedule for a layby."""
        layby = self.get_layby(business_id, layby_id)
        if not layby:
            raise ValueError("Layby not found.")

        return (
            self.db.query(LaybySchedule)
            .filter(LaybySchedule.layby_id == str(layby_id))
            .order_by(LaybySchedule.installment_number.asc())
            .all()
        )
