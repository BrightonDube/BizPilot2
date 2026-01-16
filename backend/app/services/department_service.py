"""Department service for business logic."""

from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.department import Department
from app.models.business_user import BusinessUser
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentUpdate


class DepartmentService:
    """Service for department operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_departments(
        self,
        business_id: UUID,
        requesting_user_id: UUID
    ) -> List[Department]:
        """Get all departments for a business."""
        # Validate user has access to business
        self._validate_business_access(business_id, requesting_user_id)
        
        # Query departments with team member counts
        departments = (
            self.db.query(
                Department,
                func.count(BusinessUser.id).label('team_member_count')
            )
            .outerjoin(BusinessUser, Department.id == BusinessUser.department_id)
            .filter(
                Department.business_id == business_id,
                Department.deleted_at.is_(None)
            )
            .group_by(Department.id)
            .all()
        )
        
        # Attach team_member_count to each department
        result = []
        for dept, count in departments:
            dept.team_member_count = count
            result.append(dept)
        
        return result

    def get_department(
        self,
        department_id: UUID,
        business_id: UUID,
        requesting_user_id: UUID
    ) -> Optional[Department]:
        """Get a single department by ID."""
        # Validate user has access to business
        self._validate_business_access(business_id, requesting_user_id)
        
        # Query department with team member count
        result = (
            self.db.query(
                Department,
                func.count(BusinessUser.id).label('team_member_count')
            )
            .outerjoin(BusinessUser, Department.id == BusinessUser.department_id)
            .filter(
                Department.id == department_id,
                Department.business_id == business_id,
                Department.deleted_at.is_(None)
            )
            .group_by(Department.id)
            .first()
        )
        
        if not result:
            return None
        
        dept, count = result
        dept.team_member_count = count
        return dept

    def create_department(
        self,
        business_id: UUID,
        data: DepartmentCreate,
        requesting_user_id: UUID
    ) -> Department:
        """Create a new department."""
        # Validate user is business owner
        self._validate_business_owner(business_id, requesting_user_id)
        
        # Check for duplicate name
        if self._exists_by_name(business_id, data.name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department '{data.name}' already exists in this business"
            )
        
        # Create department
        department = Department(
            business_id=business_id,
            name=data.name,
            description=data.description,
            color=data.color,
            icon=data.icon
        )
        
        self.db.add(department)
        self.db.commit()
        self.db.refresh(department)
        
        # Set team_member_count to 0 for new department
        department.team_member_count = 0
        
        return department

    def update_department(
        self,
        department_id: UUID,
        business_id: UUID,
        data: DepartmentUpdate,
        requesting_user_id: UUID
    ) -> Department:
        """Update an existing department."""
        # Validate user is business owner
        self._validate_business_owner(business_id, requesting_user_id)
        
        # Get department
        department = self.db.query(Department).filter(
            Department.id == department_id,
            Department.deleted_at.is_(None)
        ).first()
        
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
        
        # Validate department belongs to business
        if department.business_id != business_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this department"
            )
        
        # Check for duplicate name if name is being changed
        if data.name and data.name != department.name:
            if self._exists_by_name(business_id, data.name):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Department '{data.name}' already exists in this business"
                )
        
        # Update department
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(department, field, value)
        
        self.db.commit()
        self.db.refresh(department)
        
        # Get team member count
        count = self._get_team_member_count(department_id)
        department.team_member_count = count
        
        return department

    def delete_department(
        self,
        department_id: UUID,
        business_id: UUID,
        requesting_user_id: UUID
    ) -> bool:
        """Delete a department (only if no team members assigned)."""
        # Validate user is business owner
        self._validate_business_owner(business_id, requesting_user_id)
        
        # Get department
        department = self.db.query(Department).filter(
            Department.id == department_id,
            Department.deleted_at.is_(None)
        ).first()
        
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
        
        # Validate department belongs to business
        if department.business_id != business_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this department"
            )
        
        # Check if any team members are assigned
        member_count = self._get_team_member_count(department_id)
        if member_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete department with {member_count} assigned team members"
            )
        
        # Soft delete department
        department.soft_delete()
        self.db.commit()
        
        return True

    def _exists_by_name(self, business_id: UUID, name: str) -> bool:
        """Check if a department with the given name exists in the business."""
        return self.db.query(Department).filter(
            Department.business_id == business_id,
            Department.name == name,
            Department.deleted_at.is_(None)
        ).first() is not None

    def _get_team_member_count(self, department_id: UUID) -> int:
        """Get the number of team members assigned to a department."""
        return self.db.query(BusinessUser).filter(
            BusinessUser.department_id == department_id,
            BusinessUser.deleted_at.is_(None)
        ).count()

    def _validate_business_owner(self, business_id: UUID, user_id: UUID) -> None:
        """Validate that the user is a business owner/admin or superadmin."""
        # Check if user is superadmin
        user = self.db.query(User).filter(User.id == user_id).first()
        if user and user.is_superadmin:
            return
        
        # Check if user is business owner
        business_user = self.db.query(BusinessUser).filter(
            BusinessUser.business_id == business_id,
            BusinessUser.user_id == user_id,
            BusinessUser.deleted_at.is_(None)
        ).first()
        
        if not business_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage departments for this business"
            )
        
        # Check if user has owner or admin role (case-insensitive)
        if business_user.role:
            role_name_lower = business_user.role.name.lower()
            if role_name_lower in ('owner', 'admin'):
                return
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only business owners and admins can manage departments"
        )

    def _validate_business_access(self, business_id: UUID, user_id: UUID) -> None:
        """Validate that the user has access to the business."""
        # Check if user is superadmin
        user = self.db.query(User).filter(User.id == user_id).first()
        if user and user.is_superadmin:
            return
        
        # Check if user has any role in business
        business_user = self.db.query(BusinessUser).filter(
            BusinessUser.business_id == business_id,
            BusinessUser.user_id == user_id,
            BusinessUser.deleted_at.is_(None)
        ).first()
        
        if not business_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this business"
            )
