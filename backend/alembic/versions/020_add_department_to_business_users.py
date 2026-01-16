"""add department_id to business_users

Revision ID: 020_add_department_id
Revises: 019_add_departments
Create Date: 2026-01-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '020_add_department_id'
down_revision = '019_add_departments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add department_id column to business_users table
    op.add_column('business_users', sa.Column('department_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add foreign key constraint to departments table with SET NULL on delete
    op.create_foreign_key(
        'fk_business_users_department_id',
        'business_users',
        'departments',
        ['department_id'],
        ['id'],
        ondelete='SET NULL'
    )
    
    # Create index on department_id for query performance
    op.create_index('ix_business_users_department_id', 'business_users', ['department_id'])


def downgrade() -> None:
    op.drop_index('ix_business_users_department_id', table_name='business_users')
    op.drop_constraint('fk_business_users_department_id', 'business_users', type_='foreignkey')
    op.drop_column('business_users', 'department_id')
