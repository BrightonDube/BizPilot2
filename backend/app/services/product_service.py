"""Product service for product management."""

from typing import List, Optional, Tuple
from decimal import Decimal
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.product import Product, ProductCategory, ProductStatus
from app.models.product_ingredient import ProductIngredient
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductCategoryCreate,
    ProductCategoryUpdate,
    ProductIngredientCreate,
    ProductIngredientUpdate,
)


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
            Product.deleted_at.is_(None),
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
        query = self.db.query(Product).filter(
            Product.business_id == business_id,
            Product.deleted_at.is_(None),
        )
        
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
                    Product.track_inventory.is_(True),
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
        ingredient_payloads = data.ingredients
        data_dict = data.model_dump(exclude={"ingredients"})
        product = Product(
            business_id=business_id,
            **data_dict,
        )
        self.db.add(product)
        self.db.flush()

        if ingredient_payloads:
            self.replace_product_ingredients(
                product=product,
                business_id=business_id,
                ingredients=ingredient_payloads,
            )
        self.db.commit()
        self.db.refresh(product)
        return product

    def update_product(self, product: Product, data: ProductUpdate) -> Product:
        """Update a product."""
        update_data = data.model_dump(exclude_unset=True)
        ingredient_payloads = update_data.pop("ingredients", None)
        for field, value in update_data.items():
            setattr(product, field, value)

        if ingredient_payloads is not None:
            self.replace_product_ingredients(
                product=product,
                business_id=str(product.business_id),
                ingredients=ingredient_payloads,
            )
        self.db.commit()
        self.db.refresh(product)
        return product

    # Ingredients/BOM
    def list_product_ingredients(self, product_id: str, business_id: str) -> List[ProductIngredient]:
        return (
            self.db.query(ProductIngredient)
            .filter(
                ProductIngredient.product_id == product_id,
                ProductIngredient.business_id == business_id,
                ProductIngredient.deleted_at.is_(None),
            )
            .order_by(ProductIngredient.sort_order.asc())
            .all()
        )

    def add_product_ingredient(
        self,
        product_id: str,
        business_id: str,
        data: ProductIngredientCreate,
    ) -> ProductIngredient:
        ingredient = ProductIngredient(
            business_id=business_id,
            product_id=product_id,
            **data.model_dump(),
        )
        self.db.add(ingredient)
        self.db.commit()
        self.db.refresh(ingredient)
        return ingredient

    def update_product_ingredient(
        self,
        ingredient: ProductIngredient,
        data: ProductIngredientUpdate,
    ) -> ProductIngredient:
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(ingredient, field, value)
        self.db.commit()
        self.db.refresh(ingredient)
        return ingredient

    def delete_product_ingredient(self, ingredient: ProductIngredient) -> None:
        ingredient.soft_delete()
        self.db.commit()

    def replace_product_ingredients(
        self,
        product: Product,
        business_id: str,
        ingredients: List[ProductIngredientCreate],
    ) -> None:
        # Soft-delete existing ingredients
        existing = self.db.query(ProductIngredient).filter(
            ProductIngredient.product_id == product.id,
            ProductIngredient.business_id == business_id,
            ProductIngredient.deleted_at.is_(None),
        )
        for ing in existing:
            ing.soft_delete()

        for i, ing in enumerate(ingredients):
            ing_dict = ing.model_dump()
            if "sort_order" not in ing_dict or ing_dict["sort_order"] is None:
                ing_dict["sort_order"] = i
            self.db.add(
                ProductIngredient(
                    business_id=business_id,
                    product_id=product.id,
                    **ing_dict,
                )
            )

    def delete_product(self, product: Product) -> bool:
        """Soft delete a product."""
        product.soft_delete()
        self.db.commit()
        return True

    def bulk_create_products(self, business_id: str, products_data: List[ProductCreate]) -> List[Product]:
        """Create multiple products at once."""
        products = []
        for data in products_data:
            ingredient_payloads = data.ingredients
            data_dict = data.model_dump(exclude={"ingredients"})
            product = Product(business_id=business_id, **data_dict)
            if product.id is None:
                product.id = uuid.uuid4()
            self.db.add(product)
            self.db.flush()
            if ingredient_payloads:
                for i, ing in enumerate(ingredient_payloads):
                    ing_dict = ing.model_dump()
                    if "sort_order" not in ing_dict or ing_dict["sort_order"] is None:
                        ing_dict["sort_order"] = i
                    self.db.add(
                        ProductIngredient(
                            business_id=business_id,
                            product_id=product.id,
                            **ing_dict,
                        )
                    )
            products.append(product)
        
        self.db.commit()
        for product in products:
            self.db.refresh(product)
        
        return products

    def bulk_delete_products(self, business_id: str, product_ids: List[str], max_ids: int = 100) -> int:
        """Soft delete multiple products at once.
        
        Args:
            business_id: The business ID to scope the deletion
            product_ids: List of product IDs to delete (max 100)
            max_ids: Maximum number of IDs allowed (default 100)
        
        Returns:
            Number of products deleted
        
        Raises:
            ValueError: If product_ids exceeds max_ids limit
        """
        if len(product_ids) > max_ids:
            raise ValueError(f"Cannot delete more than {max_ids} products at once")
        
        from app.models.base import utc_now
        deleted = self.db.query(Product).filter(
            Product.id.in_(product_ids),
            Product.business_id == business_id,
            Product.deleted_at.is_(None),
        ).update({"deleted_at": utc_now()}, synchronize_session=False)
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
