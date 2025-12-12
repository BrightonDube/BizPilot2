"""Initial schema - Users, Organizations, Businesses, Roles

Revision ID: 001_initial_schema
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('hashed_password', sa.String(255), nullable=True),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('is_email_verified', sa.Boolean(), default=False),
        sa.Column('status', sa.Enum('active', 'inactive', 'pending', 'suspended', name='userstatus'), default='pending'),
        sa.Column('google_id', sa.String(255), unique=True, nullable=True, index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create organizations table
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), unique=True, nullable=False, index=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create businesses table
    op.create_table(
        'businesses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False, index=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('logo_url', sa.String(500), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('address_street', sa.String(255), nullable=True),
        sa.Column('address_city', sa.String(100), nullable=True),
        sa.Column('address_state', sa.String(100), nullable=True),
        sa.Column('address_postal_code', sa.String(20), nullable=True),
        sa.Column('address_country', sa.String(100), default='South Africa'),
        sa.Column('tax_number', sa.String(50), nullable=True),
        sa.Column('vat_number', sa.String(50), nullable=True),
        sa.Column('vat_rate', sa.Numeric(5, 2), default=15.00),
        sa.Column('currency', sa.String(3), default='ZAR'),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('website', sa.String(255), nullable=True),
        sa.Column('invoice_prefix', sa.String(10), default='INV'),
        sa.Column('invoice_terms', sa.Text(), nullable=True),
        sa.Column('bank_name', sa.String(100), nullable=True),
        sa.Column('bank_account_number', sa.String(50), nullable=True),
        sa.Column('bank_branch_code', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create roles table
    op.create_table(
        'roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=True),
        sa.Column('is_system', sa.Boolean(), default=False),
        sa.Column('permissions', sa.String(2000), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create business_users table
    op.create_table(
        'business_users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('roles.id'), nullable=False),
        sa.Column('status', sa.Enum('active', 'invited', 'inactive', name='businessuserstatus'), default='active'),
        sa.Column('is_primary', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create indexes
    op.create_index('ix_business_users_user_id', 'business_users', ['user_id'])
    op.create_index('ix_business_users_business_id', 'business_users', ['business_id'])


def downgrade() -> None:
    op.drop_index('ix_business_users_business_id', table_name='business_users')
    op.drop_index('ix_business_users_user_id', table_name='business_users')
    op.drop_table('business_users')
    op.drop_table('roles')
    op.drop_table('businesses')
    op.drop_table('organizations')
    op.drop_table('users')
    
    # Drop enums
    sa.Enum(name='businessuserstatus').drop(op.get_bind())
    sa.Enum(name='userstatus').drop(op.get_bind())
