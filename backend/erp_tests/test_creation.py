import json
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.deps import current_user
from app.models import Account, ERPRequisitionSubmission
from app.routers.erp import router
from app.services import erp

REAL_CLIENT = httpx.Client


@pytest.fixture
def harness(monkeypatch):
    monkeypatch.setattr(erp.settings, "erp_base_url", "https://erp.example.com")
    monkeypatch.setattr(erp.settings, "erp_api_key", SecretStr("test-key"))
    monkeypatch.setattr(erp.settings, "erp_api_secret", SecretStr("test-secret"))
    monkeypatch.setattr(erp.settings, "erp_requisition_prefix", "FRP-")
    monkeypatch.setattr(erp.settings, "erp_requisition_create_enabled", True)
    state = SimpleNamespace(calls=[], create=True, posts=0, remote=None, timeout=False, saved_on_timeout=False,
                            returned_name="FRP-RS-2026-000001", lookup_key="results")

    def handle(request):
        state.calls.append(request)
        if request.url.path.endswith("has_permission"):
            return httpx.Response(200, json={"message": {"has_permission": state.create}})
        if request.url.path.endswith("search_link"):
            return httpx.Response(200, json={state.lookup_key: [{"value": "Nos", "description": "<b>Unit</b>"}]})
        if request.method == "POST":
            state.posts += 1
            body = json.loads(request.content)
            doc = {"name": state.returned_name, "workflow_state": "Pending", "custom_client_action_id": body["custom_client_action_id"]}
            if not state.timeout or state.saved_on_timeout:
                state.remote = doc
            if state.timeout:
                raise httpx.ReadTimeout("Private network error", request=request)
            return httpx.Response(200, json={"data": doc})
        return httpx.Response(200, json={"data": [state.remote] if state.remote else []})

    monkeypatch.setattr(erp.httpx, "Client", lambda **kw: REAL_CLIENT(**kw, transport=httpx.MockTransport(handle)))
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Account.__table__.create(engine)
    ERPRequisitionSubmission.__table__.create(engine)
    with Session(engine, expire_on_commit=False) as db:
        db.add(Account(id=1, email="local@example.com", name="Local Admin", password_hash="test-only", role="admin"))
        db.commit()
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[current_user] = lambda: SimpleNamespace(id=1, role="admin")
        app.dependency_overrides[get_db] = lambda: db
        with TestClient(app) as client:
            yield client, state, db, app
    engine.dispose()


def body():
    return {"requestId": str(uuid4()), "costCenter": "Test Center", "date": "2026-11-16", "requestedBy": "Test Requestor",
            "withMR": False, "notes": "Test only", "items": [{"name": "Test Item", "uom": "Nos", "quantity": "2.5"}]}


def test_creation_enforces_frostpoint_series_and_erp_assigns_state(harness):
    client, state, db, _ = harness
    send = body()
    response = client.post("/api/admin/erp/requisitions", json=send)
    assert response.status_code == 201 and response.json()["reference"].startswith("FRP-")
    payload = json.loads(next(r.content for r in state.calls if r.method == "POST"))
    assert payload["naming_series"] == "FRP-RS-.YYYY.-.######"
    assert payload["custom_client_action_id"] == "FRP:" + send["requestId"]
    assert payload["item_list"][0]["quantity"] == "2.5"
    assert not {"workflow_state", "docstatus", "name", "custom_approved_by", "flags"}.intersection(payload)
    assert db.get(ERPRequisitionSubmission, send["requestId"]).state == "created"


def test_replaying_request_does_not_create_another_erp_record(harness):
    client, state, _, _ = harness
    send = body()
    first = client.post("/api/admin/erp/requisitions", json=send)
    second = client.post("/api/admin/erp/requisitions", json=send)
    assert first.status_code == second.status_code == 201
    assert second.json()["replayed"] is True and state.posts == 1


def test_reusing_id_with_changed_payload_is_rejected(harness):
    client, state, _, _ = harness
    send = body()
    client.post("/api/admin/erp/requisitions", json=send)
    send["notes"] = "Different content"
    assert client.post("/api/admin/erp/requisitions", json=send).status_code == 409
    assert state.posts == 1


def test_create_permission_and_backend_flag_are_both_enforced(harness, monkeypatch):
    client, state, _, _ = harness
    state.create = False
    assert client.post("/api/admin/erp/requisitions", json=body()).status_code == 403
    state.create = True
    monkeypatch.setattr(erp.settings, "erp_requisition_create_enabled", False)
    assert client.post("/api/admin/erp/requisitions", json=body()).status_code == 403
    assert state.posts == 0


@pytest.mark.parametrize("saved", [False, True])
def test_ambiguous_timeout_never_blindly_retries_insert(harness, saved):
    client, state, _, _ = harness
    state.timeout, state.saved_on_timeout = True, saved
    send = body()
    assert client.post("/api/admin/erp/requisitions", json=send).status_code == 504
    retry = client.post("/api/admin/erp/requisitions", json=send)
    assert retry.status_code == (201 if saved else 409)
    assert state.posts == 1
    result = client.get(f"/api/admin/erp/requisitions/submissions/{send['requestId']}")
    assert result.json()["state"] == ("created" if saved else "unconfirmed")


def test_wrong_erp_prefix_is_reported_and_never_reposted(harness):
    client, state, _, _ = harness
    state.returned_name = "RS-2026-000001"
    send = body()
    assert client.post("/api/admin/erp/requisitions", json=send).status_code == 409
    assert client.post("/api/admin/erp/requisitions", json=send).status_code == 409
    assert state.posts == 1


@pytest.mark.parametrize("invalid", [{"naming_series": "ACS-RS-"}, {"workflow_state": "Approved"}, {"approvedBy": "Boss"},
                                    {"costCenter": "   "}, {"items": []}, {"items": [{"name": "Item", "uom": "Nos", "quantity": 0}]}])
def test_invalid_or_forged_creations_never_reach_erp(harness, invalid):
    client, state, _, _ = harness
    assert client.post("/api/admin/erp/requisitions", json={**body(), **invalid}).status_code == 422
    assert state.posts == 0


@pytest.mark.parametrize("key", ["results", "message"])
def test_link_lookup_uses_erp_permissions_and_both_response_formats(harness, key):
    client, state, _, _ = harness
    state.lookup_key = key
    response = client.get("/api/admin/erp/requisitions/lookups/uoms?search=No")
    assert response.json()["options"] == [{"value": "Nos", "label": "Nos", "description": "Unit"}]
    assert state.calls[0].url.params["reference_doctype"] == "Requisition Slip"
    assert "ignore_user_permissions" not in state.calls[0].url.params


def test_submission_status_is_owned_by_its_local_admin(harness):
    client, _, _, app = harness
    send = body()
    client.post("/api/admin/erp/requisitions", json=send)
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(id=2, role="admin")
    assert client.get(f"/api/admin/erp/requisitions/submissions/{send['requestId']}").status_code == 404
