import json
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.deps import current_user
from app.models import Account, ERPDirectPaymentSubmission, ERPRequisitionSubmission
from app.routers.erp_payment_create import router
from app.services import erp

REAL_CLIENT = httpx.Client


@pytest.fixture
def harness(monkeypatch):
    monkeypatch.setattr(erp.settings, "erp_base_url", "https://erp.example.com")
    monkeypatch.setattr(erp.settings, "erp_api_key", SecretStr("test-key"))
    monkeypatch.setattr(erp.settings, "erp_api_secret", SecretStr("test-secret"))
    monkeypatch.setattr(erp.settings, "erp_requisition_prefix", "FRP-")
    monkeypatch.setattr(erp.settings, "erp_dpo_create_enabled", True)
    state = SimpleNamespace(calls=[], posts=0, create=True, timeout=False, saved_on_timeout=False,
                            remote=None, name="FRP-DPO-2026-00001", lookup_allowed=True)

    def handle(request):
        state.calls.append(request)
        if request.url.path.endswith("has_permission"):
            return httpx.Response(200, json={"message": {"has_permission": state.create}})
        if request.url.path.endswith("getdoctype"):
            return httpx.Response(200, json={"docs": [{"name": "Direct Payment Order", "fields": [
                {"fieldname": "department", "options": "\nOperations\nAccounting"}]}]})
        if request.url.path.endswith("search_link"):
            return httpx.Response(200, json={"results": [{"value": request.url.params["txt"]}] if state.lookup_allowed else []})
        if request.method == "POST":
            state.posts += 1
            payload = json.loads(request.content)
            remote = {"name": state.name, "workflow_state": "Pending", "internal_notes": payload["internal_notes"]}
            if not state.timeout or state.saved_on_timeout:
                state.remote = remote
            if state.timeout:
                raise httpx.ReadTimeout("Private network error", request=request)
            return httpx.Response(200, json={"data": remote})
        return httpx.Response(200, json={"data": [state.remote] if state.remote else []})

    monkeypatch.setattr(erp.httpx, "Client", lambda **kw: REAL_CLIENT(**kw, transport=httpx.MockTransport(handle)))
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    for table in (Account.__table__, ERPDirectPaymentSubmission.__table__, ERPRequisitionSubmission.__table__):
        table.create(engine)
    with Session(engine, expire_on_commit=False) as db:
        db.add(Account(id=1, email="test@example.com", name="Test Admin", password_hash="test-only", role="admin"))
        db.commit()
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[current_user] = lambda: SimpleNamespace(id=1, role="admin")
        app.dependency_overrides[get_db] = lambda: db
        with TestClient(app) as client:
            yield client, state, db, app
    engine.dispose()


def body():
    return {"requestId": str(uuid4()), "fields": {"company": "Test Co", "department": "Operations", "transactionDate": "2026-11-16",
        "requestorName": "Test Requestor", "payeeType": "Employee", "payee": "EMP-TEST", "costCenter": "Test Center",
        "discountPercentage": "10", "discountAmount": "5", "taxCharges": "2", "notes": "TEST ONLY"},
        "expenses": [{"expense": "Test Expense", "qty": "2", "unitCost": "50", "amount": "100", "uom": "Nos"}]}


def test_maps_dpo_and_calculates_trusted_totals_without_approval_flags(harness):
    client, state, db, _ = harness
    send = body()
    response = client.post("/api/admin/erp/payment-orders", json=send)
    assert response.status_code == 201 and response.json()["reference"] == state.name
    payload = json.loads(next(r.content for r in state.calls if r.method == "POST"))
    assert payload["doctype"] == "Direct Payment Order" and payload["naming_series"] == "FRP-DPO-.YYYY.-.#####"
    assert payload["total_amount_company_default_"] == payload["grand_total_php"] == "87.00"
    assert payload["custom_total_expense"] == payload["grand_total_placeholder"] == "100.00"
    assert payload["expense_list"][0]["expense_type"] == "Test Expense"
    assert "FRP-DPO:" + send["requestId"] in payload["internal_notes"]
    assert not {"workflow_state", "docstatus", "approved_and_signed", "custom_audited", "egov_paid", "paid_", "received_", "flags"}.intersection(payload)
    assert all("Payment%20Entry" not in str(r.url) for r in state.calls)
    assert db.get(ERPDirectPaymentSubmission, send["requestId"]).state == "created"


def test_replay_and_changed_body_do_not_duplicate_payment_request(harness):
    client, state, _, _ = harness
    send = body()
    assert client.post("/api/admin/erp/payment-orders", json=send).status_code == 201
    assert client.post("/api/admin/erp/payment-orders", json=send).json()["replayed"] is True
    send["fields"]["notes"] = "Different"
    assert client.post("/api/admin/erp/payment-orders", json=send).status_code == 409
    assert state.posts == 1


@pytest.mark.parametrize("saved", [False, True])
def test_timeout_checks_marker_in_notes_instead_of_reinserting(harness, saved):
    client, state, _, _ = harness
    state.timeout, state.saved_on_timeout = True, saved
    send = body()
    assert client.post("/api/admin/erp/payment-orders", json=send).status_code == 504
    retry = client.post("/api/admin/erp/payment-orders", json=send)
    assert retry.status_code == (201 if saved else 409) and state.posts == 1
    query = next(r for r in state.calls if "filters" in r.url.params and not r.url.path.endswith("search_link"))
    filters = json.loads(query.url.params["filters"])
    assert ["name", "like", "FRP-DPO-%"] in filters
    assert any(f[0] == "internal_notes" and "FRP-DPO:" in f[2] for f in filters)


def test_requires_create_and_backend_enablement(harness, monkeypatch):
    client, state, _, _ = harness
    state.create = False
    assert client.post("/api/admin/erp/payment-orders", json=body()).status_code == 403
    state.create = True
    monkeypatch.setattr(erp.settings, "erp_dpo_create_enabled", False)
    assert client.post("/api/admin/erp/payment-orders", json=body()).status_code == 403
    assert state.posts == 0


@pytest.mark.parametrize("mode", ["amount", "department", "discount", "zero", "links"])
def test_invalid_financial_or_link_values_never_create_a_request(harness, mode):
    client, state, _, _ = harness
    send = body()
    if mode == "amount":
        send["expenses"][0]["amount"] = "101"
    elif mode == "department":
        send["fields"]["department"] = "Unrecognized"
    elif mode == "discount":
        send["fields"]["discountAmount"] = "1000"
    elif mode == "zero":
        send["fields"].update(discountPercentage="100", discountAmount="0", taxCharges="0")
    else:
        state.lookup_allowed = False
    assert client.post("/api/admin/erp/payment-orders", json=send).status_code == 422
    assert state.posts == 0


@pytest.mark.parametrize("forged", [{"approvedSigned": True}, {"egov_paid": True}, {"workflow_state": "Approved"}, {"naming_series": "DPO-"}])
def test_creation_cannot_forge_approval_payment_or_numbering(harness, forged):
    client, state, _, _ = harness
    assert client.post("/api/admin/erp/payment-orders", json={**body(), **forged}).status_code == 422
    assert state.posts == 0


def test_account_lookup_is_company_scoped_without_permission_bypass(harness):
    client, state, _, _ = harness
    response = client.get("/api/admin/erp/payment-orders/lookups/accounts?company=Test%20Co&search=Test")
    assert response.status_code == 200
    request = state.calls[0]
    assert json.loads(request.url.params["filters"]) == {"company": "Test Co", "is_group": 0}
    assert request.url.params["reference_doctype"] == "Direct Payment Order"
    assert "ignore_user_permissions" not in request.url.params
    assert client.get("/api/admin/erp/payment-orders/lookups/payees?payee_type=User").status_code == 422


def test_wrong_prefix_is_reported_and_not_duplicated(harness):
    client, state, _, _ = harness
    state.name = "DPO-2026-00001"
    send = body()
    assert client.post("/api/admin/erp/payment-orders", json=send).status_code == 409
    assert client.post("/api/admin/erp/payment-orders", json=send).status_code == 409
    assert state.posts == 1


def test_submission_checks_require_admin_and_owner(harness):
    client, _, _, app = harness
    send = body()
    client.post("/api/admin/erp/payment-orders", json=send)
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(id=2, role="admin")
    assert client.get(f"/api/admin/erp/payment-orders/submissions/{send['requestId']}").status_code == 404
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(id=1, role="staff")
    assert client.post("/api/admin/erp/payment-orders", json=body()).status_code == 403


def test_decimal_half_up_rounding_matches_expense_total(harness):
    client, state, _, _ = harness
    send = body()
    send["fields"].update(discountPercentage="0", discountAmount="0", taxCharges="0")
    send["expenses"][0].update(qty="1", unitCost="1.005", amount="1.01")
    assert client.post("/api/admin/erp/payment-orders", json=send).status_code == 201
    payload = json.loads(next(r.content for r in state.calls if r.method == "POST"))
    assert payload["grand_total_php"] == "1.01"


def test_oversized_quantity_rate_product_is_validation_error_not_insert(harness):
    client, state, _, _ = harness
    send = body()
    send["expenses"][0].update(qty="999999999999.999", unitCost="99999999999999.9999", amount="1")
    assert client.post("/api/admin/erp/payment-orders", json=send).status_code == 422
    assert state.posts == 0
