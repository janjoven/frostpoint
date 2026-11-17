from datetime import date as Date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user, require_roles
from ..models import ERPDirectPaymentSubmission
from ..services.erp_payment_create import DirectPaymentCreationClient
from ..services.erp_requisition_create import create_erp_submission, submission_status
from .erp import no_cache

Money = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=2)]
Link = Annotated[str, Field(max_length=140)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PaymentFields(Input):
    paymentType: Literal["Direct Expense", "Cash Advance"] = "Direct Expense"
    company: str = Field(min_length=1, max_length=140)
    department: str = Field(min_length=1, max_length=255)
    transactionDate: Date
    requestorName: str = Field(min_length=1, max_length=255)
    rsNumber: Link = ""
    payeeType: Literal["Employee", "Supplier"]
    payee: str = Field(min_length=1, max_length=140)
    bankAccount: Link = ""
    accountName: str = Field(default="", max_length=255)
    receivedBy: str = Field(default="", max_length=255)
    equipment: Link = ""
    projectId: Link = ""
    equipmentCode: Link = ""
    costCenter: str = Field(min_length=1, max_length=140)
    governmentProjectId: str = Field(default="", max_length=255)
    expenseType: Link = ""
    deliveryPoint: str = Field(default="", max_length=1000)
    discountPercentage: Decimal = Field(default=0, ge=0, le=100, max_digits=6, decimal_places=3)
    discountAmount: Money = Decimal(0)
    taxCategory: Link = ""
    taxCharges: Money = Decimal(0)
    cashAdvanceReference: Link = ""
    refundAmount: Money = Decimal(0)
    notes: str = Field(default="", max_length=18000)


class Expense(Input):
    expense: str = Field(min_length=1, max_length=140)
    particulars: str = Field(default="", max_length=2000)
    qty: Decimal | None = Field(default=None, gt=0, max_digits=15, decimal_places=3)
    unitCost: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=4)
    uom: Link = ""
    amount: Money


class Reference(Input):
    type: Literal["Purchase Order", "Salary Payroll Entry", "Sales Order"]
    name: str = Field(min_length=1, max_length=140)
    amount: Money = Decimal(0)


class CashAdvance(Input):
    type: Literal["Cash", "Check", "Withholding Tax", "Loan Repayment", "CA Repayment"] = "CA Repayment"
    payee: str = Field(default="", max_length=255)
    bank: str = Field(default="", max_length=255)
    checkNumber: str = Field(default="", max_length=255)
    date: Date | None = None
    amount: Money = Decimal(0)


class PaymentCreate(Input):
    requestId: UUID
    fields: PaymentFields
    expenses: list[Expense] = Field(min_length=1, max_length=200)
    references: list[Reference] = Field(default_factory=list, max_length=200)
    cashAdvances: list[CashAdvance] = Field(default_factory=list, max_length=200)


router = APIRouter(prefix="/api/admin/erp/payment-orders", tags=["ERP payment request creation"],
                   dependencies=[Depends(require_roles("admin")), Depends(no_cache)])


@router.get("/capabilities")
def capabilities():
    with DirectPaymentCreationClient() as erp:
        return erp.capabilities()


@router.get("/lookups/{kind}")
def lookup(kind: Literal["companies", "cost-centers", "projects", "uoms", "equipment", "accounts", "bank-accounts",
                         "tax-categories", "cash-advances", "requisitions", "payees", "references"],
           search: str = Query("", max_length=120), payee_type: Literal["Employee", "Supplier"] = "Employee",
           reference_type: Literal["Purchase Order", "Salary Payroll Entry", "Sales Order"] = "Purchase Order",
           company: str = Query("", max_length=140)):
    with DirectPaymentCreationClient() as erp:
        return erp.lookup(kind, search.strip(), payee_type=payee_type, reference_type=reference_type, company=company)


@router.get("/submissions/{request_id}")
def check(request_id: UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    with DirectPaymentCreationClient() as erp:
        return submission_status(db, user, request_id, erp, ERPDirectPaymentSubmission)


@router.post("", status_code=201)
def create(body: PaymentCreate, user=Depends(current_user), db: Session = Depends(get_db)):
    with DirectPaymentCreationClient() as erp:
        return create_erp_submission(db, user, body.model_dump(mode="json"), erp, ERPDirectPaymentSubmission)
