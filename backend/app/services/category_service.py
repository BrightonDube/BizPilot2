"""Category service for business logic."""

from typing import Optional, Tuple, List, Dict
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.product import ProductCategory
from app.models.business_user import BusinessUser
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoryTreeNode,
)


class CategoryService:
    """Service for category operations."""

    def __init__(self, db: Session):
        self.db = db

    def _get_user_business_id(self, user_id: UUID) -> Optional[UUID]:
        """Get the business ID for a user."""
        business_user = self.db.query(BusinessUser).filter(
            BusinessUser.user_id == user_id
        ).first()
        return business_user.business_id if business_user else None

    def list_categories(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100,
        parent_id: Optional[UUID] = None,
    ) -> Tuple[List[CategoryResponse], int]:
        """List categories with pagination."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            return [], 0

        query = self.db.query(ProductCategory).filter(
            ProductCategory.business_id == business_id
        )

        if parent_id is not None:
            query = query.filter(ProductCategory.parent_id == parent_id)

        total = query.count()
        categories = query.order_by(ProductCategory.sort_order, ProductCategory.name).offset(skip).limit(limit).all()

        return [self._to_response(cat) for cat in categories], total

    def get_category_tree(self, user_id: UUID) -> List[CategoryTreeNode]:
        """Get hierarchical category tree."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            return []

        # Get all categories for the business
        categories = self.db.query(ProductCategory).filter(
            ProductCategory.business_id == business_id
        ).order_by(ProductCategory.sort_order, ProductCategory.name).all()

        # Build tree structure
        category_map: Dict[UUID, CategoryTreeNode] = {}
        root_categories: List[CategoryTreeNode] = []

        # First pass: create all nodes
        for cat in categories:
            node = CategoryTreeNode(
                id=cat.id,
                name=cat.name,
                description=cat.description,
                image_url=cat.image_url,
                sort_order=cat.sort_order,
                parent_id=cat.parent_id,
                children=[],
            )
            category_map[cat.id] = node

        # Second pass: build tree
        for cat in categories:
            node = category_map[cat.id]
            if cat.parent_id and cat.parent_id in category_map:
                category_map[cat.parent_id].children.append(node)
            else:
                root_categories.append(node)

        return root_categories

    def create_category(self, category_data: CategoryCreate, user_id: UUID) -> CategoryResponse:
        """Create a new category."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            raise ValueError("User not associated with a business")

        # Validate parent exists if specified
        if category_data.parent_id:
            parent = self.db.query(ProductCategory).filter(
                ProductCategory.id == category_data.parent_id,
                ProductCategory.business_id == business_id,
            ).first()
            if not parent:
                raise ValueError("Parent category not found")

        category = ProductCategory(
            business_id=business_id,
            parent_id=category_data.parent_id,
            name=category_data.name,
            description=category_data.description,
            image_url=category_data.image_url,
            sort_order=category_data.sort_order,
        )

        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)

        return self._to_response(category)

    def get_category(self, category_id: UUID, user_id: UUID) -> Optional[CategoryResponse]:
        """Get a category by ID."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            return None

        category = self.db.query(ProductCategory).filter(
            ProductCategory.id == category_id,
            ProductCategory.business_id == business_id,
        ).first()

        return self._to_response(category) if category else None

    def update_category(
        self, category_id: UUID, category_data: CategoryUpdate, user_id: UUID
    ) -> Optional[CategoryResponse]:
        """Update a category."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            return None

        category = self.db.query(ProductCategory).filter(
            ProductCategory.id == category_id,
            ProductCategory.business_id == business_id,
        ).first()

        if not category:
            return None

        # Validate parent if changing
        if category_data.parent_id is not None:
            if category_data.parent_id == category_id:
                raise ValueError("Category cannot be its own parent")
            
            if category_data.parent_id:
                parent = self.db.query(ProductCategory).filter(
                    ProductCategory.id == category_data.parent_id,
                    ProductCategory.business_id == business_id,
                ).first()
                if not parent:
                    raise ValueError("Parent category not found")

        for field, value in category_data.model_dump(exclude_unset=True).items():
            setattr(category, field, value)

        self.db.commit()
        self.db.refresh(category)
        return self._to_response(category)

    def delete_category(self, category_id: UUID, user_id: UUID) -> bool:
        """Delete a category."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            return False

        category = self.db.query(ProductCategory).filter(
            ProductCategory.id == category_id,
            ProductCategory.business_id == business_id,
        ).first()

        if not category:
            return False

        # Move children to parent (or root)
        self.db.query(ProductCategory).filter(
            ProductCategory.parent_id == category_id
        ).update({ProductCategory.parent_id: category.parent_id})

        self.db.delete(category)
        self.db.commit()
        return True

    def reorder_categories(
        self, category_orders: List[dict], user_id: UUID
    ) -> bool:
        """Reorder categories by updating sort_order."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            return False

        for item in category_orders:
            category_id = item.get("id")
            sort_order = item.get("sort_order", 0)
            parent_id = item.get("parent_id")

            category = self.db.query(ProductCategory).filter(
                ProductCategory.id == category_id,
                ProductCategory.business_id == business_id,
            ).first()

            if category:
                category.sort_order = sort_order
                if parent_id is not None:
                    category.parent_id = parent_id

        self.db.commit()
        return True

    def _to_response(self, category: ProductCategory) -> CategoryResponse:
        """Convert category model to response."""
        return CategoryResponse(
            id=category.id,
            name=category.name,
            description=category.description,
            image_url=category.image_url,
            sort_order=category.sort_order,
            parent_id=category.parent_id,
        )
