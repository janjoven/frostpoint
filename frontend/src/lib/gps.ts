import { useEffect, useState } from "react";
import { api } from "./api";
import { MOCK_MODE } from "./mockMode";

export const GPS_INTERVAL_MS = 10_000;
/** Fixes worse than this (a cell-tower guess, for example) would put the rider on the wrong street. */
export const MAX_ACCURACY_M = 150;

export function shouldSend(lastSentAt: number, now: number, accuracy?: number | null) {
  if (accuracy != null && accuracy > MAX_ACCURACY_M) return false;
  return now - lastSentAt >= GPS_INTERVAL_MS;
}

export type GpsState = "off" | "waiting" | "sharing" | "blocked" | "unsupported";

/**
 * Shares the phone's GPS with the server while `active` (a delivery is in progress) and keeps the screen awake.
 * A web page cannot track in the background, so the rider has to keep this screen open.
 */
export function useRiderGps(active: boolean) {
  const [state, setState] = useState<GpsState>("off");
  const [accuracy, setAccuracy] = useState<number | null>(null);

  useEffect(() => {
    if (!active) { setState("off"); setAccuracy(null); return; }
    if (MOCK_MODE) { setState("sharing"); setAccuracy(15); return; }
    if (!navigator.geolocation) { setState("unsupported"); return; }
    setState("waiting");
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        setAccuracy(Math.round(acc));
        const now = Date.now();
        if (!shouldSend(last, now, acc)) return;
        last = now;
        api("/rider/location", { body: { lat, lng, accuracy: acc } }).then(() => setState("sharing")).catch(() => setState("waiting"));
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "blocked" : "waiting"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    );

    let lock: { release: () => Promise<void> } | null = null;
    const hold = () => { (navigator as any).wakeLock?.request("screen").then((l: typeof lock) => { lock = l; }).catch(() => {}); };
    const onVisible = () => document.visibilityState === "visible" && hold();
    hold();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      navigator.geolocation.clearWatch(id);
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);

  return { state, accuracy };
}
