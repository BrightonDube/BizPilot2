"""Product service for product management."""

from typing import List, Optional, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.product import Product, ProductCategory, ProductStatus
from app.schemas.product import ProductCreate, ProductUpdate, ProductCategoryCreate, ProductCategoryUpdate


class ProductService:
    """Service for product operations."""

    def __init__(self, db: Session):
        self.db = db

    # Product CRUD
    def get_product(self, product_id: str, business_id: str) -> Optional[Product]:
        """Get a product by ID."""
        return self.db.query(Product).filter(
            Product.id == product_id,
            Product.business_id == business_id,
        ).first()

    def get_products(
        self,
        business_id: str,
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        category_id: Optional[str] = None,
        status: Optional[ProductStatus] = None,
        min_price: Optional[Decimal] = None,
        max_price: Optional[Decimal] = None,
        low_stock_only: bool = False,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Tuple[List[Product], int]:
        """Get products with filtering and pagination."""
        query = self.db.query(Product).filter(Product.business_id == business_id)
        
        # Apply filters
        if search:
            search_filter = or_(
                Product.name.ilike(f"%{search}%"),
                Product.description.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
                Product.barcode.ilike(f"%{search}%"),
            )
            query = query.filter(search_filter)
        
        if category_id:
            query = query.filter(Product.category_id == category_id)
        
        if status:
            query = query.filter(Product.status == status)
        
        if min_price is not None:
            query = query.filter(Product.selling_price >= min_price)
        
        if max_price is not None:
            query = query.filter(Product.selling_price <= max_price)
        
        if low_stock_only:
            query = query.filter(
                and_(
                    Product.track_inventory == True,
                    Product.quantity <= Product.low_stock_threshold,
                )
            )
        
        # Get total count
        total = query.count()
        
        # Apply sorting
        sort_column = getattr(Product, sort_by, Product.created_at)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        
        # Apply pagination
        offset = (page - 1) * per_page
        products = query.offset(offset).limit(per_page).all()
        
        return products, total

    def create_product(self, business_id: str, data: ProductCreate) -> Product:
        """Create a new product."""
        product = Product(
            business_id=business_id,
            **data.model_dump(),
        )
        self.db.add(product)
        self.db.commit()
        self.db.refresh(product)
        return product

    def update_product(self, product: Product, data: ProductUpdate) -> Product:
        """Update a product."""
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(product, field, value)
        self.db.commit()
        self.db.refresh(product)
        return product

    def delete_product(self, product: Product) -> bool:
        """Delete a product."""
        self.db.delete(product)
        self.db.commit()
        return True

    def bulk_create_products(self, business_id: str, products_data: List[ProductCreate]) -> List[Product]:
        """Create multiple products at once."""
        products = []
        for data in products_data:
            product = Product(
                business_id=business_id,
                **data.model_dump(),
            )
            self.db.add(product)
            products.append(product)
        
        self.db.commit()
        for product in products:
            self.db.refresh(product)
        
        return products

    def bulk_delete_products(self, business_id: str, product_ids: List[str]) -> int:
        """Delete multiple products at once."""
        deleted = self.db.query(Product).filter(
            Product.id.in_(product_ids),
            Product.business_id == business_id,
        ).delete(synchronize_session=False)
        self.db.commit()
        return deleted

    def update_inventory(self, product: Product, quantity_change: int) -> Product:
        """Update product inventory quantity."""
        product.quantity += quantity_change
        if product.quantity < 0:
            product.quantity = 0
        
        # Auto-update status based on inventory
        if product.track_inventory and product.quantity == 0:
            product.status = ProductStatus.OUT_OF_STOCK
        elif product.status == ProductStatus.OUT_OF_STOCK and product.quantity > 0:
            product.status = ProductStatus.ACTIVE
        
        self.db.commit()
        self.db.refresh(product)
        return product

    # Category CRUD
    def get_category(self, category_id: str, business_id: str) -> Optional[ProductCategory]:
        """Get a category by ID."""
        return self.db.query(ProductCategory).filter(
            ProductCategory.id == category_id,
            ProductCategory.business_id == business_id,
        ).first()

    def get_categories(self, business_id: str, parent_id: Optional[str] = None) -> List[ProductCategory]:
        """Get all categories for a business."""
        query = self.db.query(ProductCategory).filter(ProductCategory.business_id == business_id)
        if parent_id is not None:
            query = query.filter(ProductCategory.parent_id == parent_id)
        return query.order_by(ProductCategory.sort_order).all()

    def create_category(self, business_id: str, data: ProductCategoryCreate) -> ProductCategory:
        """Create a new category."""
        category = ProductCategory(
            business_id=business_id,
            **data.model_dump(),
        )
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def update_category(self, category: ProductCategory, data: ProductCategoryUpdate) -> ProductCategory:
        """Update a category."""
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(category, field, value)
        self.db.commit()
        self.db.refresh(category)
        return category

    def delete_category(self, category: ProductCategory) -> bool:
        """Delete a category."""
        # Move products to uncategorized
        self.db.query(Product).filter(Product.category_id == category.id).update(
            {"category_id": None},
            synchronize_session=False,
        )
        self.db.delete(category)
        self.db.commit()
        return True
