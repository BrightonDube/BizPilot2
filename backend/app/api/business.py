"""Business API endpoints for business management and onboarding."""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, ConfigDict
import re
import math

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_user_for_onboarding, get_current_business_id
from app.core.rbac import has_permission
from app.models.user import User
from app.models.business import Business
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.models.organization import Organization
from app.models.role import Role, Permission

router = APIRouter(prefix="/business", tags=["Business"])


class BusinessCreate(BaseModel):
    """Schema for creating a new business."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    currency: str = "ZAR"
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_branch_code: Optional[str] = None


class BusinessUpdate(BaseModel):
    """Schema for updating business settings."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_postal_code: Optional[str] = None
    address_country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    currency: Optional[str] = None
    tax_number: Optional[str] = None
    vat_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_branch_code: Optional[str] = None


class BusinessResponse(BaseModel):
    """Schema for business response."""
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    currency: str
    tax_number: Optional[str] = None
    vat_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_branch_code: Optional[str] = None
    
    model_config = {"from_attributes": True}


class BusinessStatusResponse(BaseModel):
    """Schema for checking if user has a business."""
    has_business: bool
    business: Optional[BusinessResponse] = None
    role: Optional[str] = None


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text


@router.get("/status", response_model=BusinessStatusResponse)
async def get_business_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Check if the current user has a business associated.
    Used to determine if user needs to go through business onboarding.
    """
    # Check if user has any active business association
    business_user = db.query(BusinessUser).filter(
        BusinessUser.user_id == current_user.id,
        BusinessUser.status == BusinessUserStatus.ACTIVE
    ).first()
    
    if not business_user:
        return BusinessStatusResponse(has_business=False)
    
    business = db.query(Business).filter(Business.id == business_user.business_id).first()
    
    if not business:
        return BusinessStatusResponse(has_business=False)
    
    role_name = None
    if business_user.role:
        role_name = business_user.role.name
    
    return BusinessStatusResponse(
        has_business=True,
        business=BusinessResponse(
            id=str(business.id),
            name=business.name,
            slug=business.slug,
            description=business.description,
            address_street=business.address_street,
            address_city=business.address_city,
            address_country=business.address_country,
            phone=business.phone,
            email=business.email,
            website=business.website,
            currency=business.currency,
            tax_number=business.tax_number,
            vat_number=business.vat_number,
            bank_name=business.bank_name,
            bank_account_number=business.bank_account_number,
            bank_branch_code=business.bank_branch_code,
        ),
        role=role_name
    )


@router.post("/setup", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
async def setup_business(
    business_data: BusinessCreate,
    current_user: User = Depends(get_current_user_for_onboarding),
    db: Session = Depends(get_db),
):
    """
    Set up a new business for a user who doesn't have one.
    This is the business onboarding endpoint.
    
    - Creates an organization owned by the user
    - Creates the business under that organization
    - Creates an admin role for the business
    - Associates the user with the business as admin
    """
    # Check if user already has a business
    existing_business_user = db.query(BusinessUser).filter(
        BusinessUser.user_id == current_user.id,
        BusinessUser.status == BusinessUserStatus.ACTIVE
    ).first()
    
    if existing_business_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already associated with a business"
        )
    
    # Generate unique slug
    base_slug = slugify(business_data.name)
    slug = base_slug
    counter = 1
    while db.query(Business).filter(Business.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    # Generate unique org slug
    org_slug = f"{base_slug}-org"
    org_counter = 1
    while db.query(Organization).filter(Organization.slug == org_slug).first():
        org_slug = f"{base_slug}-org-{org_counter}"
        org_counter += 1
    
    try:
        # Create organization first
        organization = Organization(
            name=f"{business_data.name} Organization",
            slug=org_slug,
            owner_id=current_user.id,
        )
        db.add(organization)
        db.flush()  # Get the organization ID
        
        # Create business
        business = Business(
            name=business_data.name,
            slug=slug,
            organization_id=organization.id,
            description=business_data.description,
            address_street=business_data.address,
            phone=business_data.phone,
            email=business_data.email or current_user.email,
            website=business_data.website,
            currency=business_data.currency,
            bank_name=business_data.bank_name,
            bank_account_number=business_data.bank_account_number,
            bank_branch_code=business_data.bank_branch_code,
        )
        db.add(business)
        db.flush()  # Get the business ID
        
        # Create admin role for this business with all permissions
        admin_role = Role(
            name="Admin",
            description="Full access to all features",
            business_id=business.id,
            is_system=True,
            permissions=[p.value for p in Permission],
        )
        db.add(admin_role)
        db.flush()  # Get the role ID
        
        # Associate user with business as admin
        business_user = BusinessUser(
            user_id=current_user.id,
            business_id=business.id,
            role_id=admin_role.id,
            status=BusinessUserStatus.ACTIVE,
            is_primary=True,
        )
        db.add(business_user)
        
        # Create default "General" department
        from app.models.department import Department
        default_department = Department(
            business_id=business.id,
            name="General",
            description="Default department for general team members",
        )
        db.add(default_department)
        
        # Activate user if still pending
        from app.models.user import UserStatus
        if current_user.status == UserStatus.PENDING:
            current_user.status = UserStatus.ACTIVE
        
        db.commit()
        db.refresh(business)
        
        return BusinessResponse(
            id=str(business.id),
            name=business.name,
            slug=business.slug,
            description=business.description,
            address_street=business.address_street,
            address_city=business.address_city,
            address_country=business.address_country,
            phone=business.phone,
            email=business.email,
            website=business.website,
            currency=business.currency,
            tax_number=business.tax_number,
            vat_number=business.vat_number,
            bank_name=business.bank_name,
            bank_account_number=business.bank_account_number,
            bank_branch_code=business.bank_branch_code,
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create business: {str(e)}"
        )


@router.get("/current", response_model=BusinessResponse)
async def get_current_business(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get the current user's primary business."""
    business_user = db.query(BusinessUser).filter(
        BusinessUser.user_id == current_user.id,
        BusinessUser.status == BusinessUserStatus.ACTIVE
    ).first()
    
    if not business_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business found. Please complete business setup first."
        )
    
    business = db.query(Business).filter(Business.id == business_user.business_id).first()
    
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    return BusinessResponse(
        id=str(business.id),
        name=business.name,
        slug=business.slug,
        description=business.description,
        address_street=business.address_street,
        address_city=business.address_city,
        address_country=business.address_country,
        phone=business.phone,
        email=business.email,
        website=business.website,
        currency=business.currency,
        tax_number=business.tax_number,
        vat_number=business.vat_number,
        bank_name=business.bank_name,
        bank_account_number=business.bank_account_number,
        bank_branch_code=business.bank_branch_code,
    )


@router.put("/current", response_model=BusinessResponse)
async def update_current_business(
    business_data: BusinessUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update the current user's primary business settings."""
    # Get user's business association
    business_user = db.query(BusinessUser).filter(
        BusinessUser.user_id == current_user.id,
        BusinessUser.status == BusinessUserStatus.ACTIVE
    ).first()
    
    if not business_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business found. Please complete business setup first."
        )
    
    # Check if user has permission to edit business settings
    if business_user.role:
        user_permissions = business_user.role.permissions or []
        if "businesses:edit" not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to edit business settings"
            )
    
    business = db.query(Business).filter(Business.id == business_user.business_id).first()
    
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    try:
        # Update only provided fields
        update_data = business_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(business, field, value)
        
        db.commit()
        db.refresh(business)
        
        return BusinessResponse(
            id=str(business.id),
            name=business.name,
            slug=business.slug,
            description=business.description,
            address_street=business.address_street,
            address_city=business.address_city,
            address_country=business.address_country,
            phone=business.phone,
            email=business.email,
            website=business.website,
            currency=business.currency,
            tax_number=business.tax_number,
            vat_number=business.vat_number,
            bank_name=business.bank_name,
            bank_account_number=business.bank_account_number,
            bank_branch_code=business.bank_branch_code,
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update business: {str(e)}"
        )


# --- Business User Management Schemas ---

class BusinessUserResponse(BaseModel):
    """Response schema for a business user."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    user_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    department_id: Optional[str] = None
    department: Optional[dict] = None  # Joined department data
    status: str
    is_primary: bool
    created_at: Optional[str] = None


class BusinessUserListResponse(BaseModel):
    """Response schema for a list of business users."""
    items: List[BusinessUserResponse]
    total: int
    page: int
    per_page: int
    pages: int


class InviteUserRequest(BaseModel):
    """Request to invite a user to the business."""
    email: str
    role_id: str
    department_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class UpdateBusinessUserRequest(BaseModel):
    """Request to update a business user."""
    role_id: Optional[str] = None
    department_id: Optional[str] = None
    status: Optional[str] = None


# --- Business User Management Endpoints ---

@router.get("/users", response_model=BusinessUserListResponse)
async def list_business_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    department_id: Optional[str] = Query(None, description="Filter by department ID"),
    search: Optional[str] = Query(None, description="Search by name, email, or department name"),
    current_user: User = Depends(has_permission("users:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """List all users in the current business."""
    from app.models.department import Department
    
    query = db.query(BusinessUser).filter(
        BusinessUser.business_id == business_id,
        BusinessUser.deleted_at.is_(None),
    )
    
    if status_filter:
        try:
            status_enum = BusinessUserStatus(status_filter)
            query = query.filter(BusinessUser.status == status_enum)
        except ValueError:
            pass
    
    # Filter by department
    if department_id:
        query = query.filter(BusinessUser.department_id == department_id)
    
    # Search by name, email, or department name
    if search:
        search_term = f"%{search}%"
        query = query.join(User, BusinessUser.user_id == User.id).outerjoin(
            Department, BusinessUser.department_id == Department.id
        ).filter(
            (User.first_name.ilike(search_term)) |
            (User.last_name.ilike(search_term)) |
            (User.email.ilike(search_term)) |
            (Department.name.ilike(search_term))
        )
    
    total = query.count()
    offset = (page - 1) * per_page
    business_users = query.offset(offset).limit(per_page).all()
    
    items = []
    for bu in business_users:
        user = db.query(User).filter(User.id == bu.user_id).first()
        role = db.query(Role).filter(Role.id == bu.role_id).first() if bu.role_id else None
        department = db.query(Department).filter(Department.id == bu.department_id).first() if bu.department_id else None
        
        department_data = None
        if department:
            department_data = {
                "id": str(department.id),
                "name": department.name,
                "description": department.description,
                "color": department.color,
                "icon": department.icon,
            }
        
        items.append(BusinessUserResponse(
            id=str(bu.id),
            user_id=str(bu.user_id),
            email=user.email if user else "",
            first_name=user.first_name if user else None,
            last_name=user.last_name if user else None,
            role_id=str(bu.role_id) if bu.role_id else None,
            role_name=role.name if role else None,
            department_id=str(bu.department_id) if bu.department_id else None,
            department=department_data,
            status=bu.status.value,
            is_primary=bu.is_primary,
            created_at=bu.created_at.isoformat() if bu.created_at else None,
        ))
    
    return BusinessUserListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.post("/users/invite", response_model=BusinessUserResponse, status_code=status.HTTP_201_CREATED)
async def invite_user_to_business(
    data: InviteUserRequest,
    current_user: User = Depends(has_permission("users:manage")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Invite a user to join the business."""
    from app.models.department import Department
    
    # Check if role exists and belongs to this business
    role = db.query(Role).filter(Role.id == data.role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    if not role.is_system and str(role.business_id) != business_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot use roles from other businesses")
    
    # Validate department if provided
    if data.department_id:
        department = db.query(Department).filter(Department.id == data.department_id).first()
        if not department:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
        if str(department.business_id) != business_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot use departments from other businesses")
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == data.email).first()
    
    if existing_user:
        # Check if already in this business
        existing_bu = db.query(BusinessUser).filter(
            BusinessUser.user_id == existing_user.id,
            BusinessUser.business_id == business_id,
            BusinessUser.deleted_at.is_(None),
        ).first()
        
        if existing_bu:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this business"
            )
        
        # Add existing user to business
        business_user = BusinessUser(
            user_id=existing_user.id,
            business_id=business_id,
            role_id=data.role_id,
            department_id=data.department_id,
            status=BusinessUserStatus.ACTIVE,
            is_primary=False,
        )
        db.add(business_user)
        db.commit()
        db.refresh(business_user)
        
        # Get department data if assigned
        department_data = None
        if business_user.department_id:
            department = db.query(Department).filter(Department.id == business_user.department_id).first()
            if department:
                department_data = {
                    "id": str(department.id),
                    "name": department.name,
                    "description": department.description,
                    "color": department.color,
                    "icon": department.icon,
                }
        
        return BusinessUserResponse(
            id=str(business_user.id),
            user_id=str(existing_user.id),
            email=existing_user.email,
            first_name=existing_user.first_name,
            last_name=existing_user.last_name,
            role_id=str(business_user.role_id) if business_user.role_id else None,
            role_name=role.name,
            department_id=str(business_user.department_id) if business_user.department_id else None,
            department=department_data,
            status=business_user.status.value,
            is_primary=business_user.is_primary,
            created_at=business_user.created_at.isoformat() if business_user.created_at else None,
        )
    else:
        # Create new user with invited status
        from app.models.user import UserStatus
        from app.core.security import get_password_hash
        import secrets
        
        new_user = User(
            email=data.email,
            first_name=data.first_name or "",
            last_name=data.last_name or "",
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),  # Random password
            status=UserStatus.PENDING,
        )
        db.add(new_user)
        db.flush()
        
        business_user = BusinessUser(
            user_id=new_user.id,
            business_id=business_id,
            role_id=data.role_id,
            department_id=data.department_id,
            status=BusinessUserStatus.INVITED,
            is_primary=False,
        )
        db.add(business_user)
        db.commit()
        db.refresh(business_user)
        
        # Get department data if assigned
        department_data = None
        if business_user.department_id:
            department = db.query(Department).filter(Department.id == business_user.department_id).first()
            if department:
                department_data = {
                    "id": str(department.id),
                    "name": department.name,
                    "description": department.description,
                    "color": department.color,
                    "icon": department.icon,
                }
        
        # TODO: Send invitation email
        
        return BusinessUserResponse(
            id=str(business_user.id),
            user_id=str(new_user.id),
            email=new_user.email,
            first_name=new_user.first_name,
            last_name=new_user.last_name,
            role_id=str(business_user.role_id) if business_user.role_id else None,
            role_name=role.name,
            department_id=str(business_user.department_id) if business_user.department_id else None,
            department=department_data,
            status=business_user.status.value,
            is_primary=business_user.is_primary,
            created_at=business_user.created_at.isoformat() if business_user.created_at else None,
        )


@router.get("/users/{user_id}", response_model=BusinessUserResponse)
async def get_business_user(
    user_id: str,
    current_user: User = Depends(has_permission("users:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get a specific user in the business."""
    from app.models.department import Department
    
    business_user = db.query(BusinessUser).filter(
        BusinessUser.user_id == user_id,
        BusinessUser.business_id == business_id,
        BusinessUser.deleted_at.is_(None),
    ).first()
    
    if not business_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in this business")
    
    user = db.query(User).filter(User.id == business_user.user_id).first()
    role = db.query(Role).filter(Role.id == business_user.role_id).first() if business_user.role_id else None
    
    # Get department data if assigned
    department_data = None
    if business_user.department_id:
        department = db.query(Department).filter(Department.id == business_user.department_id).first()
        if department:
            department_data = {
                "id": str(department.id),
                "name": department.name,
                "description": department.description,
                "color": department.color,
                "icon": department.icon,
            }
    
    return BusinessUserResponse(
        id=str(business_user.id),
        user_id=str(business_user.user_id),
        email=user.email if user else "",
        first_name=user.first_name if user else None,
        last_name=user.last_name if user else None,
        role_id=str(business_user.role_id) if business_user.role_id else None,
        role_name=role.name if role else None,
        department_id=str(business_user.department_id) if business_user.department_id else None,
        department=department_data,
        status=business_user.status.value,
        is_primary=business_user.is_primary,
        created_at=business_user.created_at.isoformat() if business_user.created_at else None,
    )


@router.put("/users/{user_id}", response_model=BusinessUserResponse)
async def update_business_user(
    user_id: str,
    data: UpdateBusinessUserRequest,
    current_user: User = Depends(has_permission("users:manage")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Update a user's role or status in the business."""
    from app.models.department import Department
    
    business_user = db.query(BusinessUser).filter(
        BusinessUser.user_id == user_id,
        BusinessUser.business_id == business_id,
        BusinessUser.deleted_at.is_(None),
    ).first()
    
    if not business_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in this business")
    
    # Prevent modifying own role if you're the only admin
    if str(business_user.user_id) == str(current_user.id) and data.role_id:
        admin_count = db.query(BusinessUser).join(Role).filter(
            BusinessUser.business_id == business_id,
            BusinessUser.deleted_at.is_(None),
            Role.name == "Admin",
        ).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change your own role when you are the only admin"
            )
    
    if data.role_id:
        role = db.query(Role).filter(Role.id == data.role_id).first()
        if not role:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
        if not role.is_system and str(role.business_id) != business_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot use roles from other businesses")
        business_user.role_id = data.role_id
    
    # Handle department reassignment
    if data.department_id is not None:
        if data.department_id == "":
            # Allow clearing department assignment
            business_user.department_id = None
        else:
            # Validate department exists and belongs to this business
            department = db.query(Department).filter(Department.id == data.department_id).first()
            if not department:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
            if str(department.business_id) != business_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot use departments from other businesses")
            business_user.department_id = data.department_id
    
    if data.status:
        try:
            business_user.status = BusinessUserStatus(data.status)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    
    db.commit()
    db.refresh(business_user)
    
    user = db.query(User).filter(User.id == business_user.user_id).first()
    role = db.query(Role).filter(Role.id == business_user.role_id).first() if business_user.role_id else None
    
    # Get department data if assigned
    department_data = None
    if business_user.department_id:
        department = db.query(Department).filter(Department.id == business_user.department_id).first()
        if department:
            department_data = {
                "id": str(department.id),
                "name": department.name,
                "description": department.description,
                "color": department.color,
                "icon": department.icon,
            }
    
    return BusinessUserResponse(
        id=str(business_user.id),
        user_id=str(business_user.user_id),
        email=user.email if user else "",
        first_name=user.first_name if user else None,
        last_name=user.last_name if user else None,
        role_id=str(business_user.role_id) if business_user.role_id else None,
        role_name=role.name if role else None,
        department_id=str(business_user.department_id) if business_user.department_id else None,
        department=department_data,
        status=business_user.status.value,
        is_primary=business_user.is_primary,
        created_at=business_user.created_at.isoformat() if business_user.created_at else None,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user_from_business(
    user_id: str,
    current_user: User = Depends(has_permission("users:manage")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Remove a user from the business."""
    business_user = db.query(BusinessUser).filter(
        BusinessUser.user_id == user_id,
        BusinessUser.business_id == business_id,
        BusinessUser.deleted_at.is_(None),
    ).first()
    
    if not business_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in this business")
    
    # Prevent removing yourself
    if str(business_user.user_id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself from the business"
        )
    
    # Soft delete
    from datetime import datetime
    business_user.deleted_at = datetime.utcnow()
    business_user.status = BusinessUserStatus.INACTIVE
    db.commit()
