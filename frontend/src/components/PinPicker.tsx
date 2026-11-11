import { Crosshair, MapPin, X } from "@phosphor-icons/react";
import { Suspense, lazy, useState } from "react";
import { PH_BOUNDS } from "../lib/pin";
import type { LngLat } from "./Map";
import { Skeleton } from "./ui";

const MapView = lazy(() => import("./Map"));

/** Lets the customer drop a pin on their door: current GPS position, or tap/drag on the map. */
export function PinPicker({ value, onChange, compact = false }: { value: LngLat | null; onChange: (p: LngLat | null) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) { setMsg("This browser cannot share your location. Choose a spot on the map instead."); setOpen(true); return; }
    setBusy(true); setMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false); setOpen(true);
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMsg(pos.coords.accuracy > 100 ? `Your location is rough (about ${Math.round(pos.coords.accuracy)} m). Drag the pin to your door.` : "Pin placed. Drag it if it is slightly off.");
      },
      (err) => { setBusy(false); setOpen(true); setMsg(err.code === err.PERMISSION_DENIED ? "Location is blocked for this site. Choose your spot on the map instead." : "Could not get your location. Choose your spot on the map instead."); },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }
  const pick = (p: LngLat) => {
    if (!PH_BOUNDS(p)) { setMsg("That spot is outside the Philippines. Try again."); return; }
    setMsg(""); onChange(p);
  };

  return (
    <div className={`stack pin-picker${compact ? " pin-picker-compact" : ""}`} style={{ gap: 8 }}>
      <div className="stack" style={{ gap: 2 }}>
        <div className="pin-picker-heading"><strong>Pin your location <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></strong>{compact && value && <button type="button" className="btn ghost icon" aria-label="Remove delivery pin" title="Remove pin" onClick={() => { onChange(null); setMsg(""); }}><X size={16} aria-hidden="true" /></button>}</div>
        <small className="muted">{compact ? value ? "Pin saved. You can adjust it on the map." : "Help your rider find your address." : "Helps the rider find you and lets you follow your delivery on a map."}</small>
      </div>
      <div className="row pin-picker-actions">
        <button type="button" className="btn sm" onClick={useMyLocation} disabled={busy}><Crosshair size={18} aria-hidden="true" /> {busy ? "Locating…" : "Use my current location"}</button>
        {compact ? <button type="button" className="btn sm" aria-expanded={open} onClick={() => setOpen(!open)}><MapPin size={18} aria-hidden="true" />{open ? "Hide map" : value ? "View / adjust pin" : "Choose on map"}</button> : !open && !value && <button type="button" className="btn sm" onClick={() => setOpen(true)}><MapPin size={18} aria-hidden="true" /> Choose on map</button>}
        {!compact && value && <button type="button" className="btn sm ghost" onClick={() => { onChange(null); setMsg(""); }}><X size={16} aria-hidden="true" /> Remove pin</button>}
      </div>
      {(open || (!compact && value)) && (
        <Suspense fallback={<Skeleton h={compact ? 180 : 240} />}>
          <MapView pin={value} onPick={pick} height={compact ? 180 : 240} label="Map. Tap to place your delivery pin." />
        </Suspense>
      )}
      <small aria-live="polite" className={msg ? "" : "muted"}>{msg || (open && value ? "Tap the map or drag the pin to adjust." : open ? "Tap the map to drop a pin." : !compact && value ? "Pin set. Tap the map or drag the pin to adjust." : "")}</small>
    </div>
  );
}
