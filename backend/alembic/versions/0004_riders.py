"""rider role: order assignment, delivery photo and live location

Revision ID: 0004
Revises: 0003

A fresh database already has these from 0001's create_all, so check before creating.
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("orders")}
    if "rider_id" not in cols:
        op.add_column("orders", sa.Column("rider_id", sa.Integer, sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True))
        op.create_index("ix_orders_rider_id", "orders", ["rider_id"])
    if "rider_accepted_at" not in cols:
        op.add_column("orders", sa.Column("rider_accepted_at", sa.DateTime(timezone=True), nullable=True))
    if "delivery_proof_path" not in cols:
        op.add_column("orders", sa.Column("delivery_proof_path", sa.String(255), nullable=False, server_default=""))
    if "rider_locations" not in insp.get_table_names():
        op.create_table(
            "rider_locations",
            sa.Column("rider_id", sa.Integer, sa.ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("lat", sa.Float, nullable=False),
            sa.Column("lng", sa.Float, nullable=False),
            sa.Column("accuracy", sa.Float, nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("rider_locations")
    op.drop_index("ix_orders_rider_id", table_name="orders")
    for c in ("delivery_proof_path", "rider_accepted_at", "rider_id"):
        op.drop_column("orders", c)
