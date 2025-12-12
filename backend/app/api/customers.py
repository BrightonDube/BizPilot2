"""Customer API endpoints."""

import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.core.rbac import has_permission
from app.models.user import User
from app.models.customer import CustomerType
from app.schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerListResponse,
    CustomerBulkCreate,
    CustomerBulkDelete,
    CustomerMetrics,
)
from app.services.customer_service import CustomerService

router = APIRouter(prefix="/customers", tags=["Customers"])

# Hardcoded business ID for demo - in production, get from user's current business
DEMO_BUSINESS_ID = "00000000-0000-0000-0000-000000000001"


def _customer_to_response(customer) -> CustomerResponse:
    """Convert customer model to response schema."""
    return CustomerResponse(
        id=str(customer.id),
        business_id=str(customer.business_id),
        customer_type=customer.customer_type,
        first_name=customer.first_name,
        last_name=customer.last_name,
        email=customer.email,
        phone=customer.phone,
        company_name=customer.company_name,
        tax_number=customer.tax_number,
        address_line1=customer.address_line1,
        address_line2=customer.address_line2,
        city=customer.city,
        state=customer.state,
        postal_code=customer.postal_code,
        country=customer.country,
        notes=customer.notes,
        tags=customer.tags or [],
        display_name=customer.display_name,
        full_address=customer.full_address,
        total_orders=customer.total_orders,
        total_spent=customer.total_spent,
        average_order_value=customer.average_order_value,
        created_at=customer.created_at,
        updated_at=customer.updated_at,
    )


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    customer_type: Optional[CustomerType] = None,
    tag: Optional[str] = None,
    sort_by: str = Query("created_at", pattern="^(first_name|last_name|email|company_name|total_spent|total_orders|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List customers with filtering and pagination.
    """
    service = CustomerService(db)
    customers, total = service.get_customers(
        business_id=DEMO_BUSINESS_ID,
        page=page,
        per_page=per_page,
        search=search,
        customer_type=customer_type,
        tag=tag,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    
    return CustomerListResponse(
        items=[_customer_to_response(c) for c in customers],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/top", response_model=list[CustomerResponse])
async def get_top_customers(
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get top customers by total spent."""
    service = CustomerService(db)
    customers = service.get_top_customers(DEMO_BUSINESS_ID, limit)
    return [_customer_to_response(c) for c in customers]


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get a customer by ID."""
    service = CustomerService(db)
    customer = service.get_customer(customer_id, DEMO_BUSINESS_ID)
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    
    return _customer_to_response(customer)


@router.get("/{customer_id}/metrics", response_model=CustomerMetrics)
async def get_customer_metrics(
    customer_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get customer metrics (orders, spending)."""
    service = CustomerService(db)
    customer = service.get_customer(customer_id, DEMO_BUSINESS_ID)
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    
    return CustomerMetrics(
        total_orders=customer.total_orders,
        total_spent=customer.total_spent,
        average_order_value=customer.average_order_value,
        first_order_date=None,  # Would be calculated from orders table
        last_order_date=None,   # Would be calculated from orders table
    )


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    current_user: User = Depends(has_permission("customers:create")),
    db: Session = Depends(get_db),
):
    """Create a new customer."""
    service = CustomerService(db)
    
    # Check for duplicate email
    if data.email:
        existing = service.get_customer_by_email(data.email, DEMO_BUSINESS_ID)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A customer with this email already exists",
            )
    
    customer = service.create_customer(DEMO_BUSINESS_ID, data)
    return _customer_to_response(customer)


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    data: CustomerUpdate,
    current_user: User = Depends(has_permission("customers:edit")),
    db: Session = Depends(get_db),
):
    """Update a customer."""
    service = CustomerService(db)
    customer = service.get_customer(customer_id, DEMO_BUSINESS_ID)
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    
    # Check for duplicate email if changing
    if data.email and data.email != customer.email:
        existing = service.get_customer_by_email(data.email, DEMO_BUSINESS_ID)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A customer with this email already exists",
            )
    
    customer = service.update_customer(customer, data)
    return _customer_to_response(customer)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: str,
    current_user: User = Depends(has_permission("customers:delete")),
    db: Session = Depends(get_db),
):
    """Delete a customer."""
    service = CustomerService(db)
    customer = service.get_customer(customer_id, DEMO_BUSINESS_ID)
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    
    service.delete_customer(customer)


@router.post("/bulk", response_model=list[CustomerResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_customers(
    data: CustomerBulkCreate,
    current_user: User = Depends(has_permission("customers:create")),
    db: Session = Depends(get_db),
):
    """Create multiple customers at once."""
    service = CustomerService(db)
    customers = service.bulk_create_customers(DEMO_BUSINESS_ID, data.customers)
    return [_customer_to_response(c) for c in customers]


@router.post("/bulk-delete")
async def bulk_delete_customers(
    data: CustomerBulkDelete,
    current_user: User = Depends(has_permission("customers:delete")),
    db: Session = Depends(get_db),
):
    """Delete multiple customers at once."""
    service = CustomerService(db)
    deleted_count = service.bulk_delete_customers(DEMO_BUSINESS_ID, data.customer_ids)
    return {"deleted": deleted_count}
