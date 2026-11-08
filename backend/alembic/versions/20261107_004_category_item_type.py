"""add item_type to categories

Revision ID: 20261107_004
Revises: 20261106_003
Create Date: 2026-11-07 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20261107_004'
down_revision: Union[str, None] = '20261106_003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'categories',
        sa.Column('item_type', sa.String(length=10), nullable=False, server_default='FOOD'),
    )
    # Kategori demo lama: isi tipe sesuai nama, sisanya tetap FOOD
    op.execute("UPDATE categories SET item_type = 'DRINK' WHERE name = 'Kopi Signature'")
    op.execute("UPDATE categories SET item_type = 'SNACK' WHERE name = 'Cemilan'")


def downgrade() -> None:
    op.drop_column('categories', 'item_type')
