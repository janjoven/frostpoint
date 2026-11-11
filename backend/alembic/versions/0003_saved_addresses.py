"""saved addresses

Revision ID: 0003
Revises: 0002

A fresh database already has the table from 0001's create_all, so check before creating.
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"


def upgrade() -> None:
    if "saved_addresses" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "saved_addresses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("account_id", sa.Integer, sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("label", sa.String(40), nullable=False),
        sa.Column("location", sa.String(80), nullable=False),
        sa.Column("address", sa.Text, nullable=False),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("saved_addresses")
