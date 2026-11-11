from app.services import routing

from .test_api import advance, make_rider, order_body, pid, place

MASBATE = (12.3667, 123.6167)
HOME = {"dest_lat": 12.3720, "dest_lng": 123.6300}


def start_delivery(client, customer, admin, **kw):
    rid, rh = make_rider(client, admin)
    o = place(client, customer, **kw)
    client.patch(f"/api/orders/{o['id']}/rider", json={"rider_id": rid}, headers=admin)
    advance(client, admin, o["id"], "Order Confirmed")
    client.post(f"/api/rider/orders/{o['id']}/start", headers=rh)
    return o, rh


def test_pin_is_validated_and_stored(client, customer):
    tube = pid("Ice Tube")
    send = lambda **kw: client.post("/api/orders", headers=customer, json=order_body([{"product_id": tube, "qty": 10}], **kw))
    ok = send(**HOME).json()
    assert ok["dest_lat"] == 12.372 and ok["dest_lng"] == 123.63
    assert send(dest_lat=51.5, dest_lng=-0.12).status_code == 422       # London
    assert send(dest_lat=123.6, dest_lng=12.3).status_code == 422       # lat/lng swapped
    assert send(dest_lat=12.37).status_code == 422                      # only one coordinate
    assert send().json()["dest_lat"] is None                            # the pin is optional
    assert send(mode="pickup", **HOME).json()["dest_lat"] is None       # pickup has nothing to deliver to


def test_address_can_carry_a_pin(client, customer):
    r = client.post("/api/addresses", headers=customer, json={
        "label": "Home", "location": "MASBATE CITY", "address": "Zone 3", "lat": 12.37, "lng": 123.62})
    assert r.status_code == 201 and r.json()["lat"] == 12.37
    bad = client.post("/api/addresses", headers=customer, json={
        "label": "X", "location": "MASBATE CITY", "address": "Zone 3", "lat": 0, "lng": 0})
    assert bad.status_code == 422


def test_track_shows_rider_only_while_out_for_delivery(client, customer, admin):
    rid, rh = make_rider(client, admin)
    o = place(client, customer, **HOME)
    client.patch(f"/api/orders/{o['id']}/rider", json={"rider_id": rid}, headers=admin)
    advance(client, admin, o["id"], "Order Confirmed")
    t = client.get(f"/api/orders/{o['id']}/track", headers=customer).json()
    assert t["dest"] == {"lat": 12.372, "lng": 123.63} and t["rider"] is None and t["route"] is None

    client.post(f"/api/rider/orders/{o['id']}/start", headers=rh)
    assert client.get(f"/api/orders/{o['id']}/track", headers=customer).json()["rider"] is None  # no GPS fix yet
    client.post("/api/rider/location", json={"lat": 12.366712, "lng": 123.616789, "accuracy": 9}, headers=rh)
    t = client.get(f"/api/orders/{o['id']}/track", headers=customer).json()
    assert t["rider"]["name"] == "Rider One" and t["rider"]["stale"] is False
    assert (t["rider"]["lat"], t["rider"]["lng"]) == (12.3667, 123.6168)        # rounded, not the raw fix
    assert t["route"]["source"] == "straight" and t["eta_minutes"] >= 1          # no routing key in tests
    assert len(t["route"]["coords"]) == 2

    client.post(f"/api/rider/orders/{o['id']}/delivered", data={"cash_collected": "true"}, headers=rh)
    t = client.get(f"/api/orders/{o['id']}/track", headers=customer).json()
    assert t["status"] == "Delivered Successfully" and t["rider"] is None and t["route"] is None


def test_track_without_a_pin_still_shows_the_rider(client, customer, admin):
    o, rh = start_delivery(client, customer, admin)
    client.post("/api/rider/location", json={"lat": 12.37, "lng": 123.62}, headers=rh)
    t = client.get(f"/api/orders/{o['id']}/track", headers=customer).json()
    assert t["dest"] is None and t["rider"] and t["route"] is None and t["eta_minutes"] is None


def test_track_is_private(client, customer, admin):
    o, rh = start_delivery(client, customer, admin, **HOME)
    other = client.post("/api/auth/register", json={"name": "Other", "email": "o@example.com",
                                                     "password": "Password123", "phone": "09170000000"}).json()
    h2 = {"Authorization": "Bearer " + other["access_token"]}
    assert client.get(f"/api/orders/{o['id']}/track", headers=h2).status_code == 404
    assert client.get(f"/api/orders/{o['id']}/track", headers=rh).status_code == 404
    assert client.get(f"/api/orders/{o['id']}/track", headers=admin).status_code == 200
    assert client.get(f"/api/orders/{o['id']}/track").status_code == 401


def test_rider_sees_destination_pin(client, customer, admin):
    o, rh = start_delivery(client, customer, admin, **HOME)
    job = client.get("/api/rider/orders", headers=rh).json()[0]
    assert (job["dest_lat"], job["dest_lng"]) == (12.372, 123.63)


class FakeOrs:
    def __init__(self):
        self.calls = 0

    def __call__(self, origin, dest):
        self.calls += 1
        return {"coords": [[origin[1], origin[0]], [dest[1], dest[0]]], "distance_m": 2000, "duration_s": 600, "source": "road"}


def test_route_is_reused_until_the_rider_moves_far(monkeypatch):
    routing._cache.clear()
    fake = FakeOrs()
    monkeypatch.setattr(routing, "fetch_ors", fake)
    dest = (12.38, 123.63)
    routing.get_route(1, MASBATE, dest)
    routing.get_route(1, (MASBATE[0] + 0.0005, MASBATE[1]), dest)   # about 55 m
    assert fake.calls == 1
    routing.get_route(1, (MASBATE[0] + 0.004, MASBATE[1]), dest)    # about 440 m
    assert fake.calls == 2
    routing.get_route(2, MASBATE, dest)                              # a different order has its own route
    assert fake.calls == 3


def test_routing_failure_falls_back_to_a_straight_line(monkeypatch):
    routing._cache.clear()
    fake = FakeOrs()
    monkeypatch.setattr(routing, "fetch_ors", lambda o, d: (fake.__setattr__("calls", fake.calls + 1), None)[1])
    r = routing.get_route(7, MASBATE, (12.38, 123.63))
    assert r["source"] == "straight" and r["distance_m"] > 0
    routing.get_route(7, MASBATE, (12.38, 123.63))
    assert fake.calls == 1  # does not hammer the service after a failure


def test_haversine_is_about_right():
    # one degree of latitude is roughly 111 km
    assert 110_000 < routing.haversine_m((12.0, 123.0), (13.0, 123.0)) < 112_000
