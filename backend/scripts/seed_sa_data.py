#!/usr/bin/env python
"""Seed the database with South African business data."""

import sys
import os
import random
import json
from datetime import datetime, date, timedelta
from decimal import Decimal

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.user import User, UserStatus
from app.models.organization import Organization
from app.models.business import Business
from app.models.role import Role, DEFAULT_ROLES
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.models.product import Product, ProductStatus
from app.models.customer import Customer, CustomerType
from app.models.order import Order, OrderStatus, PaymentStatus, OrderItem
from app.models.invoice import Invoice, InvoiceStatus, InvoiceItem
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# South African Cities with Provinces
SA_CITIES = {
    "Johannesburg": "Gauteng",
    "Cape Town": "Western Cape",
    "Durban": "KwaZulu-Natal",
    "Pretoria": "Gauteng",
    "Port Elizabeth": "Eastern Cape",
    "Bloemfontein": "Free State",
    "Nelspruit": "Mpumalanga",
    "Polokwane": "Limpopo",
    "Kimberley": "Northern Cape",
    "Rustenburg": "North West",
    "Sandton": "Gauteng",
    "Centurion": "Gauteng",
}

# South African Streets
SA_STREETS = [
    "Nelson Mandela Drive", "Jan Smuts Avenue", "Main Road", "Church Street",
    "Long Street", "Bree Street", "Commissioner Street", "Voortrekker Road",
    "Oxford Road", "Rivonia Road", "William Nicol Drive", "OR Tambo Road"
]

# South African Hardware Products
SA_PRODUCTS = [
    {"name": "Portland Cement 50kg", "sku": "CEM-50KG", "price": 95.00, "cost": 72.00},
    {"name": "River Sand 1 Ton", "sku": "SND-1TON", "price": 850.00, "cost": 620.00},
    {"name": "Building Bricks (500)", "sku": "BRK-500", "price": 1250.00, "cost": 890.00},
    {"name": "Roof Sheets IBR 3m", "sku": "RFS-3M", "price": 185.00, "cost": 135.00},
    {"name": "PVC Pipe 110mm 6m", "sku": "PVC-110", "price": 295.00, "cost": 210.00},
    {"name": "Makita Drill 18V", "sku": "DRL-MAK18", "price": 2499.00, "cost": 1850.00},
    {"name": "Bosch Angle Grinder 115mm", "sku": "AGR-BSH", "price": 899.00, "cost": 650.00},
    {"name": "Stanley Hammer Claw 20oz", "sku": "HMR-STN", "price": 189.00, "cost": 125.00},
    {"name": "Wheelbarrow 65L", "sku": "WHL-65L", "price": 899.00, "cost": 650.00},
    {"name": "Plascon Wall Paint 20L White", "sku": "PNT-20W", "price": 1150.00, "cost": 820.00},
    {"name": "Dulux Weathershield 5L", "sku": "PNT-DLX5", "price": 650.00, "cost": 480.00},
    {"name": "Paint Roller Set 230mm", "sku": "RLR-230", "price": 125.00, "cost": 75.00},
    {"name": "Electrical Cable 2.5mm 100m", "sku": "ELC-100M", "price": 1450.00, "cost": 1050.00},
    {"name": "LED Bulb 9W Warm White (10)", "sku": "LED-9W-10", "price": 350.00, "cost": 220.00},
    {"name": "Extension Cord 10m", "sku": "EXT-10M", "price": 175.00, "cost": 110.00},
    {"name": "Geyser 150L Kwikot", "sku": "GYS-150L", "price": 4500.00, "cost": 3200.00},
    {"name": "Basin Mixer Tap Chrome", "sku": "TAP-CHR", "price": 650.00, "cost": 420.00},
    {"name": "Toilet Suite Complete", "sku": "TLT-SET", "price": 1899.00, "cost": 1350.00},
    {"name": "Padlock Heavy Duty 60mm", "sku": "PDL-60", "price": 189.00, "cost": 120.00},
    {"name": "Security Gate Steel", "sku": "SGT-STL", "price": 2500.00, "cost": 1750.00},
]

# South African Names
SA_FIRST_NAMES = [
    "Thabo", "Sipho", "Johan", "Pieter", "Nelson", "Mandla", "Willem", "Bongani",
    "Lindiwe", "Nomvula", "Precious", "Thandiwe", "Maria", "Zanele", "Lerato"
]

SA_LAST_NAMES = [
    "Nkosi", "Dlamini", "Van der Merwe", "Botha", "Ndlovu", "Zulu", "Pretorius",
    "Mokoena", "Molefe", "Maharaj", "Pillay", "Smith", "Williams", "Khumalo"
]

SA_COMPANY_NAMES = [
    "Nkosi Construction", "Cape Builders PTY", "Joburg Hardware CC",
    "Rainbow Plumbing", "Protea Electrical", "Ubuntu Home Improvements",
    "Kruger Building Supplies", "Soweto DIY Centre", "Durban Decor",
    "Highveld Hardware"
]


def generate_phone():
    """Generate SA phone number."""
    prefixes = ["011", "012", "021", "031", "082", "083", "084", "072", "073"]
    prefix = random.choice(prefixes)
    number = "".join([str(random.randint(0, 9)) for _ in range(7)])
    return f"+27 {prefix} {number[:3]} {number[3:]}"


def seed_demo_user(db):
    """Create demo user."""
    print("Creating demo user...")
    
    existing = db.query(User).filter(User.email == "demo@bizpilot.co.za").first()
    if existing:
        print("  Demo user already exists")
        return existing
    
    user = User(
        email="demo@bizpilot.co.za",
        hashed_password=pwd_context.hash("Demo@2024"),
        first_name="Thabo",
        last_name="Molefe",
        is_email_verified=True,
    )
    # Set status after creation - use the value
    user.status = UserStatus.ACTIVE
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"  Created: {user.email}")
    return user


def seed_organization(db, owner):
    """Create organization."""
    print("Creating organization...")
    
    existing = db.query(Organization).filter(Organization.slug == "molefe-enterprises").first()
    if existing:
        print("  Organization already exists")
        return existing
    
    org = Organization(
        name="Molefe Enterprises",
        slug="molefe-enterprises",
        owner_id=owner.id,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    print(f"  Created: {org.name}")
    return org


def seed_business(db, organization):
    """Create SA business."""
    print("Creating business...")
    
    existing = db.query(Business).filter(Business.slug == "soweto-hardware").first()
    if existing:
        print("  Business already exists")
        return existing
    
    business = Business(
        name="Soweto Hardware & Building Supplies",
        slug="soweto-hardware",
        organization_id=organization.id,
    )
    db.add(business)
    db.commit()
    db.refresh(business)
    print(f"  Created: {business.name}")
    return business


def seed_business_user(db, user, business):
    """Link user to business."""
    print("Linking user to business...")
    
    existing = db.query(BusinessUser).filter(
        BusinessUser.user_id == user.id,
        BusinessUser.business_id == business.id
    ).first()
    
    if existing:
        print("  Already linked")
        return existing
    
    # First, ensure we have the Admin role
    admin_role = db.query(Role).filter(Role.name == "Admin", Role.is_system == True).first()
    
    if not admin_role:
        # Create system roles if they don't exist
        print("  Creating system roles...")
        for role_key, role_data in DEFAULT_ROLES.items():
            existing_role = db.query(Role).filter(Role.name == role_data["name"], Role.is_system == True).first()
            if not existing_role:
                role = Role(
                    name=role_data["name"],
                    description=role_data["description"],
                    is_system=True,
                    permissions=json.dumps(role_data["permissions"]),
                )
                db.add(role)
                print(f"    Created role: {role_data['name']}")
        db.commit()
        admin_role = db.query(Role).filter(Role.name == "Admin", Role.is_system == True).first()
    
    if not admin_role:
        raise Exception("Failed to create Admin role")
    
    business_user = BusinessUser(
        user_id=user.id,
        business_id=business.id,
        role_id=admin_role.id,
        status=BusinessUserStatus.ACTIVE,
        is_primary=True,
    )
    db.add(business_user)
    db.commit()
    print("  Linked as Admin")
    return business_user


def seed_products(db, business):
    """Create SA products."""
    print("Creating products...")
    
    existing = db.query(Product).filter(Product.business_id == business.id).count()
    if existing > 0:
        print(f"  {existing} products already exist")
        return db.query(Product).filter(Product.business_id == business.id).all()
    
    products = []
    for p in SA_PRODUCTS:
        product = Product(
            business_id=business.id,
            name=p["name"],
            sku=p["sku"],
            description=f"High-quality {p['name'].lower()} for building and home improvement.",
            selling_price=Decimal(str(p["price"])),
            cost_price=Decimal(str(p["cost"])),
            is_taxable=True,
            tax_rate=Decimal("15.00"),  # SA VAT
            track_inventory=True,
            quantity=random.randint(20, 150),
            low_stock_threshold=10,
            status=ProductStatus.ACTIVE,
        )
        db.add(product)
        products.append(product)
    
    db.commit()
    for p in products:
        db.refresh(p)
    
    print(f"  Created {len(products)} products")
    return products


def seed_customers(db, business):
    """Create SA customers."""
    print("Creating customers...")
    
    existing = db.query(Customer).filter(Customer.business_id == business.id).count()
    if existing > 0:
        print(f"  {existing} customers already exist")
        return db.query(Customer).filter(Customer.business_id == business.id).all()
    
    customers = []
    
    # Individual customers
    for i in range(10):
        first_name = random.choice(SA_FIRST_NAMES)
        last_name = random.choice(SA_LAST_NAMES)
        city = random.choice(list(SA_CITIES.keys()))
        
        customer = Customer(
            business_id=business.id,
            customer_type=CustomerType.INDIVIDUAL,
            first_name=first_name,
            last_name=last_name,
            email=f"{first_name.lower()}.{last_name.lower()}@gmail.com",
            phone=generate_phone(),
            address_line1=f"{random.randint(1, 200)} {random.choice(SA_STREETS)}",
            city=city,
            state=SA_CITIES[city],
            postal_code=str(random.randint(1000, 9999)),
            country="South Africa",
            total_orders=random.randint(1, 15),
            total_spent=Decimal(str(random.randint(500, 25000))),
        )
        db.add(customer)
        customers.append(customer)
    
    # Business customers
    for company in SA_COMPANY_NAMES[:5]:
        city = random.choice(list(SA_CITIES.keys()))
        
        customer = Customer(
            business_id=business.id,
            customer_type=CustomerType.BUSINESS,
            company_name=company,
            first_name=random.choice(SA_FIRST_NAMES),
            last_name=random.choice(SA_LAST_NAMES),
            email=f"accounts@{company.lower().replace(' ', '').replace('pty', '').replace('cc', '')}.co.za",
            phone=generate_phone(),
            tax_number=f"4{random.randint(100000000, 999999999)}",
            address_line1=f"{random.randint(1, 200)} {random.choice(SA_STREETS)}",
            city=city,
            state=SA_CITIES[city],
            postal_code=str(random.randint(1000, 9999)),
            country="South Africa",
            total_orders=random.randint(5, 30),
            total_spent=Decimal(str(random.randint(10000, 150000))),
        )
        db.add(customer)
        customers.append(customer)
    
    db.commit()
    for c in customers:
        db.refresh(c)
    
    print(f"  Created {len(customers)} customers")
    return customers


def seed_orders(db, business, customers, products):
    """Create sample orders."""
    print("Creating orders...")
    
    existing = db.query(Order).filter(Order.business_id == business.id).count()
    if existing > 0:
        print(f"  {existing} orders already exist")
        return db.query(Order).filter(Order.business_id == business.id).all()
    
    orders = []
    statuses = list(OrderStatus)
    payment_statuses = list(PaymentStatus)
    
    for i in range(30):
        customer = random.choice(customers)
        order_date = datetime.now() - timedelta(days=random.randint(0, 60))
        
        # Calculate order totals
        num_items = random.randint(1, 5)
        order_products = random.sample(products, min(num_items, len(products)))
        
        subtotal = Decimal("0")
        items_data = []
        for prod in order_products:
            qty = random.randint(1, 10)
            item_total = prod.selling_price * qty
            subtotal += item_total
            items_data.append({
                "product": prod,
                "quantity": qty,
                "unit_price": prod.selling_price,
                "total": item_total,
            })
        
        tax_amount = subtotal * Decimal("0.15")  # 15% VAT
        total = subtotal + tax_amount
        
        status = random.choice(statuses)
        payment_status = random.choice(payment_statuses)
        amount_paid = total if payment_status == PaymentStatus.PAID else (total / 2 if payment_status == PaymentStatus.PARTIAL else Decimal("0"))
        
        order = Order(
            business_id=business.id,
            customer_id=customer.id,
            order_number=f"ORD-{2024}{i+1:04d}",
            status=status,
            payment_status=payment_status,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total=total,
            amount_paid=amount_paid,
            order_date=order_date,
            source="manual",
        )
        db.add(order)
        db.flush()  # Get the order ID
        
        # Create order items
        for item_data in items_data:
            order_item = OrderItem(
                order_id=order.id,
                product_id=item_data["product"].id,
                name=item_data["product"].name,
                sku=item_data["product"].sku,
                unit_price=item_data["unit_price"],
                quantity=item_data["quantity"],
                tax_rate=Decimal("15.00"),
                tax_amount=item_data["total"] * Decimal("0.15"),
                total=item_data["total"] * Decimal("1.15"),
            )
            db.add(order_item)
        
        orders.append(order)
    
    db.commit()
    for o in orders:
        db.refresh(o)
    
    print(f"  Created {len(orders)} orders with items")
    return orders


def seed_invoices(db, business, customers, orders):
    """Create sample invoices."""
    print("Creating invoices...")
    
    existing = db.query(Invoice).filter(Invoice.business_id == business.id).count()
    if existing > 0:
        print(f"  {existing} invoices already exist")
        return
    
    invoices = []
    
    # Create invoices for some orders
    for i, order in enumerate(orders[:20]):
        due_date = date.today() + timedelta(days=random.choice([7, 14, 30]))
        
        status = random.choice(list(InvoiceStatus))
        paid_date = date.today() - timedelta(days=random.randint(1, 30)) if status == InvoiceStatus.PAID else None
        
        invoice = Invoice(
            business_id=business.id,
            customer_id=order.customer_id,
            order_id=order.id,
            invoice_number=f"INV-{2024}{i+1:04d}",
            status=status,
            issue_date=date.today() - timedelta(days=random.randint(1, 45)),
            due_date=due_date,
            paid_date=paid_date,
            subtotal=order.subtotal,
            tax_amount=order.tax_amount,
            total=order.total,
            amount_paid=order.total if status == InvoiceStatus.PAID else Decimal("0"),
            notes="Thank you for your business!\nPayment details: FNB | Acc: 62845678901 | Branch: 250655",
            terms="Payment due within 30 days of invoice date.",
        )
        db.add(invoice)
        invoices.append(invoice)
    
    db.commit()
    print(f"  Created {len(invoices)} invoices")


def main():
    """Main seeding function."""
    print("=" * 60)
    print("Seeding South African Business Data")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Seed in order
        user = seed_demo_user(db)
        org = seed_organization(db, user)
        business = seed_business(db, org)
        seed_business_user(db, user, business)
        products = seed_products(db, business)
        customers = seed_customers(db, business)
        orders = seed_orders(db, business, customers, products)
        seed_invoices(db, business, customers, orders)
        
        print("=" * 60)
        print("Seeding Complete!")
        print("=" * 60)
        print(f"\nDemo Login:")
        print(f"  Email: demo@bizpilot.co.za")
        print(f"  Password: Demo@2024")
        print(f"\nBusiness: Soweto Hardware & Building Supplies")
        print(f"Currency: ZAR (South African Rand)")
        print(f"VAT Rate: 15%")
        print("=" * 60)
        
    except Exception as e:
        print(f"\nError during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
