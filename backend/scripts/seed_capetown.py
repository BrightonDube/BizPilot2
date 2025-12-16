"""
Seed script for BizPilot with Cape Town, South Africa data.

This script creates comprehensive demo data for:
- Users (demo account)
- Organizations
- Businesses (Cape Town retail store)
- Roles (Admin, Manager, Employee)
- Product Categories
- Products (SA retail products)
- Customers (Cape Town area)
- Orders with OrderItems
- Invoices with InvoiceItems

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

from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.base import Base
from app.models.user import User, UserStatus
from app.models.organization import Organization
from app.models.business import Business
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.models.role import Role, Permission, DEFAULT_ROLES
from app.models.product import Product, ProductCategory, ProductStatus
from app.models.customer import Customer, CustomerType
from app.models.order import Order, OrderItem, OrderStatus, PaymentStatus
from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus


def clear_data(db: Session):
    """Clear all existing data in correct order (respecting foreign keys)."""
    print("Clearing existing data...")
    
    # Delete in reverse dependency order
    db.query(InvoiceItem).delete()
    db.query(Invoice).delete()
    db.query(OrderItem).delete()
    db.query(Order).delete()
    db.query(Product).delete()
    db.query(ProductCategory).delete()
    db.query(Customer).delete()
    db.query(BusinessUser).delete()
    db.query(Role).delete()
    db.query(Business).delete()
    db.query(Organization).delete()
    db.query(User).delete()
    
    db.commit()
    print("  ✓ Data cleared")


def create_demo_user(db: Session) -> User:
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
    print(f"  ✓ Created user: {user.email}")
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
    print(f"  ✓ Created organization: {org.name}")
    return org


def create_business(db: Session, org: Organization) -> Business:
    """Create Cape Town business."""
    print("Creating business...")
    
    business = Business(
        name="Table Bay General Store",
        slug="table-bay-general-store",
        organization_id=org.id,
        description="Your one-stop shop for quality goods in Cape Town. We stock everything from fresh produce to household essentials.",
        
        # Cape Town Address
        address_street="123 Long Street",
        address_city="Cape Town",
        address_state="Western Cape",
        address_postal_code="8001",
        address_country="South Africa",
        
        # SA Tax Details
        tax_number="9876543210",
        vat_number="4567890123",
        vat_rate=Decimal("15.00"),
        currency="ZAR",
        
        # Contact
        phone="+27 21 555 0100",
        email="info@tablebaystore.co.za",
        website="https://tablebaystore.co.za",
        
        # Invoice Settings
        invoice_prefix="TBS",
        invoice_terms="Payment due within 30 days. Late payments subject to 2% monthly interest.",
        bank_name="First National Bank",
        bank_account_number="62845678901",
        bank_branch_code="250655",
    )
    db.add(business)
    db.commit()
    db.refresh(business)
    print(f"  ✓ Created business: {business.name}")
    return business


def create_roles(db: Session, business: Business) -> dict:
    """Create roles for the business."""
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
    
    print(f"  ✓ Created {len(roles)} roles")
    return roles


def link_user_to_business(db: Session, user: User, business: Business, role: Role):
    """Link user to business with role."""
    print("Linking user to business...")
    
    business_user = BusinessUser(
        user_id=user.id,
        business_id=business.id,
        role_id=role.id,
        status=BusinessUserStatus.ACTIVE,
        is_primary=True,
    )
    db.add(business_user)
    db.commit()
    print(f"  ✓ Linked {user.email} to {business.name} as {role.name}")


def create_categories(db: Session, business: Business) -> list:
    """Create product categories."""
    print("Creating product categories...")
    
    categories_data = [
        {"name": "Groceries", "description": "Food and household essentials", "color": "#22c55e", "sort_order": 1},
        {"name": "Beverages", "description": "Drinks and refreshments", "color": "#3b82f6", "sort_order": 2},
        {"name": "Electronics", "description": "Electronic devices and accessories", "color": "#8b5cf6", "sort_order": 3},
        {"name": "Clothing", "description": "Apparel and fashion items", "color": "#ec4899", "sort_order": 4},
        {"name": "Home & Garden", "description": "Home improvement and gardening supplies", "color": "#f59e0b", "sort_order": 5},
        {"name": "Health & Beauty", "description": "Personal care and wellness products", "color": "#14b8a6", "sort_order": 6},
        {"name": "Stationery", "description": "Office and school supplies", "color": "#6366f1", "sort_order": 7},
        {"name": "Sports & Outdoors", "description": "Sports equipment and outdoor gear", "color": "#ef4444", "sort_order": 8},
    ]
    
    categories = []
    for cat_data in categories_data:
        category = ProductCategory(
            business_id=business.id,
            name=cat_data["name"],
            description=cat_data["description"],
            color=cat_data["color"],
            sort_order=cat_data["sort_order"],
        )
        db.add(category)
        categories.append(category)
    
    db.commit()
    for cat in categories:
        db.refresh(cat)
    
    print(f"  ✓ Created {len(categories)} categories")
    return categories


def create_products(db: Session, business: Business, categories: list) -> list:
    """Create products with SA pricing in ZAR."""
    print("Creating products...")
    
    # Map category names to objects
    cat_map = {cat.name: cat for cat in categories}
    
    products_data = [
        # Groceries
        {"name": "White Bread (700g)", "sku": "GRO-001", "cost": 15.00, "price": 22.99, "qty": 50, "cat": "Groceries"},
        {"name": "Full Cream Milk (2L)", "sku": "GRO-002", "cost": 28.00, "price": 39.99, "qty": 40, "cat": "Groceries"},
        {"name": "Free Range Eggs (18)", "sku": "GRO-003", "cost": 55.00, "price": 79.99, "qty": 30, "cat": "Groceries"},
        {"name": "Sunflower Oil (2L)", "sku": "GRO-004", "cost": 65.00, "price": 89.99, "qty": 25, "cat": "Groceries"},
        {"name": "Basmati Rice (2kg)", "sku": "GRO-005", "cost": 45.00, "price": 64.99, "qty": 35, "cat": "Groceries"},
        {"name": "Robertsons Mixed Herbs", "sku": "GRO-006", "cost": 18.00, "price": 29.99, "qty": 60, "cat": "Groceries"},
        {"name": "Jungle Oats (1kg)", "sku": "GRO-007", "cost": 35.00, "price": 49.99, "qty": 45, "cat": "Groceries"},
        {"name": "Tastic Rice (2kg)", "sku": "GRO-008", "cost": 40.00, "price": 54.99, "qty": 38, "cat": "Groceries"},
        
        # Beverages
        {"name": "Coca-Cola (2L)", "sku": "BEV-001", "cost": 18.00, "price": 27.99, "qty": 100, "cat": "Beverages"},
        {"name": "Rooibos Tea (80 bags)", "sku": "BEV-002", "cost": 32.00, "price": 49.99, "qty": 60, "cat": "Beverages"},
        {"name": "Appletiser (1.25L)", "sku": "BEV-003", "cost": 28.00, "price": 42.99, "qty": 45, "cat": "Beverages"},
        {"name": "Castle Lager (6 Pack)", "sku": "BEV-004", "cost": 75.00, "price": 109.99, "qty": 80, "cat": "Beverages"},
        {"name": "Oros Orange Squash (2L)", "sku": "BEV-005", "cost": 35.00, "price": 52.99, "qty": 55, "cat": "Beverages"},
        {"name": "Nescafe Gold (200g)", "sku": "BEV-006", "cost": 95.00, "price": 139.99, "qty": 30, "cat": "Beverages"},
        
        # Electronics
        {"name": "USB-C Charging Cable", "sku": "ELE-001", "cost": 45.00, "price": 79.99, "qty": 75, "cat": "Electronics"},
        {"name": "Wireless Earbuds", "sku": "ELE-002", "cost": 250.00, "price": 449.99, "qty": 20, "cat": "Electronics"},
        {"name": "Power Bank 10000mAh", "sku": "ELE-003", "cost": 180.00, "price": 329.99, "qty": 30, "cat": "Electronics"},
        {"name": "LED Desk Lamp", "sku": "ELE-004", "cost": 150.00, "price": 279.99, "qty": 25, "cat": "Electronics"},
        {"name": "Bluetooth Speaker", "sku": "ELE-005", "cost": 320.00, "price": 549.99, "qty": 15, "cat": "Electronics"},
        
        # Clothing
        {"name": "Cotton T-Shirt (Unisex)", "sku": "CLO-001", "cost": 85.00, "price": 149.99, "qty": 60, "cat": "Clothing"},
        {"name": "Denim Jeans", "sku": "CLO-002", "cost": 250.00, "price": 449.99, "qty": 35, "cat": "Clothing"},
        {"name": "Running Shoes", "sku": "CLO-003", "cost": 450.00, "price": 799.99, "qty": 20, "cat": "Clothing"},
        {"name": "Winter Jacket", "sku": "CLO-004", "cost": 380.00, "price": 699.99, "qty": 15, "cat": "Clothing"},
        {"name": "Beanie Hat", "sku": "CLO-005", "cost": 45.00, "price": 89.99, "qty": 50, "cat": "Clothing"},
        
        # Home & Garden
        {"name": "Garden Hose (15m)", "sku": "HOM-001", "cost": 180.00, "price": 299.99, "qty": 20, "cat": "Home & Garden"},
        {"name": "Potting Soil (20L)", "sku": "HOM-002", "cost": 45.00, "price": 79.99, "qty": 40, "cat": "Home & Garden"},
        {"name": "LED Light Bulb (3 Pack)", "sku": "HOM-003", "cost": 55.00, "price": 99.99, "qty": 50, "cat": "Home & Garden"},
        {"name": "Braai Grid (Large)", "sku": "HOM-004", "cost": 280.00, "price": 479.99, "qty": 15, "cat": "Home & Garden"},
        {"name": "Cooler Box (26L)", "sku": "HOM-005", "cost": 350.00, "price": 599.99, "qty": 12, "cat": "Home & Garden"},
        
        # Health & Beauty
        {"name": "Sunscreen SPF50 (200ml)", "sku": "HEA-001", "cost": 85.00, "price": 149.99, "qty": 40, "cat": "Health & Beauty"},
        {"name": "Ingram's Camphor Cream", "sku": "HEA-002", "cost": 35.00, "price": 59.99, "qty": 55, "cat": "Health & Beauty"},
        {"name": "Panado Tablets (24)", "sku": "HEA-003", "cost": 25.00, "price": 44.99, "qty": 80, "cat": "Health & Beauty"},
        {"name": "Vaseline (250ml)", "sku": "HEA-004", "cost": 40.00, "price": 69.99, "qty": 45, "cat": "Health & Beauty"},
        {"name": "Dove Soap (4 Pack)", "sku": "HEA-005", "cost": 55.00, "price": 89.99, "qty": 60, "cat": "Health & Beauty"},
        
        # Stationery
        {"name": "A4 Paper Ream (500)", "sku": "STA-001", "cost": 65.00, "price": 99.99, "qty": 50, "cat": "Stationery"},
        {"name": "Ballpoint Pens (10 Pack)", "sku": "STA-002", "cost": 25.00, "price": 44.99, "qty": 80, "cat": "Stationery"},
        {"name": "School Bag (Large)", "sku": "STA-003", "cost": 180.00, "price": 329.99, "qty": 25, "cat": "Stationery"},
        {"name": "Calculator (Scientific)", "sku": "STA-004", "cost": 120.00, "price": 219.99, "qty": 30, "cat": "Stationery"},
        {"name": "Notebook (A5, 5 Pack)", "sku": "STA-005", "cost": 45.00, "price": 79.99, "qty": 65, "cat": "Stationery"},
        
        # Sports & Outdoors
        {"name": "Soccer Ball (Size 5)", "sku": "SPO-001", "cost": 150.00, "price": 279.99, "qty": 25, "cat": "Sports & Outdoors"},
        {"name": "Yoga Mat", "sku": "SPO-002", "cost": 180.00, "price": 329.99, "qty": 20, "cat": "Sports & Outdoors"},
        {"name": "Camping Tent (2-Person)", "sku": "SPO-003", "cost": 650.00, "price": 1199.99, "qty": 8, "cat": "Sports & Outdoors"},
        {"name": "Water Bottle (1L)", "sku": "SPO-004", "cost": 65.00, "price": 119.99, "qty": 45, "cat": "Sports & Outdoors"},
        {"name": "Swimming Goggles", "sku": "SPO-005", "cost": 85.00, "price": 159.99, "qty": 30, "cat": "Sports & Outdoors"},
    ]
    
    products = []
    for p_data in products_data:
        product = Product(
            business_id=business.id,
            category_id=cat_map[p_data["cat"]].id,
            name=p_data["name"],
            sku=p_data["sku"],
            barcode=f"600{random.randint(1000000000, 9999999999)}",
            cost_price=Decimal(str(p_data["cost"])),
            selling_price=Decimal(str(p_data["price"])),
            quantity=p_data["qty"],
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
    
    print(f"  ✓ Created {len(products)} products")
    return products


def create_customers(db: Session, business: Business) -> list:
    """Create Cape Town area customers."""
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
    for c_data in customers_data:
        if c_data["type"] == "individual":
            customer = Customer(
                business_id=business.id,
                customer_type=CustomerType.INDIVIDUAL,
                first_name=c_data["first"],
                last_name=c_data["last"],
                email=c_data["email"],
                phone=c_data["phone"],
                city=c_data["city"],
                state="Western Cape",
                postal_code=f"80{random.randint(10, 99)}",
                country="South Africa",
            )
        else:
            customer = Customer(
                business_id=business.id,
                customer_type=CustomerType.BUSINESS,
                company_name=c_data["company"],
                email=c_data["email"],
                phone=c_data["phone"],
                tax_number=c_data.get("vat"),
                city=c_data["city"],
                state="Western Cape",
                postal_code=f"80{random.randint(10, 99)}",
                country="South Africa",
            )
        db.add(customer)
        customers.append(customer)
    
    db.commit()
    for cust in customers:
        db.refresh(cust)
    
    print(f"  ✓ Created {len(customers)} customers")
    return customers


def create_orders(db: Session, business: Business, customers: list, products: list) -> list:
    """Create sample orders with items."""
    print("Creating orders...")
    
    orders = []
    order_num = 1000
    
    # Create orders for the past 30 days
    for i in range(25):
        order_date = datetime.now() - timedelta(days=random.randint(0, 30))
        customer = random.choice(customers)
        
        # Random order items (2-5 products)
        num_items = random.randint(2, 5)
        selected_products = random.sample(products, min(num_items, len(products)))
        
        # Calculate totals
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
        
        # Determine status
        status_choices = [
            (OrderStatus.DELIVERED, PaymentStatus.PAID, 0.5),
            (OrderStatus.SHIPPED, PaymentStatus.PAID, 0.15),
            (OrderStatus.PROCESSING, PaymentStatus.PAID, 0.1),
            (OrderStatus.CONFIRMED, PaymentStatus.PENDING, 0.1),
            (OrderStatus.PENDING, PaymentStatus.PENDING, 0.1),
            (OrderStatus.CANCELLED, PaymentStatus.PENDING, 0.05),
        ]
        
        rand = random.random()
        cumulative = 0
        order_status = OrderStatus.PENDING
        payment_status = PaymentStatus.PENDING
        
        for os, ps, prob in status_choices:
            cumulative += prob
            if rand < cumulative:
                order_status = os
                payment_status = ps
                break
        
        amount_paid = total if payment_status == PaymentStatus.PAID else Decimal("0")
        
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
            payment_method="card" if payment_status == PaymentStatus.PAID else None,
            order_date=order_date,
            source="manual",
        )
        db.add(order)
        db.flush()  # Get the order ID
        
        # Add order items
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
    print(f"  ✓ Created {len(orders)} orders with items")
    return orders


def create_invoices(db: Session, business: Business, orders: list) -> list:
    """Create invoices for completed orders."""
    print("Creating invoices...")
    
    invoices = []
    inv_num = 1000
    
    # Create invoices for delivered/paid orders
    paid_orders = [o for o in orders if o.payment_status == PaymentStatus.PAID]
    
    for order in paid_orders[:15]:  # Create invoices for first 15 paid orders
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
        
        # Add invoice items based on order items
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
    print(f"  ✓ Created {len(invoices)} invoices")
    return invoices


def update_customer_metrics(db: Session, business: Business):
    """Update customer metrics based on orders."""
    print("Updating customer metrics...")
    
    customers = db.query(Customer).filter(Customer.business_id == business.id).all()
    
    for customer in customers:
        orders = db.query(Order).filter(
            Order.customer_id == customer.id,
            Order.payment_status == PaymentStatus.PAID,
        ).all()
        
        if orders:
            customer.total_orders = len(orders)
            customer.total_spent = sum(o.total for o in orders)
            customer.average_order_value = customer.total_spent / len(orders)
    
    db.commit()
    print("  ✓ Customer metrics updated")


def main():
    """Run seed script."""
    print("=" * 60)
    print("BizPilot Cape Town Seed Script")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Clear existing data
        clear_data(db)
        
        # Create core entities
        user = create_demo_user(db)
        org = create_organization(db, user)
        business = create_business(db, org)
        roles = create_roles(db, business)
        
        # Link user to business
        link_user_to_business(db, user, business, roles["admin"])
        
        # Create business data
        categories = create_categories(db, business)
        products = create_products(db, business, categories)
        customers = create_customers(db, business)
        orders = create_orders(db, business, customers, products)
        invoices = create_invoices(db, business, orders)
        
        # Update metrics
        update_customer_metrics(db, business)
        
        # Summary
        print("\n" + "=" * 60)
        print("Seeding Complete!")
        print("=" * 60)
        print(f"\n📧 Demo Login:")
        print(f"   Email: demo@bizpilot.co.za")
        print(f"   Password: Demo@2024")
        print(f"\n🏢 Business: {business.name}")
        print(f"   Location: {business.address_city}, {business.address_state}")
        print(f"   Currency: {business.currency}")
        print(f"   VAT Rate: {business.vat_rate}%")
        print(f"\n📊 Data Summary:")
        print(f"   Categories: {len(categories)}")
        print(f"   Products: {len(products)}")
        print(f"   Customers: {len(customers)}")
        print(f"   Orders: {len(orders)}")
        print(f"   Invoices: {len(invoices)}")
        print("=" * 60)
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
