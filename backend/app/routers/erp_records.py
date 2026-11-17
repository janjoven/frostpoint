from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from ..deps import require_roles
from ..services.erp_records import ERPRecordsClient
from .erp import no_cache

Section = Literal["payments", "purchases", "vouchers", "employees"]
router = APIRouter(prefix="/api/admin/erp/records", tags=["ERP records"],
                   dependencies=[Depends(require_roles("admin")), Depends(no_cache)])


@router.get("/{section}")
def records(section: Section, search: str = Query("", max_length=120),
            status: Annotated[list[str] | None, Query()] = None,
            workflow_state: Annotated[list[str] | None, Query()] = None,
            page: int = Query(1, ge=1, le=10000), page_size: int = Query(25, ge=1, le=100)):
    with ERPRecordsClient() as erp:
        return erp.list_section(section, search=search.strip(), statuses=(status or [])[:100],
                                workflow_states=(workflow_state or [])[:100], page=page, page_size=page_size)


@router.get("/{section}/summary")
def summary(section: Section):
    with ERPRecordsClient() as erp:
        return erp.section_summary(section)


@router.get("/{section}/{reference:path}")
def detail(section: Section, reference: str):
    with ERPRecordsClient() as erp:
        return erp.section_detail(section, reference)
