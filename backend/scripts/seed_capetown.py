"""
Comprehensive Seed Script for BizPilot - Cape Town, South Africa

This script seeds ALL data needed for every UI component:
- Dashboard: stats, recent_orders, top_products
- Products: products with categories
- Inventory: inventory_items with locations
- Categories: categories with colors and product_count
- Customers: individual and business customers with metrics
- Orders: orders with order_items
- Invoices: invoices with invoice_items
- Payments: payment records
- Reports: uses data from orders, customers, products

Run: python -m scripts.seed_capetown
"""

import sys
import os
from decimal import Decimal
from datetime import date, datetime, timedelta
from uuid import uuid4
import random

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserStatus
from app.models.organization import Organization
from app.models.business import Business
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.models.role import Role, DEFAULT_ROLES
from app.models.product import Product, ProductCategory, ProductStatus
from app.models.customer import Customer, CustomerType
from app.models.order import Order, OrderItem, OrderStatus, PaymentStatus as OrderPaymentStatus
from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus
from app.models.inventory import InventoryItem, InventoryTransaction, TransactionType
from app.models.payment import Payment, PaymentStatus, PaymentMethod


def clear_all_data(db: Session):
    """Clear all data in correct order respecting foreign keys."""
    print("Clearing all existing data...")
    
    from sqlalchemy import text
    
    # Delete in reverse dependency order using raw SQL for reliability
    tables = [
        "payments",
        "inventory_transactions",
        "inventory_items",
        "invoice_items",
        "invoices",
        "order_items",
        "orders",
        "products",
        "product_categories",
        "customers",
        "business_users",
        "roles",
        "businesses",
        "organizations",
        "users",
    ]
    
    for table in tables:
        try:
            db.execute(text(f"DELETE FROM {table}"))
            db.commit()
        except Exception:
            db.rollback()  # Table might not exist
    
    print("  ✓ All data cleared")


def create_user(db: Session) -> User:
    """Create demo user."""
    print("Creating demo user...")
    
    user = User(
        email="demo@bizpilot.co.za",
        hashed_password=get_password_hash("Demo@2024"),
        first_name="Sipho",
        last_name="Nkosi",
        phone="+27 21 555 0100",
        is_email_verified=True,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"  ✓ User: {user.email}")
    return user


def create_organization(db: Session, user: User) -> Organization:
    """Create organization."""
    print("Creating organization...")
    
    org = Organization(
        name="Cape Town Traders",
        slug="cape-town-traders",
        owner_id=user.id,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    print(f"  ✓ Organization: {org.name}")
    return org


def create_business(db: Session, org: Organization) -> Business:
    """Create business."""
    print("Creating business...")
    
    business = Business(
        name="Table Bay General Store",
        slug="table-bay-general-store",
        organization_id=org.id,
        description="Your one-stop shop for quality goods in Cape Town.",
        address_street="123 Long Street",
        address_city="Cape Town",
        address_state="Western Cape",
        address_postal_code="8001",
        address_country="South Africa",
        tax_number="9876543210",
        vat_number="4567890123",
        vat_rate=Decimal("15.00"),
        currency="ZAR",
        phone="+27 21 555 0100",
        email="info@tablebaystore.co.za",
        website="https://tablebaystore.co.za",
        invoice_prefix="TBS",
        invoice_terms="Payment due within 30 days.",
        bank_name="First National Bank",
        bank_account_number="62845678901",
        bank_branch_code="250655",
    )
    db.add(business)
    db.commit()
    db.refresh(business)
    print(f"  ✓ Business: {business.name}")
    return business


def create_roles(db: Session, business: Business) -> dict:
    """Create roles."""
    print("Creating roles...")
    
    roles = {}
    for role_key, role_config in DEFAULT_ROLES.items():
        role = Role(
            name=role_config["name"],
            description=role_config["description"],
            business_id=business.id,
            is_system=True,
            permissions=role_config["permissions"],
        )
        db.add(role)
        roles[role_key] = role
    
    db.commit()
    for role in roles.values():
        db.refresh(role)
    
    print(f"  ✓ Roles: {len(roles)}")
    return roles


def link_user_business(db: Session, user: User, business: Business, role: Role):
    """Link user to business."""
    print("Linking user to business...")
    
    bu = BusinessUser(
        user_id=user.id,
        business_id=business.id,
        role_id=role.id,
        status=BusinessUserStatus.ACTIVE,
        is_primary=True,
    )
    db.add(bu)
    db.commit()
    print(f"  ✓ Linked: {user.email} -> {business.name}")


def create_categories(db: Session, business: Business) -> list:
    """Create product categories."""
    print("Creating categories...")
    
    data = [
        {"name": "Groceries", "desc": "Food and household essentials", "color": "#22c55e"},
        {"name": "Beverages", "desc": "Drinks and refreshments", "color": "#3b82f6"},
        {"name": "Electronics", "desc": "Electronic devices and accessories", "color": "#8b5cf6"},
        {"name": "Clothing", "desc": "Apparel and fashion items", "color": "#ec4899"},
        {"name": "Home & Garden", "desc": "Home improvement and gardening", "color": "#f59e0b"},
        {"name": "Health & Beauty", "desc": "Personal care and wellness", "color": "#14b8a6"},
        {"name": "Stationery", "desc": "Office and school supplies", "color": "#6366f1"},
        {"name": "Sports & Outdoors", "desc": "Sports equipment and outdoor gear", "color": "#ef4444"},
    ]
    
    categories = []
    for i, d in enumerate(data):
        cat = ProductCategory(
            business_id=business.id,
            name=d["name"],
            description=d["desc"],
            color=d["color"],
            sort_order=i + 1,
        )
        db.add(cat)
        categories.append(cat)
    
    db.commit()
    for c in categories:
        db.refresh(c)
    
    print(f"  ✓ Categories: {len(categories)}")
    return categories


def create_products(db: Session, business: Business, categories: list) -> list:
    """Create products."""
    print("Creating products...")
    
    cat_map = {c.name: c for c in categories}
    
    products_data = [
        # Groceries
        {"name": "White Bread (700g)", "sku": "GRO-001", "cost": 15, "price": 22.99, "qty": 50, "cat": "Groceries"},
        {"name": "Full Cream Milk (2L)", "sku": "GRO-002", "cost": 28, "price": 39.99, "qty": 40, "cat": "Groceries"},
        {"name": "Free Range Eggs (18)", "sku": "GRO-003", "cost": 55, "price": 79.99, "qty": 30, "cat": "Groceries"},
        {"name": "Sunflower Oil (2L)", "sku": "GRO-004", "cost": 65, "price": 89.99, "qty": 25, "cat": "Groceries"},
        {"name": "Basmati Rice (2kg)", "sku": "GRO-005", "cost": 45, "price": 64.99, "qty": 35, "cat": "Groceries"},
        {"name": "Jungle Oats (1kg)", "sku": "GRO-006", "cost": 35, "price": 49.99, "qty": 45, "cat": "Groceries"},
        # Beverages
        {"name": "Coca-Cola (2L)", "sku": "BEV-001", "cost": 18, "price": 27.99, "qty": 100, "cat": "Beverages"},
        {"name": "Rooibos Tea (80 bags)", "sku": "BEV-002", "cost": 32, "price": 49.99, "qty": 60, "cat": "Beverages"},
        {"name": "Appletiser (1.25L)", "sku": "BEV-003", "cost": 28, "price": 42.99, "qty": 45, "cat": "Beverages"},
        {"name": "Castle Lager (6 Pack)", "sku": "BEV-004", "cost": 75, "price": 109.99, "qty": 80, "cat": "Beverages"},
        {"name": "Nescafe Gold (200g)", "sku": "BEV-005", "cost": 95, "price": 139.99, "qty": 30, "cat": "Beverages"},
        # Electronics
        {"name": "USB-C Charging Cable", "sku": "ELE-001", "cost": 45, "price": 79.99, "qty": 75, "cat": "Electronics"},
        {"name": "Wireless Earbuds", "sku": "ELE-002", "cost": 250, "price": 449.99, "qty": 20, "cat": "Electronics"},
        {"name": "Power Bank 10000mAh", "sku": "ELE-003", "cost": 180, "price": 329.99, "qty": 30, "cat": "Electronics"},
        {"name": "LED Desk Lamp", "sku": "ELE-004", "cost": 150, "price": 279.99, "qty": 25, "cat": "Electronics"},
        {"name": "Bluetooth Speaker", "sku": "ELE-005", "cost": 320, "price": 549.99, "qty": 15, "cat": "Electronics"},
        # Clothing
        {"name": "Cotton T-Shirt", "sku": "CLO-001", "cost": 85, "price": 149.99, "qty": 60, "cat": "Clothing"},
        {"name": "Denim Jeans", "sku": "CLO-002", "cost": 250, "price": 449.99, "qty": 35, "cat": "Clothing"},
        {"name": "Running Shoes", "sku": "CLO-003", "cost": 450, "price": 799.99, "qty": 20, "cat": "Clothing"},
        {"name": "Winter Jacket", "sku": "CLO-004", "cost": 380, "price": 699.99, "qty": 15, "cat": "Clothing"},
        # Home & Garden
        {"name": "Garden Hose (15m)", "sku": "HOM-001", "cost": 180, "price": 299.99, "qty": 20, "cat": "Home & Garden"},
        {"name": "Potting Soil (20L)", "sku": "HOM-002", "cost": 45, "price": 79.99, "qty": 40, "cat": "Home & Garden"},
        {"name": "LED Light Bulb (3 Pack)", "sku": "HOM-003", "cost": 55, "price": 99.99, "qty": 50, "cat": "Home & Garden"},
        {"name": "Braai Grid (Large)", "sku": "HOM-004", "cost": 280, "price": 479.99, "qty": 15, "cat": "Home & Garden"},
        # Health & Beauty
        {"name": "Sunscreen SPF50", "sku": "HEA-001", "cost": 85, "price": 149.99, "qty": 40, "cat": "Health & Beauty"},
        {"name": "Ingram's Camphor Cream", "sku": "HEA-002", "cost": 35, "price": 59.99, "qty": 55, "cat": "Health & Beauty"},
        {"name": "Panado Tablets (24)", "sku": "HEA-003", "cost": 25, "price": 44.99, "qty": 80, "cat": "Health & Beauty"},
        {"name": "Dove Soap (4 Pack)", "sku": "HEA-004", "cost": 55, "price": 89.99, "qty": 60, "cat": "Health & Beauty"},
        # Stationery
        {"name": "A4 Paper Ream (500)", "sku": "STA-001", "cost": 65, "price": 99.99, "qty": 50, "cat": "Stationery"},
        {"name": "Ballpoint Pens (10 Pack)", "sku": "STA-002", "cost": 25, "price": 44.99, "qty": 80, "cat": "Stationery"},
        {"name": "School Bag (Large)", "sku": "STA-003", "cost": 180, "price": 329.99, "qty": 25, "cat": "Stationery"},
        {"name": "Calculator Scientific", "sku": "STA-004", "cost": 120, "price": 219.99, "qty": 30, "cat": "Stationery"},
        # Sports & Outdoors
        {"name": "Soccer Ball (Size 5)", "sku": "SPO-001", "cost": 150, "price": 279.99, "qty": 25, "cat": "Sports & Outdoors"},
        {"name": "Yoga Mat", "sku": "SPO-002", "cost": 180, "price": 329.99, "qty": 20, "cat": "Sports & Outdoors"},
        {"name": "Camping Tent (2-Person)", "sku": "SPO-003", "cost": 650, "price": 1199.99, "qty": 8, "cat": "Sports & Outdoors"},
        {"name": "Water Bottle (1L)", "sku": "SPO-004", "cost": 65, "price": 119.99, "qty": 45, "cat": "Sports & Outdoors"},
    ]
    
    products = []
    for p in products_data:
        product = Product(
            business_id=business.id,
            category_id=cat_map[p["cat"]].id,
            name=p["name"],
            sku=p["sku"],
            barcode=f"600{random.randint(1000000000, 9999999999)}",
            cost_price=Decimal(str(p["cost"])),
            selling_price=Decimal(str(p["price"])),
            quantity=p["qty"],
            low_stock_threshold=10,
            status=ProductStatus.ACTIVE,
            track_inventory=True,
            is_taxable=True,
        )
        db.add(product)
        products.append(product)
    
    db.commit()
    for prod in products:
        db.refresh(prod)
    
    print(f"  ✓ Products: {len(products)}")
    return products


def create_inventory(db: Session, business: Business, products: list) -> list:
    """Create inventory items for each product."""
    print("Creating inventory items...")
    
    locations = ["Warehouse A", "Warehouse B", "Store Front", "Back Room"]
    bins = ["A-01", "A-02", "B-01", "B-02", "C-01", "C-02"]
    
    items = []
    for product in products:
        inv = InventoryItem(
            business_id=business.id,
            product_id=product.id,
            quantity_on_hand=product.quantity,
            quantity_reserved=random.randint(0, min(5, product.quantity)),
            quantity_incoming=random.randint(0, 20),
            reorder_point=product.low_stock_threshold,
            reorder_quantity=50,
            location=random.choice(locations),
            bin_location=random.choice(bins),
            average_cost=float(product.cost_price) if product.cost_price else 0,
            last_cost=float(product.cost_price) if product.cost_price else 0,
        )
        db.add(inv)
        items.append(inv)
    
    db.commit()
    for item in items:
        db.refresh(item)
    
    print(f"  ✓ Inventory items: {len(items)}")
    return items


def create_customers(db: Session, business: Business) -> list:
    """Create customers."""
    print("Creating customers...")
    
    customers_data = [
        # Individual customers
        {"first": "Thandi", "last": "Mbeki", "email": "thandi.mbeki@gmail.com", "phone": "+27 82 123 4567", "city": "Sea Point", "type": "individual"},
        {"first": "Johan", "last": "van der Berg", "email": "johan.vdberg@outlook.com", "phone": "+27 83 234 5678", "city": "Camps Bay", "type": "individual"},
        {"first": "Nomvula", "last": "Dlamini", "email": "nomvula.d@yahoo.com", "phone": "+27 84 345 6789", "city": "Observatory", "type": "individual"},
        {"first": "Pieter", "last": "Botha", "email": "pieter.botha@gmail.com", "phone": "+27 72 456 7890", "city": "Claremont", "type": "individual"},
        {"first": "Ayanda", "last": "Zulu", "email": "ayanda.zulu@hotmail.com", "phone": "+27 73 567 8901", "city": "Woodstock", "type": "individual"},
        {"first": "Michelle", "last": "Adams", "email": "michelle.a@gmail.com", "phone": "+27 82 678 9012", "city": "Green Point", "type": "individual"},
        {"first": "Bongani", "last": "Mthembu", "email": "bongani.m@outlook.com", "phone": "+27 83 789 0123", "city": "Rondebosch", "type": "individual"},
        {"first": "Liezel", "last": "Pretorius", "email": "liezel.p@gmail.com", "phone": "+27 84 890 1234", "city": "Constantia", "type": "individual"},
        {"first": "Themba", "last": "Ndlovu", "email": "themba.ndlovu@yahoo.com", "phone": "+27 72 901 2345", "city": "Khayelitsha", "type": "individual"},
        {"first": "Sarah", "last": "Williams", "email": "sarah.w@gmail.com", "phone": "+27 73 012 3456", "city": "Muizenberg", "type": "individual"},
        # Business customers
        {"company": "Cape Coffee Roasters", "email": "orders@capecoffee.co.za", "phone": "+27 21 555 1001", "city": "De Waterkant", "type": "business", "vat": "4901234567"},
        {"company": "Table Mountain Catering", "email": "supplies@tmcatering.co.za", "phone": "+27 21 555 1002", "city": "Gardens", "type": "business", "vat": "4902345678"},
        {"company": "Atlantic Guest House", "email": "procurement@atlanticgh.co.za", "phone": "+27 21 555 1003", "city": "Bantry Bay", "type": "business", "vat": "4903456789"},
        {"company": "Waterfront Deli", "email": "orders@waterfrontdeli.co.za", "phone": "+27 21 555 1004", "city": "V&A Waterfront", "type": "business", "vat": "4904567890"},
        {"company": "Hout Bay Hardware", "email": "stock@hbhardware.co.za", "phone": "+27 21 555 1005", "city": "Hout Bay", "type": "business", "vat": "4905678901"},
    ]
    
    customers = []
    for c in customers_data:
        if c["type"] == "individual":
            customer = Customer(
                business_id=business.id,
                customer_type=CustomerType.INDIVIDUAL,
                first_name=c["first"],
                last_name=c["last"],
                email=c["email"],
                phone=c["phone"],
                city=c["city"],
                state="Western Cape",
                postal_code=f"80{random.randint(10, 99)}",
                country="South Africa",
            )
        else:
            customer = Customer(
                business_id=business.id,
                customer_type=CustomerType.BUSINESS,
                company_name=c["company"],
                email=c["email"],
                phone=c["phone"],
                tax_number=c.get("vat"),
                city=c["city"],
                state="Western Cape",
                postal_code=f"80{random.randint(10, 99)}",
                country="South Africa",
            )
        db.add(customer)
        customers.append(customer)
    
    db.commit()
    for cust in customers:
        db.refresh(cust)
    
    print(f"  ✓ Customers: {len(customers)}")
    return customers


def create_orders(db: Session, business: Business, customers: list, products: list) -> list:
    """Create orders with items."""
    print("Creating orders...")
    
    orders = []
    order_num = 1000
    
    # Create orders for past 60 days
    for i in range(40):
        order_date = datetime.now() - timedelta(days=random.randint(0, 60))
        customer = random.choice(customers)
        
        # 2-5 products per order
        num_items = random.randint(2, 5)
        selected_products = random.sample(products, min(num_items, len(products)))
        
        subtotal = Decimal("0")
        items_data = []
        
        for prod in selected_products:
            qty = random.randint(1, 5)
            line_total = prod.selling_price * qty
            tax = line_total * Decimal("0.15")
            items_data.append({
                "product": prod,
                "quantity": qty,
                "unit_price": prod.selling_price,
                "tax_amount": tax,
                "total": line_total + tax,
            })
            subtotal += line_total
        
        tax_amount = subtotal * Decimal("0.15")
        total = subtotal + tax_amount
        
        # Weighted status distribution
        status_weights = [
            (OrderStatus.DELIVERED, OrderPaymentStatus.PAID, 0.50),
            (OrderStatus.SHIPPED, OrderPaymentStatus.PAID, 0.15),
            (OrderStatus.PROCESSING, OrderPaymentStatus.PAID, 0.10),
            (OrderStatus.CONFIRMED, OrderPaymentStatus.PENDING, 0.10),
            (OrderStatus.PENDING, OrderPaymentStatus.PENDING, 0.10),
            (OrderStatus.CANCELLED, OrderPaymentStatus.PENDING, 0.05),
        ]
        
        rand = random.random()
        cumulative = 0
        order_status = OrderStatus.PENDING
        payment_status = OrderPaymentStatus.PENDING
        
        for os, ps, prob in status_weights:
            cumulative += prob
            if rand < cumulative:
                order_status = os
                payment_status = ps
                break
        
        amount_paid = total if payment_status == OrderPaymentStatus.PAID else Decimal("0")
        
        order = Order(
            business_id=business.id,
            customer_id=customer.id,
            order_number=f"TBS-{order_num}",
            status=order_status,
            payment_status=payment_status,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total=total,
            amount_paid=amount_paid,
            payment_method="card" if payment_status == OrderPaymentStatus.PAID else None,
            order_date=order_date,
            source="manual",
        )
        db.add(order)
        db.flush()
        
        for item_data in items_data:
            order_item = OrderItem(
                order_id=order.id,
                product_id=item_data["product"].id,
                name=item_data["product"].name,
                sku=item_data["product"].sku,
                unit_price=item_data["unit_price"],
                quantity=item_data["quantity"],
                tax_rate=Decimal("15.00"),
                tax_amount=item_data["tax_amount"],
                total=item_data["total"],
            )
            db.add(order_item)
        
        orders.append(order)
        order_num += 1
    
    db.commit()
    print(f"  ✓ Orders: {len(orders)}")
    return orders


def create_invoices(db: Session, business: Business, orders: list) -> list:
    """Create invoices from paid orders."""
    print("Creating invoices...")
    
    invoices = []
    inv_num = 1000
    
    paid_orders = [o for o in orders if o.payment_status == OrderPaymentStatus.PAID]
    
    for order in paid_orders[:20]:
        issue_date = order.order_date.date() if isinstance(order.order_date, datetime) else order.order_date
        due_date = issue_date + timedelta(days=30)
        
        invoice = Invoice(
            business_id=business.id,
            customer_id=order.customer_id,
            order_id=order.id,
            invoice_number=f"TBS-INV-{inv_num}",
            status=InvoiceStatus.PAID,
            issue_date=issue_date,
            due_date=due_date,
            paid_date=issue_date + timedelta(days=random.randint(0, 14)),
            subtotal=order.subtotal,
            tax_amount=order.tax_amount,
            total=order.total,
            amount_paid=order.total,
        )
        db.add(invoice)
        db.flush()
        
        for order_item in order.items:
            invoice_item = InvoiceItem(
                invoice_id=invoice.id,
                product_id=order_item.product_id,
                description=order_item.name,
                quantity=Decimal(str(order_item.quantity)),
                unit_price=order_item.unit_price,
                tax_rate=order_item.tax_rate,
                tax_amount=order_item.tax_amount,
                total=order_item.total,
            )
            db.add(invoice_item)
        
        invoices.append(invoice)
        inv_num += 1
    
    db.commit()
    print(f"  ✓ Invoices: {len(invoices)}")
    return invoices


def create_payments(db: Session, business: Business, invoices: list, customers: list) -> int:
    """Create payment records using raw SQL due to enum case sensitivity."""
    print("Creating payments...")
    
    from sqlalchemy import text
    from uuid import uuid4
    from datetime import datetime, timezone
    
    # Database enum values are uppercase
    payment_methods = ['CARD', 'CASH', 'EFT', 'YOCO', 'PAYFAST']
    
    payments_created = 0
    pay_num = 1000
    
    for invoice in invoices:
        payment_id = uuid4()
        now = datetime.now(timezone.utc)
        payment_date = invoice.paid_date or date.today()
        method = random.choice(payment_methods)
        
        # Use string interpolation for enum cast, bind params for data
        sql = f"""
            INSERT INTO payments (id, business_id, invoice_id, customer_id, payment_number, 
                                  amount, payment_method, status, payment_date, reference,
                                  created_at, updated_at)
            VALUES (:id, :business_id, :invoice_id, :customer_id, :payment_number,
                    :amount, '{method}'::paymentmethod, 'paid'::paymentstatus, 
                    :payment_date, :reference, :created_at, :updated_at)
        """
        
        db.execute(text(sql), {
            "id": payment_id,
            "business_id": business.id,
            "invoice_id": invoice.id,
            "customer_id": invoice.customer_id,
            "payment_number": f"TBS-PAY-{pay_num}",
            "amount": float(invoice.total),
            "payment_date": payment_date,
            "reference": f"REF{random.randint(100000, 999999)}",
            "created_at": now,
            "updated_at": now,
        })
        payments_created += 1
        pay_num += 1
    
    db.commit()
    print(f"  ✓ Payments: {payments_created}")
    return payments_created


def update_customer_metrics(db: Session, business: Business):
    """Update customer order metrics."""
    print("Updating customer metrics...")
    
    customers = db.query(Customer).filter(Customer.business_id == business.id).all()
    
    for customer in customers:
        orders = db.query(Order).filter(
            Order.customer_id == customer.id,
            Order.payment_status == OrderPaymentStatus.PAID,
        ).all()
        
        if orders:
            customer.total_orders = len(orders)
            customer.total_spent = sum(o.total for o in orders)
            customer.average_order_value = customer.total_spent / len(orders)
    
    db.commit()
    print("  ✓ Metrics updated")


def main():
    """Run seed script."""
    print("\n" + "=" * 60)
    print("BizPilot Cape Town Seed Script")
    print("=" * 60 + "\n")
    
    db = SessionLocal()
    
    try:
        clear_all_data(db)
        
        # Core entities
        user = create_user(db)
        org = create_organization(db, user)
        business = create_business(db, org)
        roles = create_roles(db, business)
        link_user_business(db, user, business, roles["admin"])
        
        # Business data
        categories = create_categories(db, business)
        products = create_products(db, business, categories)
        inventory = create_inventory(db, business, products)
        customers = create_customers(db, business)
        orders = create_orders(db, business, customers, products)
        invoices = create_invoices(db, business, orders)
        
        # Payments - wrap in try/except due to potential enum mismatch
        payments_count = 0
        try:
            payments_count = create_payments(db, business, invoices, customers)
        except Exception as e:
            db.rollback()
            print(f"  ⚠ Payments skipped: {str(e)[:100]}")
        
        # Metrics
        update_customer_metrics(db, business)
        
        # Summary
        print("\n" + "=" * 60)
        print("✅ SEEDING COMPLETE")
        print("=" * 60)
        print(f"\n📧 Demo Login:")
        print(f"   Email: demo@bizpilot.co.za")
        print(f"   Password: Demo@2024")
        print(f"\n🏢 Business: {business.name}")
        print(f"   Location: Cape Town, Western Cape")
        print(f"   Currency: ZAR | VAT: 15%")
        print(f"\n📊 Data Summary:")
        print(f"   Categories:      {len(categories)}")
        print(f"   Products:        {len(products)}")
        print(f"   Inventory Items: {len(inventory)}")
        print(f"   Customers:       {len(customers)}")
        print(f"   Orders:          {len(orders)}")
        print(f"   Invoices:        {len(invoices)}")
        print(f"   Payments:        {payments_count}")
        print("=" * 60 + "\n")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
