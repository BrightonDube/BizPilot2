"""Customer service for business logic."""

from typing import List, Optional, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.customer import Customer, CustomerType
from app.schemas.customer import CustomerCreate, CustomerUpdate


class CustomerService:
    """Service for customer operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_customers(
        self,
        business_id: str,
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        customer_type: Optional[CustomerType] = None,
        tag: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Tuple[List[Customer], int]:
        """Get customers with filtering and pagination."""
        query = self.db.query(Customer).filter(
            Customer.business_id == business_id,
            Customer.deleted_at.is_(None),
        )
        
        # Search filter
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Customer.first_name.ilike(search_term),
                    Customer.last_name.ilike(search_term),
                    Customer.email.ilike(search_term),
                    Customer.phone.ilike(search_term),
                    Customer.company_name.ilike(search_term),
                )
            )
        
        # Type filter
        if customer_type:
            query = query.filter(Customer.customer_type == customer_type)
        
        # Tag filter
        if tag:
            query = query.filter(Customer.tags.any(tag))
        
        # Get total count
        total = query.count()
        
        # Sorting
        sort_column = getattr(Customer, sort_by, Customer.created_at)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        
        # Pagination
        offset = (page - 1) * per_page
        customers = query.offset(offset).limit(per_page).all()
        
        return customers, total

    def get_customer(self, customer_id: str, business_id: str) -> Optional[Customer]:
        """Get a customer by ID."""
        return self.db.query(Customer).filter(
            Customer.id == customer_id,
            Customer.business_id == business_id,
            Customer.deleted_at.is_(None),
        ).first()

    def get_customer_by_email(self, email: str, business_id: str) -> Optional[Customer]:
        """Get a customer by email."""
        return self.db.query(Customer).filter(
            Customer.email == email,
            Customer.business_id == business_id,
            Customer.deleted_at.is_(None),
        ).first()

    def create_customer(self, business_id: str, data: CustomerCreate) -> Customer:
        """Create a new customer."""
        customer = Customer(
            business_id=business_id,
            customer_type=data.customer_type,
            first_name=data.first_name,
            last_name=data.last_name,
            email=data.email,
            phone=data.phone,
            company_name=data.company_name,
            tax_number=data.tax_number,
            address_line1=data.address_line1,
            address_line2=data.address_line2,
            city=data.city,
            state=data.state,
            postal_code=data.postal_code,
            country=data.country,
            notes=data.notes,
            tags=data.tags or [],
        )
        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def update_customer(self, customer: Customer, data: CustomerUpdate) -> Customer:
        """Update a customer."""
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(customer, field, value)
        
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def delete_customer(self, customer: Customer) -> None:
        """Soft delete a customer."""
        from datetime import datetime
        customer.deleted_at = datetime.utcnow()
        self.db.commit()

    def bulk_create_customers(
        self, business_id: str, customers_data: List[CustomerCreate]
    ) -> List[Customer]:
        """Bulk create customers."""
        customers = []
        for data in customers_data:
            customer = Customer(
                business_id=business_id,
                customer_type=data.customer_type,
                first_name=data.first_name,
                last_name=data.last_name,
                email=data.email,
                phone=data.phone,
                company_name=data.company_name,
                tax_number=data.tax_number,
                address_line1=data.address_line1,
                address_line2=data.address_line2,
                city=data.city,
                state=data.state,
                postal_code=data.postal_code,
                country=data.country,
                notes=data.notes,
                tags=data.tags or [],
            )
            customers.append(customer)
        
        self.db.add_all(customers)
        self.db.commit()
        for customer in customers:
            self.db.refresh(customer)
        return customers

    def bulk_delete_customers(self, business_id: str, customer_ids: List[str]) -> int:
        """Bulk soft delete customers."""
        from datetime import datetime
        result = self.db.query(Customer).filter(
            Customer.id.in_(customer_ids),
            Customer.business_id == business_id,
            Customer.deleted_at.is_(None),
        ).update({Customer.deleted_at: datetime.utcnow()}, synchronize_session=False)
        self.db.commit()
        return result

    def update_customer_metrics(self, customer: Customer, order_total: Decimal) -> None:
        """Update customer metrics after an order."""
        customer.total_orders += 1
        customer.total_spent += order_total
        if customer.total_orders > 0:
            customer.average_order_value = customer.total_spent / customer.total_orders
        self.db.commit()

    def get_top_customers(
        self, business_id: str, limit: int = 10
    ) -> List[Customer]:
        """Get top customers by total spent."""
        return self.db.query(Customer).filter(
            Customer.business_id == business_id,
            Customer.deleted_at.is_(None),
        ).order_by(Customer.total_spent.desc()).limit(limit).all()
