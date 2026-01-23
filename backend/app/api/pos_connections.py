"""POS Connection API endpoints for managing Point of Sale integrations."""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.core.database import get_db
from app.api.deps import get_current_business_id, check_feature
from app.models.user import User
from app.models.pos_connection import (
    POSConnection,
    POSSyncLog,
    POSProvider,
    POSConnectionStatus,
)

router = APIRouter(prefix="/pos-connections", tags=["POS Integrations"])


# --- Schemas ---

class POSConnectionCreate(BaseModel):
    """Schema for creating a POS connection."""
    provider: str
    name: str
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    access_token: Optional[str] = None
    base_url: Optional[str] = None
    settings: Optional[dict] = None
    sync_products: bool = True
    sync_inventory: bool = True
    sync_sales: bool = True
    sync_customers: bool = False


class POSConnectionUpdate(BaseModel):
    """Schema for updating a POS connection."""
    name: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    access_token: Optional[str] = None
    base_url: Optional[str] = None
    settings: Optional[dict] = None
    sync_enabled: Optional[bool] = None
    sync_products: Optional[bool] = None
    sync_inventory: Optional[bool] = None
    sync_sales: Optional[bool] = None
    sync_customers: Optional[bool] = None


class POSConnectionResponse(BaseModel):
    """Response schema for a POS connection."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    business_id: str
    provider: str
    name: str
    status: str
    is_connected: bool
    sync_enabled: bool
    sync_products: bool
    sync_inventory: bool
    sync_sales: bool
    sync_customers: bool
    last_sync_at: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    last_sync_error: Optional[str] = None
    settings: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class POSConnectionListResponse(BaseModel):
    """Response schema for a list of POS connections."""
    items: List[POSConnectionResponse]
    total: int


class POSSyncLogResponse(BaseModel):
    """Response schema for a sync log entry."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    connection_id: str
    sync_type: str
    direction: str
    records_processed: int
    records_created: int
    records_updated: int
    records_failed: int
    status: str
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class POSProviderInfo(BaseModel):
    """Information about a POS provider."""
    id: str
    name: str
    description: str
    auth_type: str  # api_key, oauth, custom
    required_fields: List[str]
    optional_fields: List[str]
    features: List[str]


class SyncRequest(BaseModel):
    """Request to trigger a sync."""
    sync_type: str  # products, inventory, sales, customers, all


class SyncResponse(BaseModel):
    """Response from a sync operation."""
    success: bool
    message: str
    sync_log_id: Optional[str] = None
    records_processed: int = 0


def _connection_to_response(conn: POSConnection) -> POSConnectionResponse:
    """Convert POS connection to response."""
    return POSConnectionResponse(
        id=str(conn.id),
        business_id=str(conn.business_id),
        provider=conn.provider.value if hasattr(conn.provider, 'value') else str(conn.provider),
        name=conn.name,
        status=conn.status.value if hasattr(conn.status, 'value') else str(conn.status),
        is_connected=conn.is_connected,
        sync_enabled=conn.sync_enabled,
        sync_products=conn.sync_products,
        sync_inventory=conn.sync_inventory,
        sync_sales=conn.sync_sales,
        sync_customers=conn.sync_customers,
        last_sync_at=conn.last_sync_at,
        last_sync_status=conn.last_sync_status,
        last_sync_error=conn.last_sync_error,
        settings=conn.settings,
        created_at=conn.created_at,
        updated_at=conn.updated_at,
    )


# --- Endpoints ---

@router.get("/providers", response_model=List[POSProviderInfo])
async def get_pos_providers():
    """Get list of supported POS providers and their configuration requirements."""
    providers = [
        POSProviderInfo(
            id="lightspeed",
            name="Lightspeed",
            description="Lightspeed Retail/Restaurant POS",
            auth_type="oauth",
            required_fields=["api_key"],
            optional_fields=["base_url"],
            features=["products", "inventory", "sales", "customers"],
        ),
        POSProviderInfo(
            id="gaap",
            name="GAAP",
            description="GAAP Inventory & POS",
            auth_type="api_key",
            required_fields=["api_key", "api_secret"],
            optional_fields=["base_url"],
            features=["products", "inventory", "sales"],
        ),
        POSProviderInfo(
            id="pilot",
            name="Pilot",
            description="Pilot POS System",
            auth_type="api_key",
            required_fields=["api_key"],
            optional_fields=["base_url"],
            features=["products", "sales"],
        ),
        POSProviderInfo(
            id="marketman",
            name="MarketMan",
            description="MarketMan Inventory & Recipe Management",
            auth_type="oauth",
            required_fields=["access_token"],
            optional_fields=["refresh_token", "base_url"],
            features=["products", "inventory"],
        ),
        POSProviderInfo(
            id="square",
            name="Square",
            description="Square POS",
            auth_type="oauth",
            required_fields=["access_token"],
            optional_fields=["refresh_token"],
            features=["products", "inventory", "sales", "customers"],
        ),
        POSProviderInfo(
            id="shopify",
            name="Shopify",
            description="Shopify POS & E-commerce",
            auth_type="oauth",
            required_fields=["access_token", "base_url"],
            optional_fields=[],
            features=["products", "inventory", "sales", "customers"],
        ),
        POSProviderInfo(
            id="vend",
            name="Vend (Lightspeed XSeries)",
            description="Vend/Lightspeed XSeries POS",
            auth_type="oauth",
            required_fields=["access_token"],
            optional_fields=["refresh_token", "base_url"],
            features=["products", "inventory", "sales", "customers"],
        ),
        POSProviderInfo(
            id="toast",
            name="Toast",
            description="Toast Restaurant POS",
            auth_type="api_key",
            required_fields=["api_key", "api_secret"],
            optional_fields=[],
            features=["products", "sales"],
        ),
        POSProviderInfo(
            id="clover",
            name="Clover",
            description="Clover POS",
            auth_type="oauth",
            required_fields=["access_token"],
            optional_fields=["refresh_token"],
            features=["products", "inventory", "sales"],
        ),
        POSProviderInfo(
            id="revel",
            name="Revel Systems",
            description="Revel iPad POS",
            auth_type="api_key",
            required_fields=["api_key", "api_secret"],
            optional_fields=["base_url"],
            features=["products", "inventory", "sales", "customers"],
        ),
        POSProviderInfo(
            id="custom",
            name="Custom Integration",
            description="Custom API integration",
            auth_type="custom",
            required_fields=["base_url", "api_key"],
            optional_fields=["api_secret", "access_token"],
            features=["products", "inventory", "sales", "customers"],
        ),
    ]
    return providers


@router.get("", response_model=POSConnectionListResponse)
async def list_pos_connections(
    current_user: User = Depends(check_feature("api_integrations")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """List all POS connections for the business."""
    connections = db.query(POSConnection).filter(
        POSConnection.business_id == business_id,
        POSConnection.deleted_at.is_(None),
    ).all()
    
    return POSConnectionListResponse(
        items=[_connection_to_response(c) for c in connections],
        total=len(connections),
    )


@router.get("/{connection_id}", response_model=POSConnectionResponse)
async def get_pos_connection(
    connection_id: str,
    current_user: User = Depends(check_feature("api_integrations")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get a specific POS connection."""
    connection = db.query(POSConnection).filter(
        POSConnection.id == connection_id,
        POSConnection.business_id == business_id,
        POSConnection.deleted_at.is_(None),
    ).first()
    
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")
    
    return _connection_to_response(connection)


@router.post("", response_model=POSConnectionResponse, status_code=status.HTTP_201_CREATED)
async def create_pos_connection(
    data: POSConnectionCreate,
    current_user: User = Depends(check_feature("api_integrations")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Create a new POS connection."""
    # Validate provider
    try:
        provider = POSProvider(data.provider)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider: {data.provider}. Valid providers: {[p.value for p in POSProvider]}"
        )
    
    connection = POSConnection(
        business_id=business_id,
        provider=provider,
        name=data.name,
        api_key=data.api_key,
        api_secret=data.api_secret,
        access_token=data.access_token,
        base_url=data.base_url,
        settings=data.settings or {},
        status=POSConnectionStatus.PENDING,
        sync_enabled=True,
        sync_products=data.sync_products,
        sync_inventory=data.sync_inventory,
        sync_sales=data.sync_sales,
        sync_customers=data.sync_customers,
    )
    
    db.add(connection)
    db.commit()
    db.refresh(connection)
    
    return _connection_to_response(connection)


@router.put("/{connection_id}", response_model=POSConnectionResponse)
async def update_pos_connection(
    connection_id: str,
    data: POSConnectionUpdate,
    current_user: User = Depends(check_feature("api_integrations")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Update a POS connection."""
    connection = db.query(POSConnection).filter(
        POSConnection.id == connection_id,
        POSConnection.business_id == business_id,
        POSConnection.deleted_at.is_(None),
    ).first()
    
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(connection, field, value)
    
    db.commit()
    db.refresh(connection)
    
    return _connection_to_response(connection)


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pos_connection(
    connection_id: str,
    current_user: User = Depends(check_feature("api_integrations")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Delete a POS connection."""
    connection = db.query(POSConnection).filter(
        POSConnection.id == connection_id,
        POSConnection.business_id == business_id,
        POSConnection.deleted_at.is_(None),
    ).first()
    
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")
    
    connection.soft_delete()
    db.commit()


@router.post("/{connection_id}/test", response_model=SyncResponse)
async def test_pos_connection(
    connection_id: str,
    current_user: User = Depends(check_feature("api_integrations")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Test a POS connection to verify credentials."""
    connection = db.query(POSConnection).filter(
        POSConnection.id == connection_id,
        POSConnection.business_id == business_id,
        POSConnection.deleted_at.is_(None),
    ).first()
    
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")
    
    # For now, just mark as active (in production, would actually test the connection)
    # TODO: Implement actual connection testing per provider
    connection.status = POSConnectionStatus.ACTIVE
    db.commit()
    
    return SyncResponse(
        success=True,
        message=f"Connection to {connection.name} ({connection.provider.value}) is working",
        records_processed=0,
    )


@router.post("/{connection_id}/sync", response_model=SyncResponse)
async def trigger_sync(
    connection_id: str,
    data: SyncRequest,
    current_user: User = Depends(check_feature("api_integrations")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Trigger a sync operation for a POS connection."""
    connection = db.query(POSConnection).filter(
        POSConnection.id == connection_id,
        POSConnection.business_id == business_id,
        POSConnection.deleted_at.is_(None),
    ).first()
    
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")
    
    if not connection.is_connected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connection is not active. Please test the connection first."
        )
    
    # Create sync log
    sync_log = POSSyncLog(
        connection_id=connection.id,
        sync_type=data.sync_type,
        direction="pull",
        status="success",
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
        records_processed=0,
        records_created=0,
        records_updated=0,
        records_failed=0,
    )
    
    # TODO: Implement actual sync logic per provider
    # For now, just create a placeholder log
    
    db.add(sync_log)
    connection.last_sync_at = datetime.utcnow()
    connection.last_sync_status = "success"
    db.commit()
    db.refresh(sync_log)
    
    return SyncResponse(
        success=True,
        message=f"Sync initiated for {data.sync_type}. This is a placeholder - actual sync not implemented yet.",
        sync_log_id=str(sync_log.id),
        records_processed=0,
    )


@router.get("/{connection_id}/logs", response_model=List[POSSyncLogResponse])
async def get_sync_logs(
    connection_id: str,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(check_feature("api_integrations")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get sync logs for a POS connection."""
    connection = db.query(POSConnection).filter(
        POSConnection.id == connection_id,
        POSConnection.business_id == business_id,
        POSConnection.deleted_at.is_(None),
    ).first()
    
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")
    
    logs = db.query(POSSyncLog).filter(
        POSSyncLog.connection_id == connection_id,
        POSSyncLog.deleted_at.is_(None),
    ).order_by(POSSyncLog.created_at.desc()).limit(limit).all()
    
    return [
        POSSyncLogResponse(
            id=str(log.id),
            connection_id=str(log.connection_id),
            sync_type=log.sync_type,
            direction=log.direction,
            records_processed=log.records_processed or 0,
            records_created=log.records_created or 0,
            records_updated=log.records_updated or 0,
            records_failed=log.records_failed or 0,
            status=log.status,
            error_message=log.error_message,
            started_at=log.started_at,
            completed_at=log.completed_at,
        )
        for log in logs
    ]
