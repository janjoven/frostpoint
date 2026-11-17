"""Read-only, allowlisted mappings for the remaining AML ERP sections."""
import html
import json
import re
from urllib.parse import quote

from fastapi import HTTPException

from ..config import settings
from .erp import ERPClient


def column(field, label, kind="text"):
    return {"field": field, "label": label, "type": kind}


DOCUMENTS = {
    "payments": {
        "doctype": "Direct Payment Order", "route": "direct-payment-order", "status": "workflow_state",
        "name": ["payee_name", "payee"], "date": "transaction_date", "amount": "total_amount_company_default_",
        "search": ["name", "payee_name", "payee", "requestor_name", "company", "cost_center"],
        "list": ["name", "workflow_state", "payee_name", "payee", "requestor_name", "company",
                 "transaction_date", "total_amount_company_default_", "cost_center", "modified"],
        "fields": [column("direct_payment_type", "Direct Payment Type"), column("department", "Department"),
                   column("requestor_name", "Requestor Name"), column("company", "Company"),
                   column("transaction_date", "Transaction Date"), column("custom_rs_no", "Requisition Slip"),
                   column("payee_type", "Payee Type"), column("payee", "Payee ID"), column("payee_name", "Payee Name"),
                   column("cost_center", "Cost Center"), column("project_id", "Project"),
                   column("custom_equipment", "Equipment"), column("bank", "Bank"),
                   column("bank_account_name", "Bank Account Name"), column("bank_account_no", "Bank Account Number"),
                   column("total_amount_company_default_", "Total (Company Currency)", "money"),
                   column("total_tax_and_charges", "Tax and Charges (Company Currency)", "money"),
                   column("additional_discount_amount", "Additional Discount (Company Currency)", "money"),
                   column("internal_notes", "Internal Notes")],
        "tables": [
            ("expense_list", "Expenses", [column("expense_type", "Expense"), column("remarks", "Particulars"),
                column("qty", "Quantity"), column("uom", "UOM"), column("rate", "Unit Cost (PHP)", "money"),
                column("amount", "Amount", "money")]),
            ("custom_reference", "References", [column("reference_type", "Type"), column("custom_reference_name", "Reference"),
                column("reference_name", "Reference Name"), column("amount", "Amount", "money")]),
            ("list", "Items", [column("item_code", "Item Code"), column("item_name", "Item"), column("qty", "Quantity"),
                column("uom", "UOM"), column("unit_cost", "Unit Cost", "money"), column("amount", "Amount", "money")]),
            ("custom_ca_reference_table", "Cash Advance References", [column("type", "Type"), column("payee", "Payee"),
                column("check_bank", "Check Bank"), column("check_no", "Check Number"), column("cashcheck_date", "Cash/Check Date"),
                column("amount", "Amount", "money"), column("clear", "Clear", "check")]),
            ("custom_summary_list_of_payments", "Summary List of Payments", [column("locators", "Locators"),
                column("amount", "Amount", "money"), column("period_from", "Period From"), column("period_to", "Period To"),
                column("deposit_date", "Deposit Date"), column("transfer_date", "Transfer Date")]),
        ],
    },
    "purchases": {
        "doctype": "Purchase Order", "route": "purchase-order", "status": "status", "workflow": "workflow_state",
        "name": ["supplier_name", "supplier"], "date": "transaction_date", "amount": "grand_total", "currency": "currency",
        "search": ["name", "supplier_name", "supplier", "requestor", "company", "project"],
        "list": ["name", "workflow_state", "status", "supplier_name", "supplier", "company", "transaction_date",
                 "grand_total", "currency", "requestor", "modified"],
        "fields": [column("company", "Company"), column("supplier", "Supplier ID"), column("supplier_name", "Supplier"),
                   column("requestor", "Requestor"), column("transaction_date", "Date"), column("schedule_date", "Required By"),
                   column("cost_center", "Cost Center"), column("project", "Project"), column("currency", "Currency"),
                   column("grand_total", "Grand Total", "money"), column("terms", "Terms and Conditions")],
        "tables": [("items", "Purchase Order Items", [column("item_code", "Item Code"), column("item_name", "Item"),
                    column("qty", "Quantity"), column("uom", "UOM"), column("rate", "Unit Cost", "money"),
                    column("amount", "Amount", "money"), column("schedule_date", "Required By"),
                    column("received_qty", "Received Quantity"), column("billed_amt", "Billed Amount", "money"),
                    column("project", "Project"), column("cost_center", "Cost Center")])],
    },
    "vouchers": {
        "doctype": "Payment Entry", "route": "payment-entry", "status": "docstatus",
        "name": ["party_name", "party"], "date": "posting_date", "amount": "paid_amount", "currency": "paid_from_account_currency",
        "search": ["name", "party_name", "party", "company", "reference_no"],
        "list": ["name", "docstatus", "party_name", "party", "company", "posting_date", "payment_type",
                 "paid_amount", "paid_from_account_currency", "modified"],
        "fields": [column("company", "Company"), column("posting_date", "Posting Date"), column("payment_type", "Payment Type"),
                   column("party_type", "Party Type"), column("party", "Party ID"), column("party_name", "Party Name"),
                   column("mode_of_payment", "Mode of Payment"), column("paid_from", "Paid From"), column("paid_to", "Paid To"),
                   column("paid_amount", "Paid Amount", "money"), column("paid_from_account_currency", "Paid Amount Currency"),
                   column("received_amount", "Received Amount", "money"), column("paid_to_account_currency", "Received Amount Currency"),
                   column("reference_no", "Cheque / Reference Number"), column("reference_date", "Cheque / Reference Date"),
                   column("cost_center", "Cost Center"), column("project", "Project"),
                   column("receiver_bank", "Receiver Bank"), column("account_name", "Account Name"),
                   column("account_number", "Account Number"), column("remarks", "Remarks")],
        "tables": [
            ("custom_details", "Particulars", [column("details", "Details"), column("amount", "Amount", "money")]),
            ("details", "Payment Breakdown", [column("type", "Type"), column("payee", "Payee"), column("check_bank", "Check Bank"),
                column("check_no", "Check Number"), column("check_date", "Cash/Check Date"), column("amount", "Amount", "money"),
                column("clear", "Clear", "check")]),
            ("references", "Payment References", [column("reference_doctype", "Document Type"), column("reference_name", "Reference"),
                column("bill_no", "Supplier Invoice"), column("due_date", "Due Date"),
                column("allocated_amount", "Allocated Amount", "money"), column("outstanding_amount", "Outstanding Amount", "money")]),
            ("deductions", "Deductions (Company Currency)", [column("account", "Account"), column("cost_center", "Cost Center"),
                column("description", "Description"), column("amount", "Amount", "money")]),
        ],
    },
    "employees": {
        "doctype": "Employee", "route": "employee", "status": "status", "name": ["employee_name"],
        "date": "date_of_joining", "search": ["name", "employee_name", "company", "department", "designation", "company_email"],
        # Employee details use this projection too. Never retrieve the full HR document.
        "list": ["name", "employee_name", "status", "company", "department", "designation", "company_email",
                 "date_of_joining", "employment_type", "branch", "modified"],
        "fields": [column("employee_name", "Employee Name"), column("company", "Company"), column("department", "Department"),
                   column("designation", "Designation"), column("company_email", "Company Email"),
                   column("employment_type", "Employment Type"), column("branch", "Branch"), column("date_of_joining", "Date of Joining")],
        "tables": [],
    },
}
DOCSTATUS = {"Draft": 0, "Submitted": 1, "Cancelled": 2}


def text(value):
    if value is None:
        return ""
    return html.unescape(re.sub(r"<[^>]+>", "", str(value)))


def status_value(config, doc):
    value = doc.get(config["status"])
    if config["status"] == "docstatus":
        return {0: "Draft", 1: "Submitted", 2: "Cancelled"}.get(int(value) if value is not None else -1, "Unknown")
    return text(value)


class ERPRecordsClient(ERPClient):
    def config(self, section):
        if section not in DOCUMENTS:
            raise HTTPException(404, "Unknown ERP section.")
        return DOCUMENTS[section]

    def resource(self, config):
        return "/api/resource/" + quote(config["doctype"], safe="")

    def normalize(self, section, config, doc):
        currency = text(doc.get(config.get("currency", "")))
        return {"reference": text(doc.get("name")), "name": next((text(doc.get(f)) for f in config["name"] if doc.get(f)), ""),
                "company": text(doc.get("company")), "status": status_value(config, doc),
                "workflowState": text(doc.get(config.get("workflow", ""))), "date": text(doc.get(config["date"])),
                "amount": text(doc.get(config["amount"])) if config.get("amount") and doc.get(config["amount"]) is not None else None,
                "currency": currency, "modified": text(doc.get("modified")),
                "department": text(doc.get("department")) if section == "employees" else "",
                "designation": text(doc.get("designation")) if section == "employees" else "",
                "companyEmail": text(doc.get("company_email")) if section == "employees" else ""}

    def list_section(self, section, *, search="", statuses=(), workflow_states=(), page=1, page_size=25):
        config = self.config(section)
        filters = []
        if statuses:
            if config["status"] == "docstatus":
                if any(s not in DOCSTATUS for s in statuses):
                    raise HTTPException(422, "Payment Entry status must be Draft, Submitted, or Cancelled.")
                statuses = [DOCSTATUS[s] for s in statuses]
            filters.append([config["status"], "in", list(statuses)])
        if workflow_states:
            if not config.get("workflow"):
                raise HTTPException(422, "A separate workflow filter is available only for Purchase Orders.")
            filters.append([config["workflow"], "in", list(workflow_states)])
        params = {"filters": json.dumps(filters)}
        if search:
            term = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            params["or_filters"] = json.dumps([[f, "like", f"%{term}%"] for f in config["search"]])
        payload = self.request("GET", self.resource(config), params={**params, "fields": json.dumps(config["list"]),
                               "order_by": "modified desc, name desc", "limit_start": (page - 1) * page_size,
                               "limit_page_length": page_size})
        count = self.request("GET", self.resource(config), params={**params, "fields": '["count(name) as total"]',
                             "order_by": "", "limit_page_length": 1})
        return {"section": section, "doctype": config["doctype"],
                "records": [self.normalize(section, config, doc) for doc in payload["data"]],
                "total": int(count["data"][0]["total"]), "page": page, "pageSize": page_size}

    def section_summary(self, section):
        config = self.config(section)
        fields = [config["status"]] + ([config["workflow"]] if config.get("workflow") else [])
        data = self.request("GET", self.resource(config), params={"fields": json.dumps(fields + ["count(name) as total"]),
                            "group_by": ",".join(fields), "order_by": ",".join(f + " asc" for f in fields),
                            "limit_page_length": 500})
        buckets = [{"status": status_value(config, row), "workflowState": text(row.get(config.get("workflow", ""))),
                    "count": int(row["total"])} for row in data["data"]]
        return {"section": section, "doctype": config["doctype"], "total": sum(b["count"] for b in buckets), "buckets": buckets}

    def section_detail(self, section, reference):
        config = self.config(section)
        if not reference or len(reference) > 140 or any(ord(c) < 32 for c in reference):
            raise HTTPException(422, "Invalid ERP record reference.")
        if section == "employees":
            payload = self.request("GET", self.resource(config), params={"fields": json.dumps(config["list"]),
                                   "filters": json.dumps([["name", "=", reference]]), "limit_page_length": 1})
            if not payload["data"]:
                raise HTTPException(404, "Employee was not found or is not accessible to the integration user.")
            doc = payload["data"][0]
        else:
            doc = self.request("GET", self.resource(config) + "/" + quote(reference, safe=""))["data"]
        record = self.normalize(section, config, doc)
        def display(col, row):
            value = row.get(col["field"])
            return ("Yes" if value else "No") if col["type"] == "check" else text(value)
        fields = [{"label": col["label"], "value": display(col, doc), "type": col["type"],
                   "currency": text(doc.get("paid_to_account_currency")) if col["field"] == "received_amount" else record["currency"]}
                  for col in config["fields"]]
        tables = [{"label": label, "columns": cols,
                   "rows": [{col["field"]: display(col, row) for col in cols} for row in doc.get(field, [])]}
                  for field, label, cols in config["tables"] if doc.get(field)]
        return {**record, "section": section, "doctype": config["doctype"], "fields": fields, "tables": tables,
                "canEdit": False, "erpUrl": settings.erp_base_url.rstrip("/") + "/app/" + config["route"] + "/" + quote(reference, safe="")}
