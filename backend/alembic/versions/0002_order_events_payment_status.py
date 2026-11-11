"""order events and payment status

Revision ID: 0002
Revises: 0001

0001 builds the schema from the current models, so a fresh database already has these
objects; every step checks before creating.
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "payment_status" not in {c["name"] for c in insp.get_columns("orders")}:
        op.add_column("orders", sa.Column("payment_status", sa.String(20), nullable=False, server_default="unpaid"))
        op.execute("""
            UPDATE orders SET payment_status = CASE
                WHEN status = 'Delivered Successfully' THEN 'paid'
                WHEN payment_method = 'COD' THEN 'cod_due'
                WHEN proof_path <> '' THEN 'proof_sent'
                ELSE 'unpaid' END
        """)

    if "order_events" not in insp.get_table_names():
        op.create_table(
            "order_events",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("order_id", sa.Integer, sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("status", sa.String(30), nullable=False),
            sa.Column("at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("by_id", sa.Integer, sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True),
        )
        # Existing orders only know when they were placed; later steps have no recorded time.
        op.execute("INSERT INTO order_events (order_id, status, at) SELECT id, 'Order Placed', created_at FROM orders")


def downgrade() -> None:
    op.drop_table("order_events")
    op.drop_column("orders", "payment_status")
