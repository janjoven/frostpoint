import { ArrowCounterClockwise, Receipt, Truck, UploadSimple, Wallet } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { OrderSteps } from "../../components/OrderSteps";
import { Empty, ErrorState, Skeleton, StatusBadge } from "../../components/ui";
import { api } from "../../lib/api";
import { PAY_LABEL, PAY_TONE, canSendProof, fmtDateTime, isOpen, peso } from "../../lib/format";
import { useAct } from "../../lib/hooks";
import { toast, useAuth, useCart } from "../../store";

type Ev = { status: string; at: string };
type Order = {
  id: number; status: string; mode: string; payment_method: string; payment_status: string; has_proof: boolean;
  subtotal: string; delivery_fee: string; total: string; created_at: string; cancel_reason: string;
  items: { product_id: number | null; name: string; qty: number }[]; events: Ev[];
};

const TABS = [["active", "Active"], ["history", "History"], ["payments", "Payments"]] as const;
type Tab = (typeof TABS)[number][0];

function ProofUpload({ id }: { id: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const up = useAct((file: File) => { const form = new FormData(); form.append("file", file); return api(`/orders/${id}/proof`, { form }); }, { invalidate: ["my-orders"], success: "Proof sent. We will confirm your payment shortly." });
  return (
    <>
      <input ref={ref} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => e.target.files?.[0] && up.mutate(e.target.files[0])} />
      <button className="btn primary sm" disabled={up.isPending} onClick={() => ref.current?.click()}><UploadSimple size={16} aria-hidden="true" /> Send payment proof</button>
    </>
  );
}

const PayTag = ({ o }: { o: Order }) => <span className={`badge ${PAY_TONE[o.payment_status] ?? ""}`}>{PAY_LABEL[o.payment_status] ?? o.payment_status}</span>;
const itemsText = (o: Order) => o.items.map((i) => `${i.qty} × ${i.name}`).join(" · ");

function Payments({ orders }: { orders: Order[] }) {
  const live = orders.filter((o) => o.status !== "Cancelled");
  const sum = (f: (o: Order) => boolean) => live.filter(f).reduce((a, o) => a + Number(o.total), 0);
  const owed = sum((o) => o.payment_status === "unpaid" || o.payment_status === "proof_sent");
  const cod = sum((o) => o.payment_status === "cod_due");
  const paid = sum((o) => o.payment_status === "paid");
  return (
    <>
      <div className="card row spread" role="group" aria-label="Payment summary">
        <div><small className="muted">To pay now</small><div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{peso(owed)}</div></div>
        <div><small className="muted">On delivery</small><div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{peso(cod)}</div></div>
        <div><small className="muted">Paid</small><div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{peso(paid)}</div></div>
      </div>
      {orders.map((o) => (
        <article className="card stack" style={{ gap: 8 }} key={o.id}>
          <div className="row spread"><strong>Order #{o.id}</strong>{o.status === "Cancelled" ? <span className="badge bad">Cancelled</span> : <PayTag o={o} />}</div>
          <div className="row spread"><small className="muted">{fmtDateTime(o.created_at)} · {o.payment_method}</small><strong className="num">{peso(o.total)}</strong></div>
          {o.status !== "Cancelled" && canSendProof(o) && <div><ProofUpload id={o.id} /></div>}
        </article>))}
    </>
  );
}

export default function MyOrders() {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const q = useQuery({ queryKey: ["my-orders"], queryFn: () => api<Order[]>("/orders/mine"), enabled: !!user, refetchInterval: 20_000 });
  const add = useCart((s) => s.add);
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("active");
  if (!ready) return <Skeleton h={240} />;
  if (!user) return <Navigate to="/login" state={{ from: "/orders" }} replace />;
  if (q.isLoading) return <Skeleton h={240} />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data?.length) return <Empty icon={<Receipt size={40} aria-hidden="true" />} title="No orders yet" action={<Link to="/" className="btn primary">Start shopping</Link>} />;

  const reorder = (o: Order) => {
    o.items.forEach((i) => i.product_id && add(i.product_id, i.qty));
    toast("Items added to your cart");
    nav("/cart");
  };
  const active = q.data.filter((o) => isOpen(o.status));
  const history = q.data.filter((o) => !isOpen(o.status));
  const list = tab === "active" ? active : history;
  const needsProof = q.data.filter((o) => o.status !== "Cancelled" && canSendProof(o)).length;

  return (
    <div className="stack" style={{ maxWidth: 680, margin: "0 auto" }}>
      <h1>My orders</h1>
      <div className="seg" role="tablist" aria-label="Order views" style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr" }}>
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}{k === "active" && active.length ? ` (${active.length})` : ""}{k === "payments" && needsProof ? ` (${needsProof})` : ""}
          </button>))}
      </div>

      {tab === "payments" ? <Payments orders={q.data} /> : !list.length ? (
        <Empty icon={tab === "active" ? <Truck size={36} aria-hidden="true" /> : <Wallet size={36} aria-hidden="true" />}
          title={tab === "active" ? "No orders in progress" : "No past orders yet"}
          hint={tab === "active" ? "Orders you place show up here while they are on their way." : undefined}
          action={tab === "active" ? <Link to="/" className="btn primary">Order now</Link> : undefined} />
      ) : list.map((o) => (
        <article className="card stack" key={o.id}>
          <div className="row spread"><strong>Order #{o.id}</strong><StatusBadge status={o.status} /></div>
          <small className="muted">{fmtDateTime(o.created_at)} · {o.mode} · {o.payment_method}</small>
          {o.status === "Cancelled" ? <p className="err">Cancelled: {o.cancel_reason}</p> : <OrderSteps order={o} />}
          <div className="wrap-any">{itemsText(o)}</div>
          <div className="row spread">
            <span className="muted">Total (incl. {peso(o.delivery_fee)} delivery)</span><strong className="num">{peso(o.total)}</strong>
          </div>
          {o.status !== "Cancelled" && <div className="row spread"><PayTag o={o} /></div>}
          <div className="row">
            <Link to={`/orders/${o.id}`} className={`btn sm${isOpen(o.status) ? " primary" : ""}`}>{isOpen(o.status) ? "Track order" : "Details"}</Link>
            {canSendProof(o) && <ProofUpload id={o.id} />}
            <button className="btn sm" onClick={() => reorder(o)}><ArrowCounterClockwise size={16} aria-hidden="true" /> Reorder</button>
            {isOpen(o.status) && <Link to="/support" className="btn sm">Chat with us</Link>}
            {isOpen(o.status) && <a href="tel:+639000000000" className="btn sm">Call</a>}
          </div>
        </article>))}
    </div>
  );
}
