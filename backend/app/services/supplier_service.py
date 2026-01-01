"""Supplier service for business logic."""

from typing import List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierUpdate


class SupplierService:
    """Service for supplier operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_suppliers(
        self,
        business_id: str,
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        tag: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Tuple[List[Supplier], int]:
        query = self.db.query(Supplier).filter(
            Supplier.business_id == business_id,
            Supplier.deleted_at.is_(None),
        )

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Supplier.name.ilike(search_term),
                    Supplier.contact_name.ilike(search_term),
                    Supplier.email.ilike(search_term),
                    Supplier.phone.ilike(search_term),
                )
            )

        if tag:
            query = query.filter(Supplier.tags.any(tag))

        total = query.count()

        sort_column = getattr(Supplier, sort_by, Supplier.created_at)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        offset = (page - 1) * per_page
        suppliers = query.offset(offset).limit(per_page).all()

        return suppliers, total

    def get_supplier(self, supplier_id: str, business_id: str) -> Optional[Supplier]:
        return self.db.query(Supplier).filter(
            Supplier.id == supplier_id,
            Supplier.business_id == business_id,
            Supplier.deleted_at.is_(None),
        ).first()

    def get_supplier_by_email(self, email: str, business_id: str) -> Optional[Supplier]:
        return self.db.query(Supplier).filter(
            Supplier.email == email,
            Supplier.business_id == business_id,
            Supplier.deleted_at.is_(None),
        ).first()

    def create_supplier(self, business_id: str, data: SupplierCreate) -> Supplier:
        supplier = Supplier(
            business_id=business_id,
            name=data.name,
            contact_name=data.contact_name,
            email=data.email,
            phone=data.phone,
            tax_number=data.tax_number,
            website=data.website,
            address_line1=data.address_line1,
            address_line2=data.address_line2,
            city=data.city,
            state=data.state,
            postal_code=data.postal_code,
            country=data.country,
            notes=data.notes,
            tags=data.tags or [],
        )
        self.db.add(supplier)
        self.db.commit()
        self.db.refresh(supplier)
        return supplier

    def update_supplier(self, supplier: Supplier, data: SupplierUpdate) -> Supplier:
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(supplier, field, value)
        self.db.commit()
        self.db.refresh(supplier)
        return supplier

    def delete_supplier(self, supplier: Supplier) -> None:
        supplier.soft_delete()
        self.db.commit()
