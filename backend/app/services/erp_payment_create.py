"""Create payment REQUESTS only. No approval, posting, or payment execution."""
import json
from decimal import Decimal, ROUND_HALF_UP, localcontext

from fastapi import HTTPException

from ..config import settings
from .erp import ERPClient
from .erp_records import text

DOCTYPE = "Direct Payment Order"
RESOURCE = "/api/resource/Direct%20Payment%20Order"
SERIES = "FRP-DPO-.YYYY.-.#####"
PAYEE_TYPES = ("Employee", "Supplier")
REFERENCE_TYPES = ("Purchase Order", "Salary Payroll Entry", "Sales Order")
LINKS = {"companies": "Company", "cost-centers": "Cost Center", "projects": "Project", "uoms": "UOM",
         "equipment": "Equipment", "accounts": "Account", "bank-accounts": "Bank Account",
         "tax-categories": "Tax Category", "cash-advances": "Cash Advance Liquidation", "requisitions": "Requisition Slip"}
FIELD_MAP = {"paymentType": "direct_payment_type", "company": "company", "department": "department",
             "transactionDate": "transaction_date", "requestorName": "requestor_name", "rsNumber": "custom_rs_no",
             "payeeType": "payee_type", "payee": "payee", "bankAccount": "bank_account", "accountName": "custom_account_name",
             "receivedBy": "received_by", "equipment": "custom_equipment", "projectId": "project_id",
             "equipmentCode": "equipment_code", "costCenter": "cost_center", "governmentProjectId": "government_project_id",
             "expenseType": "expense_type", "deliveryPoint": "delivery_point", "taxCategory": "tax_category",
             "cashAdvanceReference": "custom_cash_advance_reference", "refundAmount": "custom_for_refund_amount"}


def money(value):
    with localcontext() as context:
        context.prec = 48
        return Decimal(str(value or "0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_totals(body):
    fields = body["fields"]
    subtotal = Decimal(0)
    for row in body["expenses"]:
        amount = money(row["amount"])
        if row.get("qty") is not None and row.get("unitCost") is not None:
            expected = money(Decimal(row["qty"]) * Decimal(row["unitCost"]))
            if amount != expected:
                raise HTTPException(422, "Each expense amount must equal quantity × unit cost when both are entered.")
        subtotal += amount
    if subtotal > Decimal("9999999999999999.99"):
        raise HTTPException(422, "Expense subtotal exceeds the supported monetary limit.")
    percentage = Decimal(str(fields.get("discountPercentage") or "0"))
    fixed_discount, taxes = money(fields.get("discountAmount")), money(fields.get("taxCharges"))
    discount = money(subtotal * percentage / 100) + fixed_discount
    if discount > subtotal:
        raise HTTPException(422, "Discounts cannot exceed the expense subtotal.")
    total = money(subtotal - discount + taxes)
    if total <= 0:
        raise HTTPException(422, "The Direct Payment Order total must be greater than zero.")
    if total > Decimal("9999999999999999.99"):
        raise HTTPException(422, "Payment order total exceeds the supported monetary limit.")
    return {"subtotal": subtotal, "total": total, "discount": discount, "taxes": taxes}


class DirectPaymentCreationClient(ERPClient):
    reference_prefix = "FRP-DPO-"
    marker_prefix = "FRP-DPO:"

    def capabilities(self):
        if hasattr(self, "_capabilities"):
            return self._capabilities
        permission = self.request("GET", "/api/method/frappe.client.has_permission",
                                  params={"doctype": DOCTYPE, "docname": "", "perm_type": "create"})
        metadata = self.request("GET", "/api/method/frappe.desk.form.load.getdoctype", params={"doctype": DOCTYPE, "with_parent": 1})
        parent = next((doc for doc in metadata.get("docs", []) if doc.get("name") == DOCTYPE), {})
        department = next((f for f in parent.get("fields", []) if f.get("fieldname") == "department"), {})
        permitted = bool(permission.get("message", {}).get("has_permission"))
        enabled = settings.erp_dpo_create_enabled
        self._capabilities = {"canCreate": permitted and enabled, "namingSeries": SERIES,
                "departments": [s.strip() for s in (department.get("options") or "").splitlines() if s.strip()],
                "payeeTypes": PAYEE_TYPES, "referenceTypes": REFERENCE_TYPES,
                "blockedReason": "" if permitted and enabled else
                "ERP Direct Payment Order creation is disabled in the backend configuration." if not enabled else
                "The ERP integration user needs Create permission on Direct Payment Order."}
        return self._capabilities

    def lookup(self, kind, search, *, payee_type="Employee", reference_type="Purchase Order", company=""):
        if kind == "payees":
            if payee_type not in PAYEE_TYPES:
                raise HTTPException(422, "Payee type must be Employee or Supplier.")
            doctype = payee_type
        elif kind == "references":
            if reference_type not in REFERENCE_TYPES:
                raise HTTPException(422, "Unsupported payment reference type.")
            doctype = reference_type
        elif kind in LINKS:
            doctype = LINKS[kind]
        else:
            raise HTTPException(404, "Unknown payment lookup.")
        filters = {}
        if company and kind in ("accounts", "cost-centers", "bank-accounts"):
            filters["company"] = company
        if kind in ("accounts", "cost-centers"):
            filters["is_group"] = 0
        if kind == "requisitions":
            filters["name"] = ["like", "FRP-%"]
        payload = self.request("GET", "/api/method/frappe.desk.search.search_link",
                               params={"doctype": doctype, "txt": search, "reference_doctype": DOCTYPE,
                                       "filters": json.dumps(filters), "page_length": 20})
        rows = payload.get("message", payload.get("results", []))
        return {"options": [{"value": str(row["value"]), "label": text(row.get("label") or row["value"]),
                             "description": text(row.get("description"))} for row in rows]}

    def find_submission(self, marker):
        result = self.request("GET", RESOURCE, params={"fields": '["name","workflow_state"]',
                              "filters": json.dumps([["name", "like", "FRP-DPO-%"],
                                                     ["internal_notes", "like", "%" + marker + "%"]]), "limit_page_length": 2})
        if len(result["data"]) > 1:
            raise HTTPException(409, "Multiple payment orders match this submission. Review ERP before continuing.")
        return result["data"][0] if result["data"] else None

    def insert_document(self, body, marker):
        fields = body["fields"]
        capabilities = self.capabilities()
        if not capabilities["canCreate"]:
            raise HTTPException(403, capabilities["blockedReason"])
        if fields["department"] not in capabilities["departments"]:
            raise HTTPException(422, "Select a department from the ERP department list.")
        totals = calculate_totals(body)
        # Link suggestions and validation obey ERP Select/user permissions and the selected company.
        checks = [("companies", fields["company"]), ("cost-centers", fields["costCenter"]), ("payees", fields["payee"])]
        checks.extend(("accounts", name) for name in sorted({row["expense"] for row in body["expenses"]}))
        for kind, value in checks:
            options = self.lookup(kind, value, company=fields["company"], payee_type=fields["payeeType"])["options"]
            if not any(option["value"] == value for option in options):
                raise HTTPException(422, "Choose valid ERP company, cost center, payee, and expense accounts for the selected company.")
        payload = {erp_field: fields.get(key) or None for key, erp_field in FIELD_MAP.items()}
        payload.update({"doctype": DOCTYPE, "naming_series": SERIES,
                        "internal_notes": (fields.get("notes") or "").rstrip() + "\n\nFrostpoint submission ID: " + marker,
                        "additional_discount_percentage": str(fields.get("discountPercentage") or "0"),
                        "additional_discount_amount": str(money(fields.get("discountAmount"))),
                        "total_tax_and_charges": str(totals["taxes"]),
                        "total_amount_company_default_": str(totals["total"]),
                        "custom_total_expense": str(totals["subtotal"]),
                        "grand_total_php": str(totals["total"]), "grand_total_placeholder": str(totals["subtotal"]),
                        "expense_list": [{"doctype": "Direct Payment Request Expense List", "expense_type": row["expense"],
                                          "remarks": row.get("particulars") or "", "qty": str(row["qty"]) if row.get("qty") is not None else "",
                                          "uom": row.get("uom") or None, "rate": str(row["unitCost"]) if row.get("unitCost") is not None else "",
                                          "amount": str(money(row["amount"]))} for row in body["expenses"]],
                        "custom_reference": [{"doctype": "References", "reference_type": row["type"],
                                              "custom_reference_name": row["name"], "amount": str(money(row["amount"]))}
                                             for row in body.get("references", [])],
                        "custom_ca_reference_table": [{"doctype": "CA Reference Table", "type": row["type"],
                            "payee": row.get("payee") or "", "check_bank": row.get("bank") or "", "check_no": row.get("checkNumber") or "",
                            "cashcheck_date": row.get("date"), "amount": str(money(row.get("amount")))} for row in body.get("cashAdvances", [])]})
        return self.request("POST", RESOURCE, json=payload)["data"]
