"""Road route and ETA from the rider's position to the customer's pin.

OpenRouteService's free plan allows 2,000 directions a day, so a route is fetched server-side and reused until the
rider has moved a fair distance (or it gets old). Without an API key, or when the service fails, we fall back to a
straight line and a rough ETA so the customer still sees the rider and a time.
"""
import math
import time

import httpx

from ..config import settings

ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
MOVE_M = 300           # fetch a new route once the rider has moved this far from where the last one started
MAX_AGE_S = 300        # ...or when it is this old
RETRY_AFTER_FAIL_S = 120
ROAD_FACTOR = 1.35     # straight-line distance to real road distance, rough
SPEED_MS = 25 / 3.6    # 25 km/h average through town, used only for the fallback ETA

_cache: dict[int, dict] = {}

LatLng = tuple[float, float]


def haversine_m(a: LatLng, b: LatLng) -> float:
    r = 6_371_000
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def straight_route(origin: LatLng, dest: LatLng) -> dict:
    dist = haversine_m(origin, dest) * ROAD_FACTOR
    return {"coords": [[origin[1], origin[0]], [dest[1], dest[0]]], "distance_m": dist,
            "duration_s": dist / SPEED_MS, "source": "straight"}


def fetch_ors(origin: LatLng, dest: LatLng) -> dict | None:
    if not settings.ors_api_key:
        return None
    try:
        r = httpx.post(ORS_URL, headers={"Authorization": settings.ors_api_key},
                       json={"coordinates": [[origin[1], origin[0]], [dest[1], dest[0]]]}, timeout=4)
        r.raise_for_status()
        feat = r.json()["features"][0]
        summary = feat["properties"]["summary"]
        return {"coords": feat["geometry"]["coordinates"], "distance_m": summary["distance"],
                "duration_s": summary["duration"], "source": "road"}
    except Exception:  # network, quota, bad key, odd payload: never break tracking over a route
        return None


def get_route(order_id: int, origin: LatLng, dest: LatLng) -> dict:
    now = time.monotonic()
    c = _cache.get(order_id)
    if c and now < c["valid_until"] and haversine_m(c["origin"], origin) < MOVE_M:
        if c["route"]["source"] == "straight":
            return straight_route(origin, dest)  # cheap, so keep it tied to the live position
        left = max(60.0, c["route"]["duration_s"] - (now - c["at"]))
        return {**c["route"], "duration_s": left}
    route = fetch_ors(origin, dest)
    if route:
        _cache[order_id] = {"origin": origin, "at": now, "valid_until": now + MAX_AGE_S, "route": route}
        return route
    _cache[order_id] = {"origin": origin, "at": now, "valid_until": now + RETRY_AFTER_FAIL_S,
                        "route": straight_route(origin, dest)}
    return straight_route(origin, dest)


def forget(order_id: int):
    _cache.pop(order_id, None)
