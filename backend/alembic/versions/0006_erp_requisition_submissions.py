"""Durable submission IDs for Frostpoint ERP requisitions."""
from alembic import op
import sqlalchemy as sa

from app.models import ERPRequisitionSubmission

revision = "0006"
down_revision = "0005"


def upgrade():
    if "erp_requisition_submissions" not in sa.inspect(op.get_bind()).get_table_names():
        ERPRequisitionSubmission.__table__.create(op.get_bind())


def downgrade():
    op.drop_table("erp_requisition_submissions")
