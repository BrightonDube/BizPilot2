"""Custom dashboard API endpoints.

Provides CRUD for dashboards, widgets, templates, shares, and export
schedules.  Each group uses its own sub-path prefix for clarity.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
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
    DashboardTemplateCreate,
    DashboardTemplateResponse,
    DashboardTemplateListResponse,
    DashboardShareCreate,
    DashboardShareResponse,
    DashboardShareListResponse,
    ExportScheduleCreate,
    ExportScheduleUpdate,
    ExportScheduleResponse,
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


# ── Duplicate ────────────────────────────────────────────────────────────────

@router.post("/{dashboard_id}/duplicate", response_model=DashboardResponse, status_code=201)
async def duplicate_dashboard(
    dashboard_id: str,
    name: Optional[str] = Query(None, description="Name for the copy"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Duplicate a dashboard including all its widgets."""
    service = DashboardService(db)
    clone = service.duplicate_dashboard(dashboard_id, business_id, str(current_user.id), name)
    return _dashboard_to_response(clone)


# ── Templates ────────────────────────────────────────────────────────────────

@router.get("/templates/list", response_model=DashboardTemplateListResponse)
async def list_templates(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List system and business-specific dashboard templates."""
    service = DashboardService(db)
    items, total = service.list_templates(business_id)
    return DashboardTemplateListResponse(
        items=[
            DashboardTemplateResponse(
                id=str(t.id),
                business_id=str(t.business_id) if t.business_id else None,
                name=t.name,
                description=t.description,
                category=t.category,
                layout=t.layout or {},
                widgets_config=t.widgets_config or [],
                thumbnail_url=t.thumbnail_url,
                is_system=t.is_system,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
            for t in items
        ],
        total=total,
    )


@router.post("/templates", response_model=DashboardTemplateResponse, status_code=201)
async def create_template(
    data: DashboardTemplateCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a dashboard template."""
    service = DashboardService(db)
    tpl = service.create_template(business_id, **data.model_dump())
    return DashboardTemplateResponse(
        id=str(tpl.id),
        business_id=str(tpl.business_id) if tpl.business_id else None,
        name=tpl.name,
        description=tpl.description,
        category=tpl.category,
        layout=tpl.layout or {},
        widgets_config=tpl.widgets_config or [],
        thumbnail_url=tpl.thumbnail_url,
        is_system=tpl.is_system,
        created_at=tpl.created_at,
        updated_at=tpl.updated_at,
    )


@router.post("/templates/{template_id}/apply", response_model=DashboardResponse, status_code=201)
async def apply_template(
    template_id: str,
    name: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a new dashboard from a template."""
    service = DashboardService(db)
    dashboard = service.apply_template(template_id, business_id, str(current_user.id), name)
    return _dashboard_to_response(dashboard)


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Delete a dashboard template (business-owned only)."""
    service = DashboardService(db)
    service.delete_template(template_id, business_id)
    return Response(status_code=204)


# ── Sharing ──────────────────────────────────────────────────────────────────

@router.post("/{dashboard_id}/shares", response_model=DashboardShareResponse, status_code=201)
async def share_dashboard(
    dashboard_id: str,
    data: DashboardShareCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Share a dashboard with another user."""
    service = DashboardService(db)
    share = service.share_dashboard(
        dashboard_id, business_id, data.shared_with_user_id, data.permission,
    )
    return DashboardShareResponse(
        id=str(share.id),
        dashboard_id=str(share.dashboard_id),
        shared_with_user_id=str(share.shared_with_user_id),
        permission=share.permission,
        created_at=share.created_at,
    )


@router.get("/{dashboard_id}/shares", response_model=DashboardShareListResponse)
async def list_shares(
    dashboard_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """List users a dashboard is shared with."""
    service = DashboardService(db)
    items, total = service.list_shares(dashboard_id)
    return DashboardShareListResponse(
        items=[
            DashboardShareResponse(
                id=str(s.id),
                dashboard_id=str(s.dashboard_id),
                shared_with_user_id=str(s.shared_with_user_id),
                permission=s.permission,
                created_at=s.created_at,
            )
            for s in items
        ],
        total=total,
    )


@router.delete("/shares/{share_id}", status_code=204)
async def revoke_share(
    share_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Revoke a dashboard share."""
    service = DashboardService(db)
    service.revoke_share(share_id)
    return Response(status_code=204)


# ── Export Schedules ─────────────────────────────────────────────────────────

@router.post("/{dashboard_id}/export-schedules", response_model=ExportScheduleResponse, status_code=201)
async def create_export_schedule(
    dashboard_id: str,
    data: ExportScheduleCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a recurring export schedule for a dashboard."""
    service = DashboardService(db)
    schedule = service.create_export_schedule(
        dashboard_id, business_id, str(current_user.id), **data.model_dump(),
    )
    return ExportScheduleResponse(
        id=str(schedule.id),
        dashboard_id=str(schedule.dashboard_id),
        user_id=str(schedule.user_id),
        format=schedule.format,
        frequency=schedule.frequency,
        recipients=schedule.recipients,
        is_active=schedule.is_active,
        last_sent_at=schedule.last_sent_at,
        next_send_at=schedule.next_send_at,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
    )


@router.get("/{dashboard_id}/export-schedules")
async def list_export_schedules(
    dashboard_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """List export schedules for a dashboard."""
    service = DashboardService(db)
    items, total = service.list_export_schedules(dashboard_id)
    return {
        "items": [
            ExportScheduleResponse(
                id=str(s.id),
                dashboard_id=str(s.dashboard_id),
                user_id=str(s.user_id),
                format=s.format,
                frequency=s.frequency,
                recipients=s.recipients,
                is_active=s.is_active,
                last_sent_at=s.last_sent_at,
                next_send_at=s.next_send_at,
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
            for s in items
        ],
        "total": total,
    }


@router.put("/export-schedules/{schedule_id}", response_model=ExportScheduleResponse)
async def update_export_schedule(
    schedule_id: str,
    data: ExportScheduleUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Update an export schedule."""
    service = DashboardService(db)
    schedule = service.update_export_schedule(schedule_id, **data.model_dump(exclude_unset=True))
    return ExportScheduleResponse(
        id=str(schedule.id),
        dashboard_id=str(schedule.dashboard_id),
        user_id=str(schedule.user_id),
        format=schedule.format,
        frequency=schedule.frequency,
        recipients=schedule.recipients,
        is_active=schedule.is_active,
        last_sent_at=schedule.last_sent_at,
        next_send_at=schedule.next_send_at,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
    )


@router.delete("/export-schedules/{schedule_id}", status_code=204)
async def delete_export_schedule(
    schedule_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Delete an export schedule."""
    service = DashboardService(db)
    service.delete_export_schedule(schedule_id)
    return Response(status_code=204)
