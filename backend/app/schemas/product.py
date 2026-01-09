"""Product schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field
from datetime import datetime

from app.models.product import ProductStatus


class ProductCategoryBase(BaseModel):
    """Base schema for product category."""
    
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int = 0
    parent_id: Optional[str] = None


class ProductCategoryCreate(ProductCategoryBase):
    """Schema for creating a product category."""
    pass


class ProductCategoryUpdate(BaseModel):
    """Schema for updating a product category."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: Optional[int] = None
    parent_id: Optional[str] = None


class ProductCategoryResponse(ProductCategoryBase):
    """Schema for product category response."""
    
    id: str
    business_id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class ProductBase(BaseModel):
    """Base schema for product."""
    
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    sku: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
    
    # Pricing
    cost_price: Optional[Decimal] = Field(None, ge=0)
    selling_price: Decimal = Field(..., ge=0)
    compare_at_price: Optional[Decimal] = Field(None, ge=0)

    labor_minutes: int = Field(0, ge=0)
    
    # Tax
    is_taxable: bool = True
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    
    # Inventory
    track_inventory: bool = True
    quantity: int = Field(0, ge=0)
    low_stock_threshold: int = Field(10, ge=0)
    
    # Status
    status: ProductStatus = ProductStatus.DRAFT
    
    # Media
    image_url: Optional[str] = None
    
    # Category
    category_id: Optional[str] = None


class ProductCreate(ProductBase):
    """Schema for creating a product."""
    ingredients: Optional[List["ProductIngredientCreate"]] = None


class ProductUpdate(BaseModel):
    """Schema for updating a product."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    sku: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
    cost_price: Optional[Decimal] = Field(None, ge=0)
    selling_price: Optional[Decimal] = Field(None, ge=0)
    compare_at_price: Optional[Decimal] = Field(None, ge=0)
    is_taxable: Optional[bool] = None
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    track_inventory: Optional[bool] = None
    quantity: Optional[int] = Field(None, ge=0)
    low_stock_threshold: Optional[int] = Field(None, ge=0)
    status: Optional[ProductStatus] = None
    image_url: Optional[str] = None
    category_id: Optional[str] = None
    labor_minutes: Optional[int] = Field(None, ge=0)
    ingredients: Optional[List["ProductIngredientCreate"]] = None


class ProductResponse(ProductBase):
    """Schema for product response."""
    
    id: str
    business_id: str
    is_low_stock: bool
    profit_margin: float
    total_cost: Optional[Decimal] = None
    has_ingredients: bool = False
    ingredients: List["ProductIngredientResponse"] = []
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    """Schema for paginated product list."""
    
    items: List[ProductResponse]
    total: int
    page: int
    per_page: int
    pages: int


class ProductBulkCreate(BaseModel):
    """Schema for bulk product creation."""
    
    products: List[ProductCreate]


class ProductBulkDelete(BaseModel):
    """Schema for bulk product deletion."""
    
    product_ids: List[str]


class ProductFilter(BaseModel):
    """Schema for product filtering."""
    
    search: Optional[str] = None
    category_id: Optional[str] = None
    status: Optional[ProductStatus] = None
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    low_stock_only: bool = False


class ProductIngredientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    unit: str = Field("unit", min_length=1, max_length=50)
    quantity: Decimal = Field(..., ge=0)
    cost: Decimal = Field(..., ge=0)
    sort_order: int = 0
    source_product_id: Optional[str] = None  # Link to inventory product


class ProductIngredientCreate(ProductIngredientBase):
    pass


class ProductIngredientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    unit: Optional[str] = Field(None, min_length=1, max_length=50)
    quantity: Optional[Decimal] = Field(None, ge=0)
    cost: Optional[Decimal] = Field(None, ge=0)
    sort_order: Optional[int] = None
    source_product_id: Optional[str] = None


class ProductIngredientResponse(ProductIngredientBase):
    id: str
    business_id: str
    product_id: str
    source_product_id: Optional[str] = None
    source_product_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


ProductCreate.model_rebuild()
ProductUpdate.model_rebuild()
ProductResponse.model_rebuild()
