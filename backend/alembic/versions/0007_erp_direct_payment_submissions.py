"""Durable submission IDs for Frostpoint Direct Payment Orders."""
from alembic import op
import sqlalchemy as sa
from app.models import ERPDirectPaymentSubmission

revision = "0007"
down_revision = "0006"


def upgrade():
    if "erp_direct_payment_submissions" not in sa.inspect(op.get_bind()).get_table_names():
        ERPDirectPaymentSubmission.__table__.create(op.get_bind())


def downgrade():
    op.drop_table("erp_direct_payment_submissions")
