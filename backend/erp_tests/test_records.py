"""Read-only ERP record contracts; all requests use a fake transport."""
import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.deps import current_user
from app.routers.erp_records import router
from app.services import erp
from app.services.erp_records import DOCUMENTS

REAL_CLIENT = httpx.Client
DOCS = {
    "payments": {"name": "DPO-TEST", "company": "Test Co", "workflow_state": "Pending", "payee_name": "Test Payee",
                 "transaction_date": "2026-11-16", "total_amount_company_default_": 0,
                 "expense_list": [{"expense_type": "Supplies", "remarks": "Example", "qty": "1", "uom": "Nos", "rate": "0", "amount": 0}]},
    "purchases": {"name": "PO-TEST", "company": "Test Co", "status": "To Receive", "workflow_state": "For Purchase",
                  "supplier_name": "Test Supplier", "transaction_date": "2026-11-16", "grand_total": 17.5, "currency": "USD",
                  "terms": "<p>Test <strong>terms</strong></p>", "items": [{"item_name": "Test Item", "qty": 2, "rate": 8.75, "amount": 17.5}]},
    "vouchers": {"name": "PE-TEST", "company": "Test Co", "docstatus": 2, "status": "Submitted", "party_name": "Test Party",
                 "posting_date": "2026-11-16", "paid_amount": 20, "received_amount": 18, "paid_from_account_currency": "USD",
                 "paid_to_account_currency": "EUR", "references": [{"reference_name": "INV-TEST", "allocated_amount": 20}],
                 "custom_details": [{"details": "Test service", "amount": 20}]},
    "employees": {"name": "EMP-TEST", "employee_name": "Directory Test", "status": "Active", "company": "Test Co",
                  "company_email": "work@example.com", "department": "Operations", "designation": "Officer",
                  "basic_salary": 99999, "bank_ac_no": "PRIVATE-BANK", "passport_number": "PRIVATE-PASSPORT",
                  "personal_email": "private@example.com", "health_details": "PRIVATE-HEALTH"},
}


@pytest.fixture
def harness(monkeypatch):
    monkeypatch.setattr(erp.settings, "erp_base_url", "https://erp.example.com")
    monkeypatch.setattr(erp.settings, "erp_api_key", SecretStr("test-key"))
    monkeypatch.setattr(erp.settings, "erp_api_secret", SecretStr("test-secret"))
    monkeypatch.setattr(erp.settings, "erp_requisition_prefix", "ACS-RS-")
    state = SimpleNamespace(calls=[], error=None)

    def handle(request):
        state.calls.append(request)
        if state.error:
            return httpx.Response(state.error, json={"exc": "PRIVATE TRACEBACK test-secret"})
        section = next(k for k, config in DOCUMENTS.items() if request.url.path.startswith("/api/resource/" + config["doctype"]))
        doc = DOCS[section]
        params = request.url.params
        if "count(name) as total" in json.loads(params.get("fields", "[]")):
            if params.get("group_by"):
                return httpx.Response(200, json={"data": [{**doc, "total": 3}]})
            return httpx.Response(200, json={"data": [{"total": 1}]})
        if request.url.path.endswith("/" + doc["name"]):
            return httpx.Response(200, json={"data": {**doc, "secret_field": "PRIVATE"}})
        return httpx.Response(200, json={"data": [doc]})

    monkeypatch.setattr(erp.httpx, "Client", lambda **kw: REAL_CLIENT(**kw, transport=httpx.MockTransport(handle)))
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(role="admin")
    with TestClient(app) as client:
        yield client, state, app


@pytest.mark.parametrize("section", list(DOCUMENTS))
def test_live_list_projection_counts_and_no_company_prefix(harness, section):
    client, state, _ = harness
    response = client.get(f"/api/admin/erp/records/{section}", params={"search": "Test Co", "page": 2})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["total"] == 1
    data, count = state.calls
    assert data.url.params["limit_start"] == "25"
    assert json.loads(data.url.params["filters"]) == []
    assert data.url.params["or_filters"] == count.url.params["or_filters"]
    assert data.url.params["filters"] == count.url.params["filters"]
    assert all(call.method == "GET" for call in state.calls)


def test_purchase_filters_keep_workflow_and_fulfillment_separate(harness):
    client, state, _ = harness
    response = client.get("/api/admin/erp/records/purchases", params=[("status", "To Receive"), ("workflow_state", "For Purchase")])
    assert response.status_code == 200
    assert json.loads(state.calls[0].url.params["filters"]) == [["status", "in", ["To Receive"]], ["workflow_state", "in", ["For Purchase"]]]
    record = response.json()["records"][0]
    assert record["workflowState"] == "For Purchase" and record["status"] == "To Receive"
    assert record["currency"] == "USD"


def test_vouchers_use_docstatus_and_preserve_source_currency(harness):
    client, state, _ = harness
    response = client.get("/api/admin/erp/records/vouchers", params={"status": "Cancelled"})
    assert json.loads(state.calls[0].url.params["filters"]) == [["docstatus", "in", [2]]]
    assert response.json()["records"][0]["status"] == "Cancelled"
    detail = client.get("/api/admin/erp/records/vouchers/PE-TEST").json()
    received = next(f for f in detail["fields"] if f["label"] == "Received Amount")
    assert received["value"] == "18" and received["currency"] == "EUR"
    assert {table["label"] for table in detail["tables"]} == {"Particulars", "Payment References"}


@pytest.mark.parametrize("section", list(DOCUMENTS))
def test_summaries_use_correct_status_dimension(harness, section):
    client, state, _ = harness
    response = client.get(f"/api/admin/erp/records/{section}/summary")
    assert response.status_code == 200 and response.json()["total"] == 3
    config = DOCUMENTS[section]
    expected = config["status"] + ("," + config["workflow"] if config.get("workflow") else "")
    assert state.calls[0].url.params["group_by"] == expected


@pytest.mark.parametrize("section", list(DOCUMENTS))
def test_details_are_read_only_and_allowlisted(harness, section):
    client, state, _ = harness
    response = client.get(f"/api/admin/erp/records/{section}/{DOCS[section]['name']}")
    assert response.status_code == 200 and response.json()["canEdit"] is False
    assert "PRIVATE" not in response.text and "secret_field" not in response.text
    assert all(call.method == "GET" for call in state.calls)


def test_employee_details_never_request_the_full_hr_document(harness):
    client, state, _ = harness
    response = client.get("/api/admin/erp/records/employees/EMP-TEST")
    request = state.calls[0]
    assert request.url.path == "/api/resource/Employee"
    assert json.loads(request.url.params["filters"]) == [["name", "=", "EMP-TEST"]]
    fields = json.loads(request.url.params["fields"])
    assert "company_email" in fields
    assert not {"basic_salary", "bank_ac_no", "personal_email", "health_details", "passport_number"}.intersection(fields)
    assert "private@example.com" not in response.text and "99999" not in response.text


def test_zero_payment_amount_and_plain_text_terms(harness):
    client, _, _ = harness
    assert client.get("/api/admin/erp/records/payments").json()["records"][0]["amount"] == "0"
    detail = client.get("/api/admin/erp/records/purchases/PO-TEST").json()
    assert next(f for f in detail["fields"] if f["label"] == "Terms and Conditions")["value"] == "Test terms"


def test_rejects_unknown_doctypes_and_unsupported_filters(harness):
    client, state, _ = harness
    assert client.get("/api/admin/erp/records/User").status_code == 422
    assert client.get("/api/admin/erp/records/vouchers?status=Approved").status_code == 422
    assert client.get("/api/admin/erp/records/employees?workflow_state=Pending").status_code == 422
    assert not state.calls


def test_access_requires_admin_and_has_no_mutation_routes(harness):
    client, state, app = harness
    assert client.patch("/api/admin/erp/records/payments/DPO-TEST", json={}).status_code == 405
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(role="staff")
    assert client.get("/api/admin/erp/records/employees").status_code == 403
    assert not state.calls


def test_permission_failure_is_explicit_without_sample_fallback(harness):
    client, state, _ = harness
    state.error = 403
    response = client.get("/api/admin/erp/records/payments")
    assert response.status_code == 403
    assert "PRIVATE" not in response.text and "records" not in response.json()
