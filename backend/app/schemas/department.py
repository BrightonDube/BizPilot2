"""Department schemas for API validation."""

from typing import Optional
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import re


class DepartmentBase(BaseModel):
    """Base schema for department."""
    
    name: str = Field(..., min_length=1, max_length=100, description="Department name")
    description: Optional[str] = Field(None, description="Department description")
    color: Optional[str] = Field(None, max_length=7, description="Hex color code (e.g., #FF5733)")
    icon: Optional[str] = Field(None, max_length=50, description="Icon identifier (e.g., 'users', 'chart-bar')")
    
    @field_validator('color')
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        """Validate hex color format."""
        if v is not None and not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError('Color must be a valid hex code (e.g., #FF5733)')
        return v


class DepartmentCreate(DepartmentBase):
    """Schema for creating a department."""
    pass


class DepartmentUpdate(BaseModel):
    """Schema for updating a department."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Department name")
    description: Optional[str] = Field(None, description="Department description")
    color: Optional[str] = Field(None, max_length=7, description="Hex color code (e.g., #FF5733)")
    icon: Optional[str] = Field(None, max_length=50, description="Icon identifier (e.g., 'users', 'chart-bar')")
    
    @field_validator('color')
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        """Validate hex color format."""
        if v is not None and not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError('Color must be a valid hex code (e.g., #FF5733)')
        return v


class DepartmentResponse(DepartmentBase):
    """Schema for department response."""
    
    id: str
    business_id: str
    team_member_count: int = Field(default=0, description="Number of team members in this department")
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class DepartmentListResponse(BaseModel):
    """Schema for department list response."""
    
    departments: list[DepartmentResponse]
