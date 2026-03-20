"""merge heads

Revision ID: 3bc48f58a175
Revises: 070_product_supplier_primary, 103_zone_fee_fields
Create Date: 2026-03-13 12:30:12.451794

"""


from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '3bc48f58a175'
down_revision: Union[str, None] = ('070_product_supplier_primary', '103_zone_fee_fields')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
