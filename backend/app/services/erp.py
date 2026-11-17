"""Backend-only Frappe adapter, scoped to the AML Requisition Slip integration."""
import json
from urllib.parse import quote, urlsplit

import httpx
from fastapi import HTTPException

from ..config import settings

DOCTYPE = "Requisition Slip"
RESOURCE = "/api/resource/Requisition%20Slip"
FIELDS = ["name", "workflow_state", "project", "with_mr", "requested_by", "cost_center", "date", "modified"]
FIELD_MAP = {
    "costCenter": "cost_center", "projectName": "project", "requestedBy": "requested_by",
    "requesterContact": "requester_contact_number", "withMR": "with_mr", "date": "date",
    "requiredDate": "delivery_date", "equipment": "custom_equipment", "notes": "internal_notes",
}


def normalize_record(doc: dict) -> dict:
    def text(key):
        return str(doc.get(key) or "")
    return {
        "reference": text("name"), "status": text("workflow_state"),
        "projectName": text("project"), "withMR": bool(doc.get("with_mr")),
        "requestedBy": text("requested_by"), "costCenter": text("cost_center"),
        "date": text("date"), "modified": text("modified"),
    }


class ERPClient:
    def __enter__(self):
        base = settings.erp_base_url.rstrip("/")
        parsed = urlsplit(base)
        if (parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password
                or parsed.path or parsed.query or parsed.fragment):
            raise HTTPException(503, "Configure ERP_BASE_URL as an HTTPS origin in the backend environment.")
        key, secret = settings.erp_api_key.get_secret_value(), settings.erp_api_secret.get_secret_value()
        if not key or not secret:
            raise HTTPException(503, "ERP API credentials are not configured in the backend environment.")
        prefix = settings.erp_requisition_prefix
        if any(c in prefix for c in "%_/\\"):
            raise HTTPException(503, "ERP_REQUISITION_PREFIX must not contain wildcards or slashes; leave it blank for all records.")
        self.http = httpx.Client(base_url=base, timeout=15, follow_redirects=False,
                                 headers={"Authorization": f"token {key}:{secret}", "Accept": "application/json"})
        return self

    def __exit__(self, *args):
        self.http.close()

    def request(self, method: str, path: str, **kwargs) -> dict:
        try:
            response = self.http.request(method, path, **kwargs)
        except httpx.TimeoutException:
            raise HTTPException(504, "ERP request timed out. Try again.") from None
        except httpx.RequestError:
            raise HTTPException(502, "Cannot reach the ERP server. Check its availability and network connection.") from None
        # Never relay upstream HTML, tracebacks, headers, or credentials to the browser.
        if response.status_code == 401:
            raise HTTPException(502, "ERP authentication failed. Check the backend API credentials.")
        if response.status_code == 403:
            raise HTTPException(403, "The ERP integration user lacks permission for this action.")
        if response.status_code == 404:
            raise HTTPException(404, "ERP record or API endpoint was not found.")
        if response.status_code == 429:
            raise HTTPException(503, "ERP rate limit reached. Try again shortly.")
        try:
            payload = response.json()
        except ValueError:
            raise HTTPException(502, "ERP returned an unexpected response.") from None
        if not isinstance(payload, dict):
            raise HTTPException(502, "ERP returned an unexpected response.")
        error = payload.get("exc_type")
        if error == "TimestampMismatchError":
            raise HTTPException(409, "This requisition changed in ERP. Reload it before saving.")
        if response.is_error or not response.is_success or payload.get("exc"):
            if error in ("ValidationError", "LinkValidationError", "MandatoryError", "WorkflowPermissionError"):
                raise HTTPException(422, "ERP rejected the change. Check linked values, required fields, and workflow permissions.")
            raise HTTPException(502, "ERP could not complete the request.")
        return payload

    def scope_filters(self) -> list:
        prefix = settings.erp_requisition_prefix
        return [["name", "like", prefix + "%"]] if prefix else []

    def check_reference(self, reference: str):
        if (settings.erp_requisition_prefix and not reference.startswith(settings.erp_requisition_prefix)
                or not reference or any(c in reference for c in "/\\")):
            raise HTTPException(404, "Requisition is outside the configured ERP scope.")

    def list_records(self, *, search="", statuses=(), with_mr=False, page=1, page_size=25) -> dict:
        filters = self.scope_filters()
        if statuses:
            filters.append(["workflow_state", "in", list(statuses)])
        if with_mr:
            filters.append(["with_mr", "=", 1])
        params = {"filters": json.dumps(filters)}
        if search:
            # Treat search text literally; the configured prefix always remains an AND filter.
            term = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            params["or_filters"] = json.dumps([[f, "like", f"%{term}%"] for f in
                                               ("name", "project", "requested_by", "cost_center")])
        data = self.request("GET", RESOURCE, params={**params, "fields": json.dumps(FIELDS),
                            "order_by": "modified desc, name desc", "limit_start": (page - 1) * page_size,
                            "limit_page_length": page_size})
        counts = self.request("GET", RESOURCE, params={**params, "fields": '["count(name) as total"]',
                              "order_by": "", "limit_page_length": 1})
        return {"records": [normalize_record(doc) for doc in data["data"]],
                "total": int(counts["data"][0]["total"]), "page": page, "pageSize": page_size,
                "prefix": settings.erp_requisition_prefix}

    def summary(self) -> dict:
        payload = self.request("GET", RESOURCE, params={"filters": json.dumps(self.scope_filters()),
                               "fields": '["workflow_state","count(name) as total"]',
                               "group_by": "workflow_state", "order_by": "workflow_state asc",
                               "limit_page_length": 500})
        return {"prefix": settings.erp_requisition_prefix,
                "byStatus": {str(row.get("workflow_state") or ""): int(row["total"]) for row in payload["data"]}}

    def raw_record(self, reference: str) -> dict:
        self.check_reference(reference)
        return self.request("GET", RESOURCE + "/" + quote(reference, safe=""))["data"]

    def permissions(self, reference: str) -> dict:
        payload = self.request("GET", "/api/method/frappe.desk.form.load.get_docinfo",
                               params={"doctype": DOCTYPE, "name": reference})
        return payload.get("docinfo", {}).get("permissions", {})

    def detail(self, reference: str) -> dict:
        doc = self.raw_record(reference)
        permissions = self.permissions(reference)
        can_edit = bool(settings.erp_requisition_writes_enabled and permissions.get("write")
                        and doc.get("docstatus", 0) == 0)
        reason = ("" if can_edit else "ERP editing is disabled in the backend configuration."
                  if not settings.erp_requisition_writes_enabled else
                  "The ERP integration user does not have Write permission for this record."
                  if not permissions.get("write") else "Submitted or cancelled requisitions are read-only here.")
        return {**normalize_record(doc), **{key: str(doc.get(field) or "") for key, field in FIELD_MAP.items()
                                          if key != "withMR"},
                "projectLocation": str(doc.get("project_location") or ""),
                "approvedBy": str(doc.get("custom_approved_by") or ""),
                "approvedContact": str(doc.get("custom_approved_contact_number") or ""),
                "items": [{"id": str(row["name"]), "name": str(row.get("item_name") or ""),
                           "uom": str(row.get("uom") or ""), "quantity": str(row.get("quantity") or ""),
                           "amount": row.get("amount"), "particulars": str(row.get("particulars") or ""),
                           "forDocument": str(row.get("for") or ""),
                           "itemType": str(row.get("item_type") or ""),
                           "itemOrExpense": str(row.get("item_or_expense") or ""),
                           "attachment": bool(row.get("attach_image"))} for row in doc.get("item_list", [])],
                "canEdit": can_edit, "readOnlyReason": reason,
                "erpUrl": settings.erp_base_url.rstrip("/") + "/app/requisition-slip/" + quote(reference, safe="")}

    def update(self, reference: str, changes: dict) -> dict:
        # No upstream mutations can occur unless explicitly enabled AND ERP authorizes this document.
        if not settings.erp_requisition_writes_enabled:
            raise HTTPException(403, "ERP requisition editing is disabled in the backend configuration.")
        current = self.raw_record(reference)
        if not self.permissions(reference).get("write"):
            raise HTTPException(403, "The ERP integration user lacks Write permission for this requisition.")
        if current.get("docstatus", 0) != 0:
            raise HTTPException(403, "Submitted or cancelled requisitions cannot be edited here.")
        if current.get("modified") != changes["modified"]:
            raise HTTPException(409, "This requisition changed in ERP. Reload it before saving.")
        payload = {field: (int(value) if key == "withMR" else value or None)
                   for key, field in FIELD_MAP.items() if key in changes for value in [changes[key]]}
        payload["modified"] = changes["modified"]  # Frappe checks this again while saving.
        if "items" in changes:
            existing = {row["name"]: row for row in current.get("item_list", [])}
            ids = [row["id"] for row in changes["items"]]
            if len(ids) != len(set(ids)) or set(ids) != set(existing):
                raise HTTPException(422, "Item rows cannot be added or removed through this editor yet.")
            # Preserve unedited child fields (amount, attachment, accounting references, etc.).
            payload["item_list"] = [{**existing[row["id"]], "item_name": row["name"],
                                     "uom": row["uom"], "quantity": row["quantity"]} for row in changes["items"]]
        self.request("PUT", RESOURCE + "/" + quote(reference, safe=""), json=payload)
        return self.detail(reference)
