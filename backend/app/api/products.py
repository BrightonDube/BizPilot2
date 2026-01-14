"""Product API endpoints."""

import math
from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_business_id, get_current_active_user
from app.core.rbac import has_permission
from app.models.product import Product, ProductStatus
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductBulkCreate,
    ProductBulkDelete,
    ProductIngredientCreate,
    ProductIngredientUpdate,
    ProductIngredientResponse,
)
from app.services.product_service import ProductService
from app.services.product_excel_service import ProductExcelService

router = APIRouter(prefix="/products", tags=["Products"])


def _product_to_response(product: Product) -> ProductResponse:
    """Convert a Product model to ProductResponse schema."""
    ingredients = [
        ProductIngredientResponse(
            id=str(ing.id),
            business_id=str(ing.business_id),
            product_id=str(ing.product_id),
            source_product_id=str(ing.source_product_id) if ing.source_product_id else None,
            source_product_name=ing.source_product.name if ing.source_product else None,
            name=ing.name,
            unit=ing.unit,
            quantity=ing.quantity,
            cost=ing.cost,
            sort_order=ing.sort_order,
            created_at=ing.created_at,
            updated_at=ing.updated_at,
        )
        for ing in (product.ingredients or [])
        if ing.deleted_at is None
    ]

    total_cost = None
    if product.has_ingredients:
        total_cost = Decimal(str(product.ingredients_total_cost))

    return ProductResponse(
        id=str(product.id),
        business_id=str(product.business_id),
        name=product.name,
        description=product.description,
        sku=product.sku,
        barcode=product.barcode,
        cost_price=product.cost_price,
        selling_price=product.selling_price,
        compare_at_price=product.compare_at_price,
        labor_minutes=product.labor_minutes or 0,
        is_taxable=product.is_taxable,
        tax_rate=product.tax_rate,
        track_inventory=product.track_inventory,
        quantity=product.quantity,
        low_stock_threshold=product.low_stock_threshold,
        status=product.status,
        image_url=product.image_url,
        category_id=str(product.category_id) if product.category_id else None,
        is_low_stock=product.is_low_stock,
        profit_margin=product.profit_margin,
        total_cost=total_cost,
        has_ingredients=product.has_ingredients,
        ingredients=ingredients,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


@router.get("/{product_id}/ingredients", response_model=list[ProductIngredientResponse])
async def list_product_ingredients(
    product_id: str,
    current_user: User = Depends(has_permission("products:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    ingredients = service.list_product_ingredients(product_id=product_id, business_id=business_id)
    return [
        ProductIngredientResponse(
            id=str(ing.id),
            business_id=str(ing.business_id),
            product_id=str(ing.product_id),
            name=ing.name,
            unit=ing.unit,
            quantity=ing.quantity,
            cost=ing.cost,
            sort_order=ing.sort_order,
            created_at=ing.created_at,
            updated_at=ing.updated_at,
        )
        for ing in ingredients
    ]


@router.post("/{product_id}/ingredients", response_model=ProductIngredientResponse, status_code=status.HTTP_201_CREATED)
async def create_product_ingredient(
    product_id: str,
    data: ProductIngredientCreate,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    ing = service.add_product_ingredient(product_id=product_id, business_id=business_id, data=data)
    return ProductIngredientResponse(
        id=str(ing.id),
        business_id=str(ing.business_id),
        product_id=str(ing.product_id),
        name=ing.name,
        unit=ing.unit,
        quantity=ing.quantity,
        cost=ing.cost,
        sort_order=ing.sort_order,
        created_at=ing.created_at,
        updated_at=ing.updated_at,
    )


@router.put("/{product_id}/ingredients/{ingredient_id}", response_model=ProductIngredientResponse)
async def update_product_ingredient(
    product_id: str,
    ingredient_id: str,
    data: ProductIngredientUpdate,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    from app.models.product_ingredient import ProductIngredient

    ingredient = db.query(ProductIngredient).filter(
        ProductIngredient.id == ingredient_id,
        ProductIngredient.product_id == product_id,
        ProductIngredient.business_id == business_id,
        ProductIngredient.deleted_at.is_(None),
    ).first()
    if not ingredient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found")

    ing = service.update_product_ingredient(ingredient, data)
    return ProductIngredientResponse(
        id=str(ing.id),
        business_id=str(ing.business_id),
        product_id=str(ing.product_id),
        name=ing.name,
        unit=ing.unit,
        quantity=ing.quantity,
        cost=ing.cost,
        sort_order=ing.sort_order,
        created_at=ing.created_at,
        updated_at=ing.updated_at,
    )


@router.delete("/{product_id}/ingredients/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_ingredient(
    product_id: str,
    ingredient_id: str,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    from app.models.product_ingredient import ProductIngredient

    ingredient = db.query(ProductIngredient).filter(
        ProductIngredient.id == ingredient_id,
        ProductIngredient.product_id == product_id,
        ProductIngredient.business_id == business_id,
        ProductIngredient.deleted_at.is_(None),
    ).first()
    if not ingredient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found")

    service.delete_product_ingredient(ingredient)


@router.get("", response_model=ProductListResponse)
async def list_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    status: Optional[ProductStatus] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    low_stock_only: bool = False,
    sort_by: str = Query("created_at", pattern="^(name|selling_price|quantity|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(has_permission("products:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """
    List products with filtering and pagination.
    """
    service = ProductService(db)
    products, total = service.get_products(
        business_id=business_id,
        page=page,
        per_page=per_page,
        search=search,
        category_id=category_id,
        status=status,
        min_price=min_price,
        max_price=max_price,
        low_stock_only=low_stock_only,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    
    return ProductListResponse(
        items=[_product_to_response(p) for p in products],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    current_user: User = Depends(has_permission("products:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get a product by ID."""
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    return _product_to_response(product)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    current_user: User = Depends(has_permission("products:create")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Create a new product."""
    service = ProductService(db)
    product = service.create_product(business_id, data)
    
    return _product_to_response(product)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    data: ProductUpdate,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Update a product."""
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    product = service.update_product(product, data)
    
    return _product_to_response(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    current_user: User = Depends(has_permission("products:delete")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Delete a product."""
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    service.delete_product(product)


@router.post("/bulk", response_model=list[ProductResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_products(
    data: ProductBulkCreate,
    current_user: User = Depends(has_permission("products:create")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Create multiple products at once."""
    service = ProductService(db)
    products = service.bulk_create_products(business_id, data.products)
    
    return [_product_to_response(p) for p in products]


@router.post("/bulk-delete")
async def bulk_delete_products(
    data: ProductBulkDelete,
    current_user: User = Depends(has_permission("products:delete")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Delete multiple products at once."""
    service = ProductService(db)
    deleted_count = service.bulk_delete_products(business_id, data.product_ids)
    
    return {"deleted": deleted_count}


# Excel Import/Export Endpoints

@router.get("/template/excel")
async def get_product_template(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Download an empty Excel template for product import.
    
    The template includes:
    - Correct column headers matching database schema
    - Instructions sheet with column descriptions
    - Required vs optional field indicators
    """
    excel_service = ProductExcelService(db)
    output = excel_service.generate_template()
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=product_import_template.xlsx",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/export/excel")
async def export_products_excel(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """
    Export all products to Excel spreadsheet.
    
    Returns an Excel file with all products and their details.
    """
    excel_service = ProductExcelService(db)
    output = excel_service.export_products(business_id)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=products_export.xlsx",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/import/excel")
async def import_products_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(has_permission("products:create")),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """
    Import products from Excel spreadsheet (.xlsx).
    
    Requirements:
    - File must be .xlsx format (Excel 2007+)
    - Must have columns: Product Name (required), Selling Price (required)
    - Optional columns: SKU, Description, Barcode, Cost Price, Initial Quantity, etc.
    - Products will automatically be added to inventory with specified quantity
    
    Returns:
    - success: Whether import completed without critical errors
    - updated: Count of updated products (matched by SKU)
    - created: Count of newly created products
    - skipped: Count of rows that were skipped
    - errors: List of error messages for problematic rows
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel spreadsheet (.xlsx or .xls)",
        )
    
    # Read file content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}",
        )
    
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )
    
    # File size limit: 10MB max
    max_file_size = 10 * 1024 * 1024
    if len(content) > max_file_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is 10MB, received {len(content) / (1024*1024):.2f}MB",
        )
    
    # Process import
    excel_service = ProductExcelService(db)
    result = excel_service.import_products(business_id, content, auto_create_inventory=True)
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )
    
    return result


# Product-Supplier Relationship Endpoints

@router.get("/{product_id}/suppliers")
async def get_product_suppliers(
    product_id: str,
    current_user: User = Depends(has_permission("products:read")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get all suppliers linked to a product."""
    from app.models.product_supplier import ProductSupplier
    from app.models.supplier import Supplier
    
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    # Get supplier IDs linked to this product
    supplier_links = db.query(ProductSupplier).filter(
        ProductSupplier.product_id == product.id,
        ProductSupplier.deleted_at.is_(None),
    ).all()
    
    supplier_ids = [link.supplier_id for link in supplier_links]
    
    if not supplier_ids:
        return []
    
    suppliers = db.query(Supplier).filter(
        Supplier.id.in_(supplier_ids),
        Supplier.deleted_at.is_(None),
    ).all()
    
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "email": s.email,
            "phone": s.phone,
        }
        for s in suppliers
    ]


@router.post("/{product_id}/suppliers/{supplier_id}", status_code=status.HTTP_201_CREATED)
async def link_product_supplier(
    product_id: str,
    supplier_id: str,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Link a product to a supplier."""
    from app.models.product_supplier import ProductSupplier
    from app.models.supplier import Supplier
    
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    # Check supplier exists
    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id,
        Supplier.business_id == business_id,
        Supplier.deleted_at.is_(None),
    ).first()
    
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    
    # Check if link already exists
    existing = db.query(ProductSupplier).filter(
        ProductSupplier.product_id == product.id,
        ProductSupplier.supplier_id == supplier.id,
        ProductSupplier.deleted_at.is_(None),
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product is already linked to this supplier",
        )
    
    # Create the link
    link = ProductSupplier(
        product_id=product.id,
        supplier_id=supplier.id,
    )
    db.add(link)
    db.commit()
    
    return {
        "message": f"Product '{product.name}' linked to supplier '{supplier.name}'",
        "product_id": str(product.id),
        "supplier_id": str(supplier.id),
    }


@router.delete("/{product_id}/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_product_supplier(
    product_id: str,
    supplier_id: str,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Remove the link between a product and supplier."""
    from datetime import datetime
    from app.models.product_supplier import ProductSupplier
    
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    # Find the link
    link = db.query(ProductSupplier).filter(
        ProductSupplier.product_id == product.id,
        ProductSupplier.supplier_id == supplier_id,
        ProductSupplier.deleted_at.is_(None),
    ).first()
    
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found",
        )
    
    # Soft delete the link
    link.deleted_at = datetime.utcnow()
    db.commit()
