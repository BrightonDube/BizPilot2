"""Custom dashboard API endpoints."""

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.schemas.dashboard_custom import (
    DashboardCreate,
    DashboardUpdate,
    DashboardResponse,
    DashboardListResponse,
    WidgetCreate,
    WidgetUpdate,
    WidgetDataRequest,
    WidgetResponse,
    WidgetDataResponse,
)
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboards", tags=["Custom Dashboards"])


def _dashboard_to_response(d) -> DashboardResponse:
    """Convert dashboard model to response."""
    return DashboardResponse(
        id=str(d.id),
        business_id=str(d.business_id),
        user_id=str(d.user_id),
        name=d.name,
        description=d.description,
        is_default=d.is_default,
        layout=d.layout,
        is_shared=d.is_shared,
        widgets=[
            WidgetResponse(
                id=str(w.id),
                dashboard_id=str(w.dashboard_id),
                widget_type=w.widget_type,
                title=w.title,
                config=w.config,
                position_x=w.position_x,
                position_y=w.position_y,
                width=w.width,
                height=w.height,
                created_at=w.created_at,
                updated_at=w.updated_at,
            )
            for w in (d.widgets or [])
            if w.deleted_at is None
        ],
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


def _widget_to_response(w) -> WidgetResponse:
    """Convert widget model to response."""
    return WidgetResponse(
        id=str(w.id),
        dashboard_id=str(w.dashboard_id),
        widget_type=w.widget_type,
        title=w.title,
        config=w.config,
        position_x=w.position_x,
        position_y=w.position_y,
        width=w.width,
        height=w.height,
        created_at=w.created_at,
        updated_at=w.updated_at,
    )


@router.post("", response_model=DashboardResponse, status_code=201)
async def create_dashboard(
    data: DashboardCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a new custom dashboard."""
    service = DashboardService(db)
    dashboard = service.create_dashboard(
        business_id=business_id,
        user_id=str(current_user.id),
        name=data.name,
        description=data.description,
    )
    return _dashboard_to_response(dashboard)


@router.get("", response_model=DashboardListResponse)
async def list_dashboards(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List dashboards for the current user and shared dashboards."""
    service = DashboardService(db)
    items, total = service.list_dashboards(business_id, str(current_user.id))
    return DashboardListResponse(
        items=[_dashboard_to_response(d) for d in items],
        total=total,
    )


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a dashboard with its widgets."""
    service = DashboardService(db)
    dashboard = service.get_dashboard(dashboard_id, business_id)
    return _dashboard_to_response(dashboard)


@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: str,
    data: DashboardUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a dashboard."""
    service = DashboardService(db)
    dashboard = service.update_dashboard(
        dashboard_id,
        business_id,
        **data.model_dump(exclude_unset=True),
    )
    return _dashboard_to_response(dashboard)


@router.delete("/{dashboard_id}", status_code=204)
async def delete_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Delete a dashboard."""
    service = DashboardService(db)
    service.delete_dashboard(dashboard_id, business_id)
    return Response(status_code=204)


@router.post(
    "/{dashboard_id}/widgets", response_model=WidgetResponse, status_code=201
)
async def add_widget(
    dashboard_id: str,
    data: WidgetCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Add a widget to a dashboard."""
    service = DashboardService(db)
    # Verify dashboard exists and belongs to business
    service.get_dashboard(dashboard_id, business_id)
    widget = service.add_widget(
        dashboard_id=dashboard_id,
        widget_type=data.widget_type,
        title=data.title,
        config=data.config,
        pos_x=data.position_x,
        pos_y=data.position_y,
        width=data.width,
        height=data.height,
    )
    return _widget_to_response(widget)


@router.put("/widgets/{widget_id}", response_model=WidgetResponse)
async def update_widget(
    widget_id: str,
    data: WidgetUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Update a widget's position or config."""
    service = DashboardService(db)
    widget = service.update_widget(widget_id, **data.model_dump(exclude_unset=True))
    return _widget_to_response(widget)


@router.delete("/widgets/{widget_id}", status_code=204)
async def remove_widget(
    widget_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Remove a widget from a dashboard."""
    service = DashboardService(db)
    service.remove_widget(widget_id)
    return Response(status_code=204)


@router.post("/widgets/data", response_model=WidgetDataResponse)
async def get_widget_data(
    data: WidgetDataRequest,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Fetch actual data for a widget type."""
    service = DashboardService(db)
    result = service.get_widget_data(data.widget_type, data.config, business_id)
    return WidgetDataResponse(widget_type=data.widget_type, data=result)
