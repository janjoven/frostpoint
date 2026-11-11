import { CaretLeft, MapPinLine, Phone, Warning } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { OrderSteps } from "../../components/OrderSteps";
import { ProofImage } from "../../components/ProofImage";
import { ErrorState, Skeleton, StatusBadge } from "../../components/ui";
import { api } from "../../lib/api";
import { PAY_LABEL, PAY_TONE, fmtDateTime, isOpen, peso } from "../../lib/format";
import { ago, distText, etaText } from "../../lib/track";
import { useAuth } from "../../store";

const MapView = lazy(() => import("../../components/Map"));

type Order = {
  id: number; status: string; mode: string; address: string; location: string; payment_method: string; payment_status: string;
  subtotal: string; delivery_fee: string; total: string; created_at: string; cancel_reason: string; rider_name: string;
  has_delivery_proof: boolean; items: { name: string; qty: number; price: string }[]; events: { status: string; at: string }[];
};
type Track = {
  status: string; dest: { lat: number; lng: number } | null; eta_minutes: number | null;
  rider: { name: string; lat: number; lng: number; accuracy: number | null; updated_at: string; stale: boolean } | null;
  route: { coords: number[][]; distance_m: number; source: "road" | "straight" } | null;
};

export default function TrackOrder() {
  const { id } = useParams();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const order = useQuery({
    queryKey: ["order", id], queryFn: () => api<Order>(`/orders/${id}`), enabled: !!user,
    refetchInterval: (q) => (q.state.data && !isOpen(q.state.data.status) ? false : 15_000),
  });
  const track = useQuery({
    queryKey: ["track", id], queryFn: () => api<Track>(`/orders/${id}/track`), enabled: !!user,
    // Faster while the rider is moving, stop once the order is closed.
    refetchInterval: (q) => (q.state.data?.status === "Out for Delivery" ? 10_000 : q.state.data && !isOpen(q.state.data.status) ? false : 30_000),
  });

  if (!ready) return <Skeleton h={300} />;
  if (!user) return <Navigate to="/login" state={{ from: `/orders/${id}` }} replace />;
  if (order.isLoading) return <Skeleton h={300} />;
  if (order.isError || !order.data) return <ErrorState error={order.error ?? new Error("Order not found")} retry={() => order.refetch()} />;

  const o = order.data;
  const t = track.data;
  const out = o.status === "Out for Delivery";
  const showMap = o.mode === "delivery" && isOpen(o.status) && !!(t?.dest || t?.rider);

  return (
    <div className="stack" style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link to="/orders" className="row" style={{ gap: 4 }}><CaretLeft size={18} aria-hidden="true" /> My orders</Link>
      <div className="row spread"><h1>Order #{o.id}</h1><StatusBadge status={o.status} /></div>
      <small className="muted">{fmtDateTime(o.created_at)} · {o.mode}</small>

      {out && (
        <section className="card stack" aria-live="polite" aria-label="Delivery status">
          {t?.rider ? (
            <>
              <div className="eta-card">
                <div>
                  <small className="muted">{t.route?.source === "straight" ? "Estimated arrival" : "Arriving in"}</small>
                  <div className="big">{t.eta_minutes != null ? etaText(t.eta_minutes) : "On the way"}</div>
                </div>
                {t.route && <div className="num muted">{distText(t.route.distance_m)} away</div>}
              </div>
              <div className="row spread">
                <span><MapPinLine size={16} aria-hidden="true" /> {t.rider.name || o.rider_name || "Your rider"}</span>
                <small className="muted">Updated {ago(t.rider.updated_at)}</small>
              </div>
              {t.rider.stale && <div className="banner"><Warning size={18} aria-hidden="true" /> The rider's location has not updated for a while. They may be in an area with weak signal.</div>}
            </>
          ) : (
            <div><strong>Your order is on the way.</strong><div className="muted">{o.rider_name ? `${o.rider_name} is delivering it. ` : ""}Live location will appear here once the rider's GPS connects.</div></div>
          )}
        </section>
      )}

      {showMap && (
        <Suspense fallback={<Skeleton h={300} />}>
          <MapView dest={t?.dest} rider={out ? t?.rider : null} route={out ? t?.route?.coords : null} height={300}
            label={out ? "Map showing your rider and the route to you" : "Map showing your delivery location"} />
        </Suspense>
      )}
      {o.mode === "delivery" && isOpen(o.status) && t && !t.dest && <small className="muted">Tip: pin your location at checkout next time to follow your rider on a map.</small>}

      {o.status === "Cancelled" ? <p className="err">Cancelled: {o.cancel_reason}</p> : <section className="card"><OrderSteps order={o} /></section>}

      {o.has_delivery_proof && <section className="card stack"><strong>Delivery photo</strong><ProofImage id={o.id} kind="delivery-proof" /></section>}

      <section className="card stack" aria-labelledby="upd">
        <h2 id="upd">Updates</h2>
        <ol style={{ margin: 0, padding: 0, listStyle: "none" }} className="stack">
          {[...o.events].reverse().map((e, k) => (
            <li key={k} className="row nowrap" style={{ gap: 12 }}>
              <span className="muted num" style={{ minWidth: 92 }}>{fmtDateTime(e.at)}</span><span>{e.status}</span>
            </li>))}
        </ol>
      </section>

      <section className="card stack" aria-labelledby="sm">
        <h2 id="sm">Order</h2>
        {o.items.map((i, k) => <div className="row spread nowrap" key={k}><span>{i.qty} × {i.name}</span><span className="num">{peso(Number(i.price) * i.qty)}</span></div>)}
        <div className="row spread"><span className="muted">Delivery</span><span className="num">{peso(o.delivery_fee)}</span></div>
        <div className="row spread"><strong>Total</strong><strong className="num">{peso(o.total)}</strong></div>
        <div className="row spread"><span className="muted">{o.payment_method}</span>{o.status !== "Cancelled" && <span className={`badge ${PAY_TONE[o.payment_status] ?? ""}`}>{PAY_LABEL[o.payment_status] ?? o.payment_status}</span>}</div>
        {o.mode === "delivery" && <div className="muted wrap-any">{o.address} ({o.location})</div>}
      </section>

      {isOpen(o.status) && (
        <div className="row">
          <Link to="/support" className="btn">Chat with us</Link>
          <a href="tel:+639000000000" className="btn"><Phone size={18} aria-hidden="true" /> Call</a>
        </div>
      )}
    </div>
  );
}
