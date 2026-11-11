import { Camera, CheckCircle, MapPinLine, NavigationArrow, Phone, SignOut, Truck } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Button, Empty, ErrorState, Logo, Modal, Skeleton, StatusBadge, ThemeToggle } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDateTime, peso } from "../../lib/format";
import { useRiderGps } from "../../lib/gps";
import { useAct } from "../../lib/hooks";
import { directionsLink } from "../../lib/track";
import { useAuth } from "../../store";

type Job = {
  id: number; status: string; receiver_name: string; phone: string; address: string; location: string; notes: string;
  dest_lat: number | null; dest_lng: number | null; schedule_at: string | null; payment_method: string; payment_status: string; cash_to_collect: string; accepted_at: string | null;
  items: { name: string; qty: number }[];
};

const GPS_TEXT = {
  off: "", unsupported: "This phone or browser cannot share location.",
  waiting: "Waiting for GPS. Go outdoors or turn on high-accuracy location.",
  sharing: "Sharing your live location with customers on delivery.",
  blocked: "Location is blocked. Allow it for this site in your browser settings, then reload.",
} as const;

// The customer's pin is exact; without one, fall back to searching the typed address.
const mapsLink = (j: Job) => j.dest_lat != null && j.dest_lng != null
  ? directionsLink({ lat: j.dest_lat, lng: j.dest_lng })
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${j.address}, ${j.location}, Masbate, Philippines`)}`;

function DeliveredDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const cash = Number(job.cash_to_collect) > 0;
  const done = useAct((form: FormData) => api(`/rider/orders/${job.id}/delivered`, { form }), { invalidate: ["rider-orders"], success: `Order #${job.id} delivered` });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!(f.get("file") as File | null)?.size) f.delete("file");
    f.set("cash_collected", f.get("cash_collected") ? "true" : "false");
    done.mutate(f, { onSuccess: onClose });
  };
  return (
    <Modal title={`Deliver order #${job.id}`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {cash && (
          <label className="row nowrap" style={{ gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" name="cash_collected" required style={{ width: 22, height: 22, marginTop: 2 }} />
            <span>I collected <strong className="num">{peso(job.cash_to_collect)}</strong> in cash</span>
          </label>
        )}
        <label className="field"><span className="lbl">Photo of the delivery (optional)</span>
          <input className="input" type="file" name="file" accept="image/*" capture="environment" />
          <span className="help">Shows where you left the order. JPG, PNG or WebP, up to 5 MB.</span>
        </label>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <Button className="primary" type="submit" loading={done.isPending}><CheckCircle size={18} aria-hidden="true" /> Confirm delivered</Button>
        </div>
      </form>
    </Modal>
  );
}

function JobCard({ job, onDeliver }: { job: Job; onDeliver: () => void }) {
  const accept = useAct(() => api(`/rider/orders/${job.id}/accept`, { method: "POST" }), { invalidate: ["rider-orders"], success: "Accepted" });
  const start = useAct(() => api(`/rider/orders/${job.id}/start`, { method: "POST" }), { invalidate: ["rider-orders"], success: "Delivery started. Keep this screen open." });
  const out = job.status === "Out for Delivery";
  const done = job.status === "Delivered Successfully";
  const cash = Number(job.cash_to_collect) > 0;
  return (
    <article className="card stack">
      <div className="row spread"><strong>Order #{job.id}</strong><StatusBadge status={job.status} /></div>
      <div className="wrap-any">
        <strong>{job.receiver_name}</strong>
        <div>{job.address}</div>
        <div className="muted">{job.location}</div>
        {job.notes && <div className="wrap-any">Note: {job.notes}</div>}
        {job.schedule_at && <small className="muted">Requested for {fmtDateTime(job.schedule_at)}</small>}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>{job.items.map((i, k) => <li key={k}>{i.qty} × {i.name}</li>)}</ul>
      <div className="row spread">
        {cash ? <span className="badge warn">Collect <span className="num">{peso(job.cash_to_collect)}</span> cash</span>
          : <span className="badge ok">{job.payment_status === "paid" ? "Already paid" : "No cash to collect"}</span>}
        {job.accepted_at && !done && <small className="muted">Accepted</small>}
      </div>
      {!done && (
        <div className="row">
          <a className="btn" href={mapsLink(job)} target="_blank" rel="noreferrer"><NavigationArrow size={18} aria-hidden="true" /> {job.dest_lat != null ? "Navigate to pin" : "Navigate"}</a>
          <a className="btn" href={`tel:${job.phone}`}><Phone size={18} aria-hidden="true" /> Call {job.phone}</a>
        </div>
      )}
      {!done && !out && (
        <div className="row">
          {!job.accepted_at && <Button className="grow" loading={accept.isPending} onClick={() => accept.mutate()}>Accept</Button>}
          <Button className="primary grow" loading={start.isPending} onClick={() => {
            navigator.geolocation?.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true }); // asks for permission now
            start.mutate();
          }}><Truck size={18} aria-hidden="true" /> Start delivery</Button>
        </div>
      )}
      {out && <button className="btn primary" onClick={onDeliver}><CheckCircle size={18} aria-hidden="true" /> Mark delivered</button>}
      {done && <span className="badge ok" style={{ alignSelf: "flex-start" }}><Camera size={14} aria-hidden="true" /> Delivered</span>}
    </article>
  );
}

export default function RiderApp() {
  const { user, logout } = useAuth();
  const q = useQuery({ queryKey: ["rider-orders"], queryFn: () => api<Job[]>("/rider/orders"), refetchInterval: 15_000 });
  const [delivering, setDelivering] = useState<Job | null>(null);
  const active = (q.data ?? []).some((j) => j.status === "Out for Delivery");
  const gps = useRiderGps(active);
  const jobs = q.data ?? [];

  return (
    <>
      <header className="topbar">
        <span className="brand"><Logo /> FROSTPOINT Rider</span>
        <div className="row nowrap" style={{ gap: 4 }}>
          <ThemeToggle />
          <button className="btn ghost icon" onClick={() => logout()} aria-label="Sign out"><SignOut size={22} aria-hidden="true" /></button>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="store-main" style={{ outline: "none", maxWidth: 640 }}>
        <div className="stack">
          <h1>Hi {user?.name.split(" ")[0]}</h1>
          {active && (
            <div className={gps.state === "sharing" ? "banner ok-banner" : "banner"} role="status">
              <MapPinLine size={20} aria-hidden="true" />
              <span>{GPS_TEXT[gps.state]}{gps.state === "sharing" && gps.accuracy != null ? ` Accuracy about ${gps.accuracy} m.` : ""}</span>
            </div>
          )}
          {q.isLoading ? <Skeleton h={220} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !jobs.length ? (
            <Empty icon={<Truck size={40} aria-hidden="true" />} title="No deliveries yet" hint="Orders assigned to you appear here once the shop confirms them." />
          ) : jobs.map((j) => <JobCard key={j.id} job={j} onDeliver={() => setDelivering(j)} />)}
        </div>
      </main>
      {delivering && <DeliveredDialog job={delivering} onClose={() => setDelivering(null)} />}
    </>
  );
}
