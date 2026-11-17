"""Contract tests using a fake ERP transport; never connect to ERP or a database."""
import json
from copy import deepcopy
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.deps import current_user
from app.routers.erp import router
from app.services import erp

REAL_CLIENT = httpx.Client
REFERENCE = "ACS-RS-2026-000001"
DOC = {
    "name": REFERENCE, "workflow_state": "Pending", "modified": "2026-11-16 09:00:00.000001",
    "docstatus": 0, "cost_center": "Test Center", "project": "PR-TEST", "with_mr": 1,
    "requested_by": "Example", "date": "2026-11-16", "internal_notes": "Original",
    "item_list": [{"name": "item-1", "item_name": "Test Item", "uom": "Nos", "quantity": "2",
                   "amount": 150, "attach_image": "/private/files/test.png", "item_type": "Item",
                   "item_or_expense": "TEST-ITEM", "for": "Purchase Order", "particulars": "Keep this"}],
}


@pytest.fixture
def harness(monkeypatch):
    monkeypatch.setattr(erp.settings, "erp_base_url", "https://erp.example.com")
    monkeypatch.setattr(erp.settings, "erp_api_key", SecretStr("test-key"))
    monkeypatch.setattr(erp.settings, "erp_api_secret", SecretStr("test-secret"))
    monkeypatch.setattr(erp.settings, "erp_requisition_prefix", "ACS-RS-")
    monkeypatch.setattr(erp.settings, "erp_requisition_writes_enabled", False)
    state = SimpleNamespace(calls=[], doc=deepcopy(DOC), write=False, handler=None)

    def handle(request):
        state.calls.append(request)
        if state.handler:
            return state.handler(request)
        if request.url.path.endswith("get_docinfo"):
            return httpx.Response(200, json={"docinfo": {"permissions": {"read": 1, "write": int(state.write)}}})
        if request.method == "PUT":
            changes = json.loads(request.content)
            state.doc.update(changes)
            state.doc["modified"] = "2026-11-16 09:01:00.000001"
            return httpx.Response(200, json={"data": state.doc})
        if request.url.path.endswith(REFERENCE):
            return httpx.Response(200, json={"data": state.doc})
        fields = json.loads(request.url.params.get("fields", "[]"))
        if fields == ["count(name) as total"]:
            return httpx.Response(200, json={"data": [{"total": 1}]})
        if request.url.params.get("group_by"):
            return httpx.Response(200, json={"data": [{"workflow_state": "Pending", "total": 15}]})
        return httpx.Response(200, json={"data": [state.doc]})

    monkeypatch.setattr(erp.httpx, "Client", lambda **kw: REAL_CLIENT(**kw, transport=httpx.MockTransport(handle)))
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(role="admin")
    with TestClient(app) as client:
        yield client, state, app


def test_admin_only(harness):
    client, state, app = harness
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(role="customer")
    assert client.get("/api/admin/erp/requisitions").status_code == 403
    assert not state.calls


def test_list_scopes_filters_search_and_counts_consistently(harness):
    client, state, _ = harness
    response = client.get("/api/admin/erp/requisitions", params=[("search", "PR-TEST"), ("status", "Pending"),
                          ("status", "For MR/DPO"), ("with_mr", "true"), ("page", "2")])
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["total"] == 1 and body["records"][0]["withMR"] is True
    data, count = state.calls
    assert json.loads(data.url.params["filters"]) == [["name", "like", "ACS-RS-%"],
            ["workflow_state", "in", ["Pending", "For MR/DPO"]], ["with_mr", "=", 1]]
    assert data.url.params["limit_start"] == "25"
    for key in ("filters", "or_filters"):
        assert data.url.params[key] == count.url.params[key]
    assert "test-secret" not in response.text and "test-key" not in response.text


def test_detail_maps_actual_schema_and_preserves_review_fields(harness):
    client, _, _ = harness
    response = client.get(f"/api/admin/erp/requisitions/{REFERENCE}")
    body = response.json()
    assert response.status_code == 200 and not body["canEdit"]
    assert body["projectName"] == "PR-TEST" and body["notes"] == "Original"
    assert body["items"][0]["amount"] == 150 and body["items"][0]["attachment"] is True
    assert "/private/files/" not in response.text


def test_summary_uses_erp_grouped_counts(harness):
    client, _, _ = harness
    assert client.get("/api/admin/erp/requisitions/summary").json()["byStatus"] == {"Pending": 15}


def test_out_of_scope_records_never_reach_erp(harness):
    client, state, _ = harness
    assert client.get("/api/admin/erp/requisitions/OTHER-0001").status_code == 404
    assert not state.calls


def test_blank_prefix_includes_all_companies_in_lists_counts_and_details(harness, monkeypatch):
    client, state, _ = harness
    monkeypatch.setattr(erp.settings, "erp_requisition_prefix", "")
    response = client.get("/api/admin/erp/requisitions")
    assert response.status_code == 200 and response.json()["prefix"] == ""
    assert all(json.loads(call.url.params["filters"]) == [] for call in state.calls)
    state.calls.clear()
    assert client.get("/api/admin/erp/requisitions/summary").status_code == 200
    assert json.loads(state.calls[0].url.params["filters"]) == []
    state.calls.clear()
    # A different company's reference reaches ERP instead of being rejected locally.
    state.handler = lambda req: httpx.Response(200, json={"data": {**DOC, "name": "RS-2026-000001"}})
    with erp.ERPClient() as adapter:
        assert adapter.raw_record("RS-2026-000001")["name"] == "RS-2026-000001"
    assert state.calls[0].url.path.endswith("/RS-2026-000001")


def test_writes_disabled_without_any_upstream_request(harness):
    client, state, _ = harness
    response = client.patch(f"/api/admin/erp/requisitions/{REFERENCE}", json={"modified": DOC["modified"], "notes": "Updated"})
    assert response.status_code == 403 and not state.calls


def test_requires_erp_write_permission_even_when_enabled(harness, monkeypatch):
    client, state, _ = harness
    monkeypatch.setattr(erp.settings, "erp_requisition_writes_enabled", True)
    assert client.patch(f"/api/admin/erp/requisitions/{REFERENCE}", json={"modified": DOC["modified"]}).status_code == 403
    assert all(call.method == "GET" for call in state.calls)


def test_stale_edit_is_rejected_before_write(harness, monkeypatch):
    client, state, _ = harness
    state.write = True
    monkeypatch.setattr(erp.settings, "erp_requisition_writes_enabled", True)
    assert client.patch(f"/api/admin/erp/requisitions/{REFERENCE}", json={"modified": "old", "notes": "Updated"}).status_code == 409
    assert all(call.method == "GET" for call in state.calls)


def test_save_preserves_unexposed_child_fields_and_passes_timestamp(harness, monkeypatch):
    client, state, _ = harness
    state.write = True
    monkeypatch.setattr(erp.settings, "erp_requisition_writes_enabled", True)
    response = client.patch(f"/api/admin/erp/requisitions/{REFERENCE}", json={"modified": DOC["modified"],
        "notes": "Updated", "items": [{"id": "item-1", "name": "Updated item", "uom": "Nos", "quantity": "3"}]})
    assert response.status_code == 200 and response.json()["notes"] == "Updated"
    payload = json.loads(next(call.content for call in state.calls if call.method == "PUT"))
    assert payload["modified"] == DOC["modified"]
    assert payload["item_list"][0]["amount"] == 150
    assert payload["item_list"][0]["attach_image"] == "/private/files/test.png"
    assert payload["item_list"][0]["item_or_expense"] == "TEST-ITEM"
    assert "workflow_state" not in payload and "custom_approved_by" not in payload


@pytest.mark.parametrize("extra", [{"workflow_state": "Approved"}, {"approvedBy": "Someone"}, {"docstatus": 1}])
def test_rejects_workflow_and_approval_changes(harness, extra):
    client, state, _ = harness
    assert client.patch(f"/api/admin/erp/requisitions/{REFERENCE}", json={"modified": DOC["modified"], **extra}).status_code == 422
    assert not state.calls


def test_cannot_remove_item_rows(harness, monkeypatch):
    client, state, _ = harness
    state.write = True
    monkeypatch.setattr(erp.settings, "erp_requisition_writes_enabled", True)
    assert client.patch(f"/api/admin/erp/requisitions/{REFERENCE}", json={"modified": DOC["modified"], "items": []}).status_code == 422
    assert all(call.method == "GET" for call in state.calls)


def test_clear_optional_dates_and_reject_submitted_edits(harness, monkeypatch):
    client, state, _ = harness
    state.write = True
    monkeypatch.setattr(erp.settings, "erp_requisition_writes_enabled", True)
    response = client.patch(f"/api/admin/erp/requisitions/{REFERENCE}",
                            json={"modified": DOC["modified"], "date": "", "requiredDate": ""})
    assert response.status_code == 200
    payload = json.loads(next(call.content for call in state.calls if call.method == "PUT"))
    assert payload["date"] is None and payload["delivery_date"] is None
    state.calls.clear()
    state.doc["docstatus"] = 1
    response = client.patch(f"/api/admin/erp/requisitions/{REFERENCE}", json={"modified": state.doc["modified"]})
    assert response.status_code == 403 and all(call.method == "GET" for call in state.calls)


def test_missing_credentials_fail_without_upstream_request(harness, monkeypatch):
    client, state, _ = harness
    monkeypatch.setattr(erp.settings, "erp_api_secret", SecretStr(""))
    assert client.get("/api/admin/erp/requisitions").status_code == 503
    assert not state.calls


@pytest.mark.parametrize("status,expected", [(401, 502), (403, 403), (429, 503), (500, 502)])
def test_upstream_errors_are_sanitized(harness, status, expected):
    client, state, _ = harness
    state.handler = lambda req: httpx.Response(status, json={"exc": "Private ERP traceback test-secret"})
    response = client.get("/api/admin/erp/requisitions")
    assert response.status_code == expected
    assert "test-secret" not in response.text and "traceback" not in response.text


def test_timeout_has_actionable_error(harness):
    client, state, _ = harness
    def timeout(req):
        raise httpx.ReadTimeout("Private request details", request=req)
    state.handler = timeout
    response = client.get("/api/admin/erp/requisitions")
    assert response.status_code == 504 and "Private" not in response.text
