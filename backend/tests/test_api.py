from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import select

from app import models
from app.db import SessionLocal


def pid(name):
    with SessionLocal() as db:
        return db.scalar(select(models.Product).where(models.Product.name == name)).id


def order_body(items, **kw):
    return {"items": items, "mode": "delivery", "location": "MASBATE CITY", "receiver_name": "Test Cust",
            "phone": "09171234567", **kw}


def test_phone_normalised(client, customer):
    assert client.get("/api/auth/me", headers=customer).json()["phone"] == "09171234567"


def test_quote_matrix(client):
    tube, block = pid("Ice Tube"), pid("Ice Block")
    q = lambda items, **kw: client.post("/api/quote", json={"items": items, "mode": "delivery",
                                                             "location": "MASBATE CITY", **kw}).json()
    assert q([{"product_id": tube, "qty": 10}])["delivery_fee"] == "12.00"
    assert q([{"product_id": block, "qty": 3}])["delivery_fee"] == "150.00"  # 50 x 3 pieces
    assert q([{"product_id": tube, "qty": 10}], mode="pickup")["delivery_fee"] == "0.00"
    assert q([{"product_id": tube, "qty": 10}], location="NOWHERE")["delivery_fee"] == "50.00"  # default fee


def test_client_cannot_set_prices(client, customer):
    tube = pid("Ice Tube")
    body = order_body([{"product_id": tube, "qty": 10}], total=1, delivery_fee=0)
    o = client.post("/api/orders", json=body, headers=customer).json()
    assert o["total"] == "112.00"


def test_customer_blocked_from_admin(client, customer, admin):
    assert client.get("/api/admin/stats", headers=customer).status_code == 403
    assert client.get("/api/orders", headers=customer).status_code == 403
    tube = pid("Ice Tube")
    oid = client.post("/api/orders", json=order_body([{"product_id": tube, "qty": 10}]), headers=customer).json()["id"]
    other = client.post("/api/auth/register", json={"name": "Other", "email": "o@example.com",
                                                     "password": "Password123", "phone": "09170000000"}).json()
    h2 = {"Authorization": "Bearer " + other["access_token"]}
    assert client.get(f"/api/orders/{oid}", headers=h2).status_code == 404
    assert client.get(f"/api/orders/{oid}", headers=admin).status_code == 200


def test_cannot_self_promote(client, customer):
    r = client.patch("/api/auth/me", json={"role": "admin"}, headers=customer)
    assert client.get("/api/auth/me", headers=customer).json()["role"] == "customer"
    assert r.status_code == 200


def test_status_transitions_and_cancel_restores_stock(client, customer, admin):
    tube = pid("Ice Tube")
    oid = client.post("/api/orders", json=order_body([{"product_id": tube, "qty": 100}]), headers=customer).json()["id"]
    stock = lambda: next(p["stock"] for p in client.get("/api/products").json() if p["id"] == tube)
    assert stock() == 700
    bad = client.patch(f"/api/orders/{oid}/status", json={"status": "Out for Delivery"}, headers=admin)
    assert bad.status_code == 400  # must be confirmed first
    assert client.patch(f"/api/orders/{oid}/status", json={"status": "Cancelled"}, headers=admin).status_code == 400
    ok = client.patch(f"/api/orders/{oid}/status", json={"status": "Cancelled", "reason": "no"}, headers=admin)
    assert ok.status_code == 200 and stock() == 800
    assert client.patch(f"/api/orders/{oid}/status", json={"status": "Out for Delivery"},
                        headers=admin).status_code == 400


def test_order_events_record_each_step(client, customer, admin):
    tube = pid("Ice Tube")
    o = client.post("/api/orders", json=order_body([{"product_id": tube, "qty": 10}]), headers=customer).json()
    assert o["status"] == "Order Placed"
    assert [e["status"] for e in o["events"]] == ["Order Placed"]
    for st in ("Order Confirmed", "Preparing", "Out for Delivery", "Delivered Successfully"):
        assert client.patch(f"/api/orders/{o['id']}/status", json={"status": st}, headers=admin).status_code == 200
    mine = client.get("/api/orders/mine", headers=customer).json()[0]
    assert [e["status"] for e in mine["events"]] == [
        "Order Placed", "Order Confirmed", "Preparing", "Out for Delivery", "Delivered Successfully"]


def test_payment_status_flow(client, customer, admin):
    tube = pid("Ice Tube")
    cod = client.post("/api/orders", json=order_body([{"product_id": tube, "qty": 10}]), headers=customer).json()
    assert cod["payment_status"] == "cod_due"
    for st in ("Order Confirmed", "Out for Delivery", "Delivered Successfully"):
        client.patch(f"/api/orders/{cod['id']}/status", json={"status": st}, headers=admin)
    assert client.get(f"/api/orders/{cod['id']}", headers=customer).json()["payment_status"] == "paid"

    gc = client.post("/api/orders", json=order_body([{"product_id": tube, "qty": 10}], payment_method="GCash"),
                     headers=customer).json()
    assert gc["payment_status"] == "unpaid"
    png = {"file": ("x.png", b"\x89PNG\r\n" + b"0" * 20)}
    assert client.post(f"/api/orders/{gc['id']}/proof", files=png, headers=customer).status_code == 204
    assert client.get(f"/api/orders/{gc['id']}", headers=customer).json()["payment_status"] == "proof_sent"
    assert client.patch(f"/api/orders/{gc['id']}/payment", json={"payment_status": "paid"}, headers=customer).status_code == 403
    ok = client.patch(f"/api/orders/{gc['id']}/payment", json={"payment_status": "paid"}, headers=admin)
    assert ok.status_code == 200 and ok.json()["payment_status"] == "paid"
    assert client.patch(f"/api/orders/{gc['id']}/payment", json={"payment_status": "proof_sent"},
                        headers=admin).status_code == 400


def test_saved_addresses(client, customer):
    add = lambda **kw: client.post("/api/addresses", headers=customer, json={
        "label": "Home", "location": "masbate city", "address": "Zone 3", **kw})
    first = add()
    assert first.status_code == 201 and first.json()["location"] == "MASBATE CITY"
    assert first.json()["is_default"] is True  # first address becomes the default
    second = add(label="Shop", is_default=True).json()
    listed = client.get("/api/addresses", headers=customer).json()
    assert [a["label"] for a in listed] == ["Shop", "Home"] and listed[0]["is_default"]
    assert add(location="NOWHERE").status_code == 400
    # deleting the default promotes the next one
    assert client.delete(f"/api/addresses/{second['id']}", headers=customer).status_code == 204
    assert client.get("/api/addresses", headers=customer).json()[0]["is_default"] is True
    for i in range(4):
        add(label=f"A{i}")
    assert add(label="one too many").status_code == 400


def test_addresses_are_private(client, customer):
    a = client.post("/api/addresses", headers=customer, json={
        "label": "Home", "location": "MOBO", "address": "Zone 1"}).json()
    other = client.post("/api/auth/register", json={"name": "Other", "email": "o@example.com",
                                                     "password": "Password123", "phone": "09170000000"}).json()
    h2 = {"Authorization": "Bearer " + other["access_token"]}
    assert client.get("/api/addresses", headers=h2).json() == []
    assert client.delete(f"/api/addresses/{a['id']}", headers=h2).status_code == 404
    assert client.patch(f"/api/addresses/{a['id']}/default", headers=h2).status_code == 404
    assert client.get("/api/addresses").status_code == 401


def make_rider(client, admin, email="r@example.com"):
    r = client.post("/api/admin/team", headers=admin, json={
        "name": "Rider One", "email": email, "password": "Password123", "role": "rider"})
    assert r.status_code == 201, r.text
    tok = client.post("/api/auth/login", json={"email": email, "password": "Password123"}).json()["access_token"]
    return r.json()["id"], {"Authorization": "Bearer " + tok}


def place(client, customer, payment_method="COD", **kw):
    body = order_body([{"product_id": pid("Ice Tube"), "qty": 10}], payment_method=payment_method, **kw)
    return client.post("/api/orders", json=body, headers=customer).json()


def advance(client, admin, oid, *statuses):
    for st in statuses:
        assert client.patch(f"/api/orders/{oid}/status", json={"status": st}, headers=admin).status_code == 200


def test_rider_assignment_rules(client, customer, admin):
    rid, _ = make_rider(client, admin)
    o = place(client, customer)
    assign = lambda oid, rider_id: client.patch(f"/api/orders/{oid}/rider", json={"rider_id": rider_id}, headers=admin)
    ok = assign(o["id"], rid)
    assert ok.status_code == 200 and ok.json()["rider_name"] == "Rider One"
    assert assign(o["id"], 1).status_code == 400  # account 1 is the admin, not a rider
    assert assign(o["id"], None).json()["rider_id"] is None
    pickup = place(client, customer, mode="pickup")
    assert assign(pickup["id"], rid).status_code == 400
    assert client.get("/api/riders", headers=admin).json()[0]["id"] == rid
    assert client.get("/api/riders", headers=customer).status_code == 403
    assert client.patch(f"/api/orders/{o['id']}/rider", json={"rider_id": rid}, headers=customer).status_code == 403


def test_rider_cannot_use_customer_or_staff_endpoints(client, customer, admin):
    rid, rh = make_rider(client, admin)
    o = place(client, customer)
    client.patch(f"/api/orders/{o['id']}/rider", json={"rider_id": rid}, headers=admin)
    assert client.get(f"/api/orders/{o['id']}", headers=rh).status_code == 404  # even when assigned
    assert client.get(f"/api/orders/{o['id']}/proof", headers=rh).status_code == 404
    assert client.get("/api/orders", headers=rh).status_code == 403
    assert client.get("/api/admin/stats", headers=rh).status_code == 403
    assert "bank_details" in client.get("/api/settings", headers=rh).json()
    assert "default_delivery_fee" not in client.get("/api/settings", headers=rh).json()
    assert client.get("/api/rider/orders", headers=customer).status_code == 403


def test_rider_delivery_flow_cod(client, customer, admin):
    rid, rh = make_rider(client, admin)
    o = place(client, customer)
    client.patch(f"/api/orders/{o['id']}/rider", json={"rider_id": rid}, headers=admin)
    assert client.get("/api/rider/orders", headers=rh).json() == []  # not confirmed yet
    assert client.post(f"/api/rider/orders/{o['id']}/start", headers=rh).status_code == 400
    advance(client, admin, o["id"], "Order Confirmed")
    listed = client.get("/api/rider/orders", headers=rh).json()
    assert [x["id"] for x in listed] == [o["id"]] and listed[0]["cash_to_collect"] == "112.00"
    assert "price" not in listed[0]["items"][0]
    assert client.post("/api/rider/location", json={"lat": 12.37, "lng": 123.62}, headers=rh).status_code == 409
    assert client.post(f"/api/rider/orders/{o['id']}/accept", headers=rh).json()["accepted_at"]
    assert client.post(f"/api/rider/orders/{o['id']}/start", headers=rh).json()["status"] == "Out for Delivery"
    for acc in (12.0, 8.0):
        assert client.post("/api/rider/location", json={"lat": 12.37, "lng": 123.62, "accuracy": acc}, headers=rh).status_code == 204
    assert client.post("/api/rider/location", json={"lat": 99, "lng": 0}, headers=rh).status_code == 422
    # cash must be confirmed before a COD delivery can be closed
    assert client.post(f"/api/rider/orders/{o['id']}/delivered", headers=rh).status_code == 400
    png = {"file": ("d.png", b"\x89PNG\r\n" + b"0" * 20)}
    ok = client.post(f"/api/rider/orders/{o['id']}/delivered", data={"cash_collected": "true"}, files=png, headers=rh)
    assert ok.status_code == 200 and ok.json()["status"] == "Delivered Successfully"
    mine = client.get(f"/api/orders/{o['id']}", headers=customer).json()
    assert mine["payment_status"] == "paid" and mine["has_delivery_proof"]
    assert [e["status"] for e in mine["events"]][-2:] == ["Out for Delivery", "Delivered Successfully"]
    assert client.get(f"/api/orders/{o['id']}/delivery-proof", headers=customer).status_code == 200
    # location is dropped once the rider has nothing in progress
    assert client.post("/api/rider/location", json={"lat": 12.37, "lng": 123.62}, headers=rh).status_code == 409
    with SessionLocal() as db:
        assert db.get(models.RiderLocation, rid) is None


def test_rider_isolation_and_photo_rules(client, customer, admin):
    rid, rh = make_rider(client, admin)
    _, other = make_rider(client, admin, "r2@example.com")
    o = place(client, customer, payment_method="GCash")
    client.patch(f"/api/orders/{o['id']}/rider", json={"rider_id": rid}, headers=admin)
    advance(client, admin, o["id"], "Order Confirmed")
    assert client.post(f"/api/rider/orders/{o['id']}/start", headers=other).status_code == 404
    assert client.post(f"/api/rider/orders/{o['id']}/start", headers=rh).status_code == 200
    pdf = {"file": ("d.pdf", b"%PDF-1.4 hello")}
    assert client.post(f"/api/rider/orders/{o['id']}/delivered", files=pdf, headers=rh).status_code == 415
    # e-wallet order: no cash to confirm, photo is optional
    done = client.post(f"/api/rider/orders/{o['id']}/delivered", headers=rh)
    assert done.status_code == 200 and done.json()["cash_to_collect"] == "0"
    assert client.get(f"/api/orders/{o['id']}/delivery-proof", headers=customer).status_code == 404


def test_location_released_when_order_cancelled_or_reassigned(client, customer, admin):
    rid, rh = make_rider(client, admin)
    rid2, _ = make_rider(client, admin, "r2@example.com")
    o = place(client, customer)
    client.patch(f"/api/orders/{o['id']}/rider", json={"rider_id": rid}, headers=admin)
    advance(client, admin, o["id"], "Order Confirmed")
    client.post(f"/api/rider/orders/{o['id']}/start", headers=rh)
    client.post("/api/rider/location", json={"lat": 12.37, "lng": 123.62}, headers=rh)
    with SessionLocal() as db:
        assert db.get(models.RiderLocation, rid) is not None
    client.patch(f"/api/orders/{o['id']}/rider", json={"rider_id": rid2}, headers=admin)  # reassigned away
    with SessionLocal() as db:
        assert db.get(models.RiderLocation, rid) is None


def test_no_oversell_under_concurrency(client, customer):
    block = pid("Ice Block")
    with SessionLocal() as db:
        db.get(models.Product, block).stock = 5
        db.commit()

    def buy(_):
        return client.post("/api/orders", json=order_body([{"product_id": block, "qty": 1}]), headers=customer).status_code

    with ThreadPoolExecutor(10) as ex:
        codes = list(ex.map(buy, range(10)))
    assert codes.count(201) == 5 and codes.count(409) == 5


def test_proof_rejects_bad_files(client, customer):
    tube = pid("Ice Tube")
    oid = client.post("/api/orders", json=order_body([{"product_id": tube, "qty": 10}]), headers=customer).json()["id"]
    bad = client.post(f"/api/orders/{oid}/proof", files={"file": ("x.png", b"not an image")}, headers=customer)
    assert bad.status_code == 415
    good = client.post(f"/api/orders/{oid}/proof", files={"file": ("x.png", b"\x89PNG\r\n" + b"0" * 20)}, headers=customer)
    assert good.status_code == 204
