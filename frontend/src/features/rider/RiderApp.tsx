import { ArrowClockwise, Camera, CheckCircle, Clock, MapPinLine, NavigationArrow, Package, Phone, SignOut, Truck, Wallet } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useLayoutEffect, useState } from "react";
import { Button, Empty, ErrorState, Field, Logo, LogoName, Modal, Skeleton, StatusBadge } from "../../components/ui";
import { api } from "../../lib/api";
import { MOCK_MODE } from "../../lib/mockMode";
import { fmtDateTime, PAY_LABEL, peso } from "../../lib/format";
import { useRiderGps } from "../../lib/gps";
import { useAct } from "../../lib/hooks";
import { canStartDelivery, groupRiderJobs } from "../../lib/riderJobs";
import { directionsLink } from "../../lib/track";
import { useAuth } from "../../store";

type Job = {
  id: number; status: string; receiver_name: string; phone: string; address: string; location: string; notes: string;
  dest_lat: number | null; dest_lng: number | null; schedule_at: string | null; payment_method: string; payment_status: string; cash_to_collect: string; accepted_at: string | null;
  items: { name: string; qty: number }[];
};

const GPS_TEXT = {
  off: "Connecting to your location…",
  unsupported: "Location sharing is unavailable in this browser.",
  waiting: "Waiting for a GPS signal. Check that device location is turned on.",
  sharing: "Keep this page open to share your location.",
  blocked: "Allow location access in your browser settings, then reload.",
} as const;
const GPS_TITLE = { off: "Connecting to GPS", unsupported: "Location unavailable", waiting: "Connecting to GPS", sharing: "Live location is on", blocked: "Location access is blocked" } as const;

const mapsLink = (job: Job) => job.dest_lat != null && job.dest_lng != null
  ? directionsLink({ lat: job.dest_lat, lng: job.dest_lng })
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${job.address}, ${job.location}, Masbate, Philippines`)}`;

function DeliveredDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const cash = Number(job.cash_to_collect) > 0;
  const [fileError, setFileError] = useState("");
  const done = useAct((form: FormData) => api(`/rider/orders/${job.id}/delivered`, { form }), { invalidate: ["rider-orders"], success: `Order #${job.id} delivered` });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file") as File | null;
    if (file?.size && (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setFileError("Choose a JPG, PNG or WebP photo up to 5 MB."); return;
    }
    setFileError("");
    if (!file?.size) form.delete("file");
    form.set("cash_collected", form.get("cash_collected") ? "true" : "false");
    done.mutate(form, { onSuccess: onClose });
  };
  return (
    <Modal title="Complete delivery" onClose={onClose}>
      <form className="rider-complete-form" onSubmit={submit}>
        <div className="rider-complete-order"><strong>Order #{job.id}</strong><span className="muted">{job.receiver_name}</span></div>
        {cash ? <label className="rider-collection-confirm"><input type="checkbox" name="cash_collected" required /><span>I collected <strong className="num">{peso(job.cash_to_collect)}</strong> in cash from the customer.</span></label> : <p className="muted rider-complete-copy">Confirm that the order has been handed to the customer.</p>}
        <Field label="Delivery photo (optional)" error={fileError} help="JPG, PNG or WebP, up to 5 MB. The customer can view this photo.">{(props) => <input {...props} className="input rider-proof-file" type="file" name="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={() => setFileError("")} />}</Field>
        <div className="rider-complete-actions"><Button className="primary" type="submit" loading={done.isPending}><CheckCircle size={18} weight="fill" aria-hidden="true" /> Confirm delivery</Button><button type="button" className="btn ghost" disabled={done.isPending} onClick={onClose}>Go back</button></div>
      </form>
    </Modal>
  );
}

function JobCard({ job, onDeliver }: { job: Job; onDeliver: () => void }) {
  const accept = useAct(() => api(`/rider/orders/${job.id}/accept`, { method: "POST" }), { invalidate: ["rider-orders"], success: "Delivery accepted" });
  const start = useAct(() => api(`/rider/orders/${job.id}/start`, { method: "POST" }), { invalidate: ["rider-orders"], success: "Delivery started. Keep this screen open." });
  const out = job.status === "Out for Delivery", done = job.status === "Delivered Successfully";
  const cash = Number(job.cash_to_collect) > 0;
  const ready = canStartDelivery(job.status);
  const busy = accept.isPending || start.isPending;
  return (
    <article className={`card rider-job${out ? " rider-job-on-road" : ""}`} aria-label={`Delivery order ${job.id}`}>
      <header className="rider-job-header"><strong>Order #{job.id}</strong><StatusBadge status={job.status} /></header>
      <div className="rider-recipient"><h2>{job.receiver_name}</h2><span className="muted">{job.phone}</span></div>
      <div className="rider-address"><MapPinLine size={20} aria-hidden="true" /><div><p>{job.address || "Address not provided"}</p><small className="muted">{job.location}</small></div></div>
      {job.schedule_at && <div className="rider-schedule"><Clock size={16} aria-hidden="true" /><span>Requested for {fmtDateTime(job.schedule_at)}</span></div>}
      {job.notes && <div className="rider-note"><strong>Delivery note</strong><p>{job.notes}</p></div>}
      <ul className="rider-job-items" aria-label="Items to deliver">{job.items.map((item, i) => <li key={i}><span className="num">{item.qty}×</span><span>{item.name}</span></li>)}</ul>
      <div className={`rider-payment${cash && !done ? " rider-payment-cash" : ""}`}>
        <span className="rider-payment-icon">{job.payment_status === "paid" ? <CheckCircle size={20} aria-hidden="true" /> : <Wallet size={20} aria-hidden="true" />}</span>
        <div><strong>{cash && !done ? "Cash to collect" : job.payment_status === "paid" ? "Payment received" : PAY_LABEL[job.payment_status] ?? job.payment_status}</strong><small>{job.payment_method}</small></div>
        {cash && !done && <strong className="num rider-cash-amount">{peso(job.cash_to_collect)}</strong>}
      </div>
      {!done && <div className="rider-contact-actions"><a className="btn" href={mapsLink(job)} target="_blank" rel="noreferrer" aria-label={`Navigate to ${job.receiver_name}'s delivery location`}><NavigationArrow size={18} aria-hidden="true" /> Navigate</a><a className="btn" href={`tel:${job.phone}`} aria-label={`Call ${job.receiver_name} at ${job.phone}`}><Phone size={18} aria-hidden="true" /> Call customer</a></div>}
      {!done && !out && <div className="rider-workflow">
        {ready ? <>{!job.accepted_at && <Button loading={accept.isPending} disabled={busy} onClick={() => accept.mutate()}>{accept.isPending ? "Accepting…" : "Accept"}</Button>}<Button className="primary" loading={start.isPending} disabled={busy} onClick={() => { if (!MOCK_MODE) navigator.geolocation?.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true }); start.mutate(); }}><Truck size={17} aria-hidden="true" />{start.isPending ? "Starting…" : "Start delivery"}</Button></> : <p className="rider-waiting">Waiting for the shop to confirm this order.</p>}
      </div>}
      {job.accepted_at && !done && !out && <small className="rider-accepted"><CheckCircle size={14} weight="fill" aria-hidden="true" /> Accepted · start when you're ready to leave.</small>}
      {out && <button type="button" className="btn primary rider-delivered-button" onClick={onDeliver}><CheckCircle size={19} weight="fill" aria-hidden="true" /> Mark delivered</button>}
      {done && <div className="rider-finished"><Camera size={16} aria-hidden="true" /> Delivery completed</div>}
    </article>
  );
}

export default function RiderApp() {
  const { user, logout } = useAuth();
  const q = useQuery({ queryKey: ["rider-orders"], queryFn: () => api<Job[]>("/rider/orders"), refetchInterval: 15_000 });
  const [delivering, setDelivering] = useState<Job | null>(null);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const jobs = groupRiderJobs(q.data ?? []);
  const onRoad = jobs.active.filter((job) => job.status === "Out for Delivery").length;
  const gps = useRiderGps(onRoad > 0);
  const list = jobs[tab];
  useLayoutEffect(() => { document.getElementById("main")?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, []);

  return (
    <>
      <header className="topbar"><span className="brand"><Logo /><LogoName /><span className="brand-role">Rider</span></span><button type="button" className="btn ghost icon" onClick={() => logout()} aria-label="Sign out"><SignOut size={22} aria-hidden="true" /></button></header>
      <main id="main" tabIndex={-1} className="store-main rider-main" style={{ outline: "none" }}>
        <div className="rider-page">
          <header className="rider-hero"><div><p className="rider-eyebrow">Your delivery dashboard</p><h1>Hi, {user?.name.split(" ")[0]}</h1><p>{q.isLoading ? "Loading your assignments…" : `${jobs.active.length} active deliver${jobs.active.length === 1 ? "y" : "ies"}${onRoad ? ` · ${onRoad} on the road` : ""}`}</p></div><button type="button" className="btn icon" onClick={() => void q.refetch()} disabled={q.isFetching} aria-label="Refresh deliveries" title="Refresh deliveries" aria-busy={q.isFetching}><ArrowClockwise size={20} aria-hidden="true" /></button></header>
          {onRoad > 0 && <div className={`rider-gps${gps.state === "sharing" ? "" : " rider-gps-warning"}`} role="status"><span className="rider-gps-icon"><MapPinLine size={18} aria-hidden="true" /></span><div className="rider-gps-copy"><div className="rider-gps-heading"><strong>{GPS_TITLE[gps.state]}</strong>{gps.state === "sharing" && gps.accuracy != null && <small aria-label={`GPS accuracy about ${gps.accuracy} metres`}>~{gps.accuracy} m</small>}</div><p>{GPS_TEXT[gps.state]}</p></div></div>}
          <div className="rider-tabs" role="group" aria-label="Delivery views">{(["active", "completed"] as const).map((view) => <button type="button" key={view} aria-pressed={tab === view} onClick={() => setTab(view)}>{view === "active" ? "Active deliveries" : "Completed"}<span className="num">{q.isLoading ? "–" : jobs[view].length}</span></button>)}</div>
          {q.isLoading ? <><Skeleton h={220} /><Skeleton h={220} /></> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !list.length ? <Empty icon={tab === "active" ? <Truck size={36} aria-hidden="true" /> : <Package size={36} aria-hidden="true" />} title={tab === "active" ? "No active deliveries" : "No completed deliveries"} hint={tab === "active" ? "New assignments will appear here when the shop confirms them." : "Recently completed deliveries will appear here."} /> : <div className="rider-job-list">{list.map((job) => <JobCard key={job.id} job={job} onDeliver={() => setDelivering(job)} />)}</div>}
        </div>
      </main>
      {delivering && <DeliveredDialog job={q.data?.find((job) => job.id === delivering.id) ?? delivering} onClose={() => setDelivering(null)} />}
    </>
  );
}
