"""Product-Supplier association model for managing product-supplier relationships."""

from sqlalchemy import Column, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class ProductSupplier(BaseModel):
    """Association table for many-to-many relationship between products and suppliers."""

    __tablename__ = "product_suppliers"
    
    __table_args__ = (
        UniqueConstraint('product_id', 'supplier_id', name='uq_product_supplier'),
    )

    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<ProductSupplier product={self.product_id} supplier={self.supplier_id}>"
