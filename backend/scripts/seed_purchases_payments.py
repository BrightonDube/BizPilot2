"""Seed script for Purchases (Orders with direction=outbound) and Payments (non-destructive, idempotent)."""

import sys
import os
from datetime import datetime, timedelta
from decimal import Decimal
import random

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.business import Business
from app.models.supplier import Supplier
from app.models.order import Order, OrderItem, OrderStatus, PaymentStatus as OrderPaymentStatus
from app.models.payment import Payment, PaymentStatus, PaymentMethod
from app.models.product import Product


def generate_order_number(prefix: str = "PO") -> str:
    """Generate a unique order number."""
    import uuid
    return f"{prefix}-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"


def generate_payment_number() -> str:
    """Generate a unique payment number."""
    import uuid
    return f"PAY-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"


def seed_purchases_for_business(db: Session, business_id: str) -> int:
    """Seed purchase orders (outbound orders) for a business."""
    # Check if purchases already exist
    existing = db.query(Order).filter(
        Order.business_id == business_id,
        Order.direction == "outbound",
    ).count()

    if existing > 0:
        print(f"    Skipping purchases - {existing} already exist")
        return 0

    # Get suppliers for this business
    suppliers = db.query(Supplier).filter(
        Supplier.business_id == business_id,
        Supplier.deleted_at.is_(None),
    ).all()

    if not suppliers:
        print("    No suppliers found - run seed_suppliers first")
        return 0

    # Get products for this business
    products = db.query(Product).filter(
        Product.business_id == business_id,
        Product.deleted_at.is_(None),
    ).limit(10).all()

    orders_created = 0
    statuses = [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.DELIVERED]
    payment_statuses = [OrderPaymentStatus.PENDING, OrderPaymentStatus.PARTIAL, OrderPaymentStatus.PAID]
    payment_methods = ["bank_transfer", "eft", "card", "cash"]

    for i, supplier in enumerate(suppliers):
        # Create 2-3 purchase orders per supplier
        num_orders = random.randint(2, 3)
        for j in range(num_orders):
            order_date = datetime.now() - timedelta(days=random.randint(1, 60))
            status = random.choice(statuses)
            payment_status = random.choice(payment_statuses)
            
            order = Order(
                business_id=business_id,
                supplier_id=supplier.id,
                customer_id=None,
                direction="outbound",
                order_number=generate_order_number(),
                status=status,
                payment_status=payment_status,
                payment_method=random.choice(payment_methods),
                order_date=order_date,
                subtotal=Decimal("0"),
                tax_amount=Decimal("0"),
                discount_amount=Decimal("0"),
                shipping_amount=Decimal(str(random.choice([0, 50, 100, 150]))),
                total=Decimal("0"),
                amount_paid=Decimal("0"),
                balance_due=Decimal("0"),
                notes=f"Purchase order from {supplier.name}",
            )
            db.add(order)
            db.flush()

            # Add 1-4 items per order
            subtotal = Decimal("0")
            tax_amount = Decimal("0")
            num_items = random.randint(1, min(4, len(products))) if products else 1

            if products:
                selected_products = random.sample(products, num_items)
                for product in selected_products:
                    quantity = random.randint(5, 50)
                    unit_price = Decimal(str(product.cost_price or product.selling_price or 100))
                    tax_rate = Decimal("15")  # 15% VAT
                    discount_percent = Decimal(str(random.choice([0, 0, 0, 5, 10])))
                    
                    line_subtotal = unit_price * quantity
                    line_discount = line_subtotal * discount_percent / 100
                    line_taxable = line_subtotal - line_discount
                    line_tax = line_taxable * tax_rate / 100
                    line_total = line_taxable + line_tax

                    item = OrderItem(
                        order_id=order.id,
                        product_id=product.id,
                        name=product.name,
                        description=product.description,
                        quantity=quantity,
                        unit_price=unit_price,
                        tax_rate=tax_rate,
                        tax_amount=line_tax,
                        discount_percent=discount_percent,
                        discount_amount=line_discount,
                        total=line_total,
                    )
                    db.add(item)
                    subtotal += line_subtotal
                    tax_amount += line_tax
            else:
                # Create dummy items if no products
                for k in range(num_items):
                    quantity = random.randint(5, 50)
                    unit_price = Decimal(str(random.randint(50, 500)))
                    tax_rate = Decimal("15")
                    line_subtotal = unit_price * quantity
                    line_tax = line_subtotal * tax_rate / 100
                    line_total = line_subtotal + line_tax

                    item = OrderItem(
                        order_id=order.id,
                        name=f"Bulk Item {k+1}",
                        quantity=quantity,
                        unit_price=unit_price,
                        tax_rate=tax_rate,
                        tax_amount=line_tax,
                        total=line_total,
                    )
                    db.add(item)
                    subtotal += line_subtotal
                    tax_amount += line_tax

            # Update order totals
            total = subtotal + tax_amount + order.shipping_amount
            
            if payment_status == OrderPaymentStatus.PAID:
                amount_paid = total
            elif payment_status == OrderPaymentStatus.PARTIAL:
                amount_paid = total * Decimal(str(random.choice([0.25, 0.5, 0.75])))
            else:
                amount_paid = Decimal("0")

            order.subtotal = subtotal
            order.tax_amount = tax_amount
            order.total = total
            order.amount_paid = amount_paid
            order.balance_due = total - amount_paid

            orders_created += 1

    db.commit()
    return orders_created


def seed_payments_for_business(db: Session, business_id: str) -> int:
    """Seed payments for a business based on existing orders."""
    # Check if payments already exist
    existing = db.query(Payment).filter(
        Payment.business_id == business_id,
    ).count()

    if existing > 0:
        print(f"    Skipping payments - {existing} already exist")
        return 0

    # Get orders with payments (paid or partial)
    orders = db.query(Order).filter(
        Order.business_id == business_id,
        Order.amount_paid > 0,
    ).all()

    if not orders:
        print("    No paid orders found")
        return 0

    payments_created = 0
    payment_methods_list = list(PaymentMethod)

    for order in orders:
        if order.amount_paid <= 0:
            continue

        # Create payment record
        payment_method = PaymentMethod(order.payment_method) if order.payment_method in [m.value for m in PaymentMethod] else random.choice(payment_methods_list)
        
        payment = Payment(
            business_id=business_id,
            payment_number=generate_payment_number(),
            amount=order.amount_paid,
            payment_method=payment_method,
            status=PaymentStatus.COMPLETED if order.payment_status == OrderPaymentStatus.PAID else PaymentStatus.PENDING,
            payment_date=order.order_date + timedelta(days=random.randint(0, 7)),
            reference=f"Payment for {order.order_number}",
            notes=f"Payment recorded for order {order.order_number}",
        )
        db.add(payment)
        payments_created += 1

    db.commit()
    return payments_created


def main() -> None:
    """Main entry point for seeding purchases and payments."""
    db = SessionLocal()
    try:
        businesses = db.query(Business).all()
        
        if not businesses:
            print("No businesses found. Please create a business first.")
            return

        print(f"Found {len(businesses)} business(es)")
        
        total_purchases = 0
        total_payments = 0

        for business in businesses:
            print(f"\nSeeding for business: {business.name} ({business.id})")
            
            # Seed purchases
            purchases = seed_purchases_for_business(db, str(business.id))
            total_purchases += purchases
            print(f"  ✓ Purchases seeded: {purchases}")
            
            # Seed payments
            payments = seed_payments_for_business(db, str(business.id))
            total_payments += payments
            print(f"  ✓ Payments seeded: {payments}")

        print(f"\n=== Summary ===")
        print(f"Total purchases created: {total_purchases}")
        print(f"Total payments created: {total_payments}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
