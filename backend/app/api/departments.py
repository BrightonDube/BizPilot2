"""Department API endpoints."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.schemas.department import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    DepartmentListResponse,
)
from app.services.department_service import DepartmentService

router = APIRouter(prefix="/departments", tags=["Departments"])


def _department_to_response(department) -> DepartmentResponse:
    """Convert department model to response schema."""
    return DepartmentResponse(
        id=str(department.id),
        business_id=str(department.business_id),
        name=department.name,
        description=department.description,
        color=department.color,
        icon=department.icon,
        team_member_count=getattr(department, 'team_member_count', 0),
        created_at=department.created_at,
        updated_at=department.updated_at,
    )


@router.get("", response_model=DepartmentListResponse)
async def list_departments(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """
    Get all departments for the current business.
    """
    service = DepartmentService(db)
    departments = service.get_departments(
        business_id=UUID(business_id),
        requesting_user_id=current_user.id
    )
    
    return DepartmentListResponse(
        departments=[_department_to_response(d) for d in departments]
    )


@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """
    Get a single department by ID.
    """
    service = DepartmentService(db)
    department = service.get_department(
        department_id=UUID(department_id),
        business_id=UUID(business_id),
        requesting_user_id=current_user.id
    )
    
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    
    return _department_to_response(department)


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    data: DepartmentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """
    Create a new department.
    
    Requires business owner permissions.
    """
    service = DepartmentService(db)
    department = service.create_department(
        business_id=UUID(business_id),
        data=data,
        requesting_user_id=current_user.id
    )
    
    return _department_to_response(department)


@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: str,
    data: DepartmentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """
    Update an existing department.
    
    Requires business owner permissions.
    """
    service = DepartmentService(db)
    department = service.update_department(
        department_id=UUID(department_id),
        business_id=UUID(business_id),
        data=data,
        requesting_user_id=current_user.id
    )
    
    return _department_to_response(department)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    department_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """
    Delete a department.
    
    Only allowed if no team members are assigned to the department.
    Requires business owner permissions.
    """
    service = DepartmentService(db)
    service.delete_department(
        department_id=UUID(department_id),
        business_id=UUID(business_id),
        requesting_user_id=current_user.id
    )
    
    return None
