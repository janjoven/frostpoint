from typing import Annotated, Literal
from datetime import date as Date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from ..deps import require_roles, current_user
from ..db import get_db
from ..services.erp import ERPClient
from ..services.erp_requisition_create import RequisitionCreationClient, create_requisition, submission_status


def no_cache(response: Response):
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/api/admin/erp/requisitions", tags=["ERP requisitions"],
                   dependencies=[Depends(require_roles("admin")), Depends(no_cache)])


class ItemEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=140)
    name: str = Field(max_length=1000)
    uom: str = Field(max_length=140)
    quantity: str = Field(max_length=255)


class RequisitionEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    modified: str = Field(min_length=1, max_length=40)
    costCenter: str | None = Field(default=None, min_length=1, max_length=140)
    projectName: str | None = Field(default=None, max_length=140)
    requestedBy: str | None = Field(default=None, max_length=255)
    requesterContact: str | None = Field(default=None, max_length=255)
    withMR: bool | None = None
    date: str | None = Field(default=None, pattern=r"^(?:\d{4}-\d{2}-\d{2})?$")
    requiredDate: str | None = Field(default=None, pattern=r"^(?:\d{4}-\d{2}-\d{2})?$")
    equipment: str | None = Field(default=None, max_length=140)
    notes: str | None = Field(default=None, max_length=20000)
    items: list[ItemEdit] | None = Field(default=None, max_length=1000)


class ItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=1000)
    uom: str = Field(min_length=1, max_length=140)
    quantity: Decimal = Field(gt=0, max_digits=15, decimal_places=3)


class RequisitionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    requestId: UUID
    costCenter: str = Field(min_length=1, max_length=140)
    date: Date
    projectName: str = Field(default="", max_length=140)
    requiredDate: Date | None = None
    requestedBy: str = Field(min_length=1, max_length=255)
    requesterContact: str = Field(default="", max_length=255)
    withMR: bool = False
    equipment: str = Field(default="", max_length=140)
    notes: str = Field(default="", max_length=20000)
    items: list[ItemCreate] = Field(min_length=1, max_length=200)


@router.get("")
def list_requisitions(search: str = Query("", max_length=120),
                      status: Annotated[list[str] | None, Query()] = None,
                      with_mr: bool = False, page: int = Query(1, ge=1, le=10000),
                      page_size: int = Query(25, ge=1, le=100)):
    with ERPClient() as erp:
        return erp.list_records(search=search.strip(), statuses=(status or [])[:100],
                                with_mr=with_mr, page=page, page_size=page_size)


@router.get("/summary")
def summary():
    with ERPClient() as erp:
        return erp.summary()


@router.get("/capabilities")
def capabilities():
    with RequisitionCreationClient() as erp:
        return erp.capabilities()


@router.get("/lookups/{kind}")
def lookup(kind: Literal["cost-centers", "projects", "uoms", "equipment"], search: str = Query("", max_length=120)):
    with RequisitionCreationClient() as erp:
        return erp.lookup(kind, search.strip())


@router.get("/submissions/{request_id}")
def check_submission(request_id: UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    with RequisitionCreationClient() as erp:
        return submission_status(db, user, request_id, erp)


@router.post("", status_code=201)
def create(body: RequisitionCreate, user=Depends(current_user), db: Session = Depends(get_db)):
    with RequisitionCreationClient() as erp:
        return create_requisition(db, user, body.model_dump(mode="json"), erp)


@router.get("/{reference}")
def detail(reference: str):
    with ERPClient() as erp:
        return erp.detail(reference)


@router.patch("/{reference}")
def update(reference: str, body: RequisitionEdit):
    with ERPClient() as erp:
        return erp.update(reference, body.model_dump(exclude_none=True))
