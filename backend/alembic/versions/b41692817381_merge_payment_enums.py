"""merge_payment_enums

Revision ID: b41692817381
Revises: 010_ensure_pay_enums, d2162babb0bc
Create Date: 2026-01-08 13:36:10.628684

"""
from typing import Sequence, Union



# revision identifiers, used by Alembic.
revision: str = 'b41692817381'
down_revision: Union[str, None] = ('010_ensure_pay_enums', 'd2162babb0bc')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
