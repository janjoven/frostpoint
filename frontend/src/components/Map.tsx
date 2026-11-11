import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_CENTER, MAP_STYLE } from "../lib/mapConfig";
import { osmLink } from "../lib/track";

export type LngLat = { lat: number; lng: number };
type Props = {
  dest?: LngLat | null;      // where the order is going
  rider?: LngLat | null;     // live rider position
  route?: number[][] | null; // [lng, lat] pairs
  pin?: LngLat | null;       // the customer's chosen spot (picker mode)
  onPick?: (p: LngLat) => void; // set to make the map a picker: tap or drag the pin
  height?: number;
  label: string;
};

const PIN_SVG = '<svg viewBox="0 0 24 32" width="28" height="36" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="#dc2626"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>';
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const div = (cls: string, html = "") => { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; return d; };
const line = (coordinates: number[][]): GeoJSON.Feature<GeoJSON.LineString> => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } });

export default function MapView({ dest, rider, route, pin, onPick, height = 280, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marks = useRef<Record<string, maplibregl.Marker>>({});
  const loaded = useRef(false);
  const fitted = useRef("");
  const latest = useRef({ dest, rider, route, pin, onPick });
  latest.current = { dest, rider, route, pin, onPick };
  const [failed, setFailed] = useState(false);

  function place(name: string, at: LngLat | null | undefined, make: () => HTMLElement, opts: maplibregl.MarkerOptions) {
    const cur = marks.current[name];
    if (!at) { cur?.remove(); delete marks.current[name]; return; }
    if (cur) { cur.setLngLat([at.lng, at.lat]); return; }
    const mk = new maplibregl.Marker({ element: make(), ...opts }).setLngLat([at.lng, at.lat]).addTo(map.current!);
    if (opts.draggable) mk.on("dragend", () => { const p = mk.getLngLat(); latest.current.onPick?.({ lat: p.lat, lng: p.lng }); });
    marks.current[name] = mk;
  }

  function sync() {
    const m = map.current;
    if (!m) return;
    const { dest, rider, route, pin, onPick } = latest.current;
    place("dest", dest, () => div("map-pin", PIN_SVG), { anchor: "bottom" });
    place("rider", rider, () => div("map-rider", "<span></span>"), { anchor: "center" });
    place("pin", pin, () => div("map-pin", PIN_SVG), { anchor: "bottom", draggable: !!onPick });
    if (loaded.current) (m.getSource("route") as maplibregl.GeoJSONSource | undefined)?.setData(line(route ?? []));

    // Frame what matters, but only when the set of things changes or one of them leaves the view, so panning sticks.
    const pts = [pin, dest, rider].filter(Boolean) as LngLat[];
    if (!pts.length) return;
    const key = `${!!pin}${!!dest}${!!rider}`;
    const view = m.getBounds();
    const outside = pts.some((p) => !view.contains([p.lng, p.lat]));
    if (fitted.current === key && !outside) return;
    fitted.current = key;
    if (pts.length === 1) { m.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: Math.max(m.getZoom(), 15), animate: !reduced() }); return; }
    const b = new maplibregl.LngLatBounds();
    pts.forEach((p) => b.extend([p.lng, p.lat]));
    m.fitBounds(b, { padding: 60, maxZoom: 16, animate: !reduced() });
  }

  useEffect(() => {
    if (!box.current) return;
    const start = latest.current.pin ?? latest.current.dest ?? latest.current.rider ?? DEFAULT_CENTER;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({ container: box.current, style: MAP_STYLE, center: [start.lng, start.lat], zoom: 14, attributionControl: { compact: true } });
    } catch {
      setFailed(true);
      return;
    }
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      loaded.current = true;
      m.addSource("route", { type: "geojson", data: line([]) });
      m.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9 } });
      m.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0369a1", "line-width": 5 } });
      sync();
    });
    m.on("error", () => { if (!loaded.current) setFailed(true); });
    m.on("click", (e) => latest.current.onPick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    sync();
    return () => { m.remove(); map.current = null; loaded.current = false; marks.current = {}; fitted.current = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(sync, [dest?.lat, dest?.lng, rider?.lat, rider?.lng, pin?.lat, pin?.lng, route, !!onPick]); // eslint-disable-line react-hooks/exhaustive-deps

  const focus = pin ?? dest ?? rider;
  if (failed) {
    return (
      <div className="map-box map-fallback" style={{ minHeight: 120 }} role="status">
        <p>The map could not load. Check your connection.</p>
        {focus && <a href={osmLink(focus)} target="_blank" rel="noreferrer">Open this spot in OpenStreetMap</a>}
      </div>
    );
  }
  return <div ref={box} className="map-box" style={{ height }} role="region" aria-label={label} />;
}
