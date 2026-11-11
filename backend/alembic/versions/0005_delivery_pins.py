"""delivery pins on orders and saved addresses

Revision ID: 0005
Revises: 0004

A fresh database already has these from 0001's create_all, so check before adding.
"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"

COLUMNS = {"orders": ("dest_lat", "dest_lng"), "saved_addresses": ("lat", "lng")}


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    for table, cols in COLUMNS.items():
        have = {c["name"] for c in insp.get_columns(table)}
        for c in cols:
            if c not in have:
                op.add_column(table, sa.Column(c, sa.Float, nullable=True))


def downgrade() -> None:
    for table, cols in COLUMNS.items():
        for c in cols:
            op.drop_column(table, c)
