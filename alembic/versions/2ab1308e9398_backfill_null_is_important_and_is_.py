"""backfill null is_important and is_archived

Revision ID: 2ab1308e9398
Revises: 25db53ed1323
Create Date: 2026-08-09 07:16:58.615857

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2ab1308e9398'
down_revision: Union[str, Sequence[str], None] = '25db53ed1323'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE items SET is_important = false WHERE is_important IS NULL")
    op.execute("UPDATE items SET is_archived = false WHERE is_archived IS NULL")

    op.alter_column('items', 'is_important', nullable=False, server_default='false')
    op.alter_column('items', 'is_archived', nullable=False, server_default='false')


def downgrade() -> None:
    op.alter_column('items', 'is_important', nullable=False, server_default=None)
    op.alter_column('items', 'is_archived', nullable=False, server_default=None)
