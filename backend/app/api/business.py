"""Business API endpoints for business management and onboarding."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import re

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_user_for_onboarding
from app.models.user import User
from app.models.business import Business
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.models.organization import Organization
from app.models.role import Role, Permission, DEFAULT_ROLES

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


class BusinessResponse(BaseModel):
    """Schema for business response."""
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    address_street: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    currency: str
    
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
            phone=business.phone,
            email=business.email,
            website=business.website,
            currency=business.currency,
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
            phone=business.phone,
            email=business.email,
            website=business.website,
            currency=business.currency,
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
        phone=business.phone,
        email=business.email,
        website=business.website,
        currency=business.currency,
    )
