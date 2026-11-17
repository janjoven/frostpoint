"""Create Frostpoint requisitions; persist ambiguous outcomes instead of blindly retrying."""
import hashlib
import html
import json
import re

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..config import settings
from ..models import ERPRequisitionSubmission
from .erp import DOCTYPE, FIELD_MAP, RESOURCE, ERPClient

SERIES = "FRP-RS-.YYYY.-.######"
LINKS = {"cost-centers": "Cost Center", "projects": "Project", "uoms": "UOM", "equipment": "Equipment"}


class RequisitionCreationClient(ERPClient):
    def capabilities(self):
        result = self.request("GET", "/api/method/frappe.client.has_permission",
                              params={"doctype": DOCTYPE, "docname": "", "perm_type": "create"})
        permitted = bool(result.get("message", {}).get("has_permission"))
        enabled = settings.erp_requisition_create_enabled
        return {"canCreate": enabled and permitted, "namingSeries": SERIES, "prefix": "FRP-",
                "blockedReason": "" if enabled and permitted else
                "ERP requisition creation is disabled in the backend configuration." if not enabled else
                "The ERP integration user needs Create permission on Requisition Slip."}

    def lookup(self, kind, search):
        if kind not in LINKS:
            raise HTTPException(404, "Unknown requisition lookup.")
        result = self.request("GET", "/api/method/frappe.desk.search.search_link",
                              params={"doctype": LINKS[kind], "txt": search, "reference_doctype": DOCTYPE, "page_length": 20})
        rows = result.get("message", result.get("results", []))
        def plain(value):
            return html.unescape(re.sub(r"<[^>]+>", "", str(value or "")))
        return {"options": [{"value": str(row["value"]), "label": plain(row.get("label") or row["value"]),
                             "description": plain(row.get("description"))} for row in rows]}

    def find_submission(self, marker):
        result = self.request("GET", RESOURCE, params={"fields": '["name","workflow_state"]',
                              "filters": json.dumps([["custom_client_action_id", "=", marker]]), "limit_page_length": 2})
        rows = result["data"]
        if len(rows) > 1:
            raise HTTPException(409, "Multiple ERP records match this submission. Review them in ERP before continuing.")
        return rows[0] if rows else None

    def insert_requisition(self, body, marker):
        payload = {field: int(body[key]) if key == "withMR" else body.get(key) or None
                   for key, field in FIELD_MAP.items() if key in body}
        payload.update({"doctype": DOCTYPE, "naming_series": SERIES, "custom_client_action_id": marker,
                        "item_list": [{"doctype": "Requisition Slip Item", "item_name": row["name"],
                                       "uom": row["uom"], "quantity": str(row["quantity"])} for row in body["items"]]})
        return self.request("POST", RESOURCE, json=payload)["data"]

    insert_document = insert_requisition


def outcome(row, replayed=False, expected_prefix="FRP-"):
    if not row.reference.startswith(expected_prefix):
        raise HTTPException(409, f"ERP created {row.reference} with an unexpected ID. Do not resubmit; review ERP naming.")
    return {"reference": row.reference, "replayed": replayed, "state": "created"}


def reconcile(db, row, erp):
    expected_prefix = getattr(erp, "reference_prefix", "FRP-")
    if row.state == "created":
        return outcome(row, True, expected_prefix)
    if row.state not in ("sending", "unconfirmed"):
        return {"state": row.state, "reference": ""}
    remote = erp.find_submission(getattr(erp, "marker_prefix", "FRP:") + row.request_id)
    if remote:
        row.reference, row.state = remote["name"], "created"
        db.commit()
        return outcome(row, True, expected_prefix)
    return {"state": "unconfirmed", "reference": ""}


def submission_status(db, user, request_id, erp, submission_model=ERPRequisitionSubmission):
    row = db.get(submission_model, str(request_id))
    if not row or row.user_id != user.id:
        raise HTTPException(404, "Submission was not found.")
    return reconcile(db, row, erp)


def create_erp_submission(db, user, body, erp, submission_model):
    request_id = str(body["requestId"])
    digest = hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    # The unique ID and a row lock serialize concurrent requests across API workers.
    if db.get(submission_model, request_id) is None:
        try:
            db.add(submission_model(request_id=request_id, user_id=user.id, body_hash=digest))
            db.commit()
        except IntegrityError:
            db.rollback()
    row = db.scalar(select(submission_model).where(
        submission_model.request_id == request_id).with_for_update().execution_options(populate_existing=True))
    if row.user_id != user.id or row.body_hash != digest:
        db.rollback()
        raise HTTPException(409, "This submission ID belongs to a different request.")
    if row.state in ("created", "sending", "unconfirmed"):
        result = reconcile(db, row, erp)
        if result["state"] == "created":
            return result
        raise HTTPException(409, "The previous submission is unconfirmed. Check its status before submitting again.")
    capabilities = erp.capabilities()
    if not capabilities["canCreate"]:
        db.rollback()
        raise HTTPException(403, capabilities["blockedReason"])
    row.state = "sending"
    db.commit()  # Durable before sending; a process crash cannot trigger an automatic duplicate.
    try:
        remote = erp.insert_document(body, getattr(erp, "marker_prefix", "FRP:") + request_id)
    except HTTPException as error:
        row.state = "failed" if error.status_code in (403, 422) else "unconfirmed"
        db.commit()
        raise
    row.reference, row.state = str(remote["name"]), "created"
    db.commit()
    return outcome(row, expected_prefix=getattr(erp, "reference_prefix", "FRP-"))


def create_requisition(db, user, body, erp):
    return create_erp_submission(db, user, body, erp, ERPRequisitionSubmission)
