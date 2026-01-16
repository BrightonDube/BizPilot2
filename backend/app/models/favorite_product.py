"""Favorite product model for quick access and par level management."""

from sqlalchemy import Column, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class FavoriteProduct(BaseModel):
    """Favorite product with par level for automatic reordering."""

    __tablename__ = "favorite_products"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)  # Optional: per-user favorites
    
    # Par level settings
    par_level = Column(Integer, nullable=False, default=0)  # Desired stock level
    auto_reorder = Column(Boolean, default=False)  # Enable automatic reorder suggestions
    reorder_quantity = Column(Integer, nullable=True)  # Quantity to reorder (overrides product default)
    
    # Sort order for display
    sort_order = Column(Integer, default=0)
    
    # Relationships
    product = relationship("Product", lazy="joined")

    def __repr__(self) -> str:
        return f"<FavoriteProduct product_id={self.product_id} par_level={self.par_level}>"

    @property
    def needs_reorder(self) -> bool:
        """Check if product needs reordering based on par level."""
        if not self.product or not self.auto_reorder:
            return False
        return self.product.quantity < self.par_level

    @property
    def quantity_to_order(self) -> int:
        """Calculate quantity needed to reach par level."""
        if not self.product:
            return 0
        shortage = self.par_level - self.product.quantity
        if shortage <= 0:
            return 0
        # Use custom reorder quantity or default to shortage
        return self.reorder_quantity if self.reorder_quantity else shortage
