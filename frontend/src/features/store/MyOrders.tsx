import { ChatCircleDots, Phone, Printer, Receipt, Truck, UploadSimple, Wallet } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useId, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { OrderPrint, type PrintableOrder } from "../../components/OrderPrint";
import { OrderSteps } from "../../components/OrderSteps";
import { Empty, ErrorState, Skeleton, StatusBadge } from "../../components/ui";
import { api } from "../../lib/api";
import { PAY_LABEL, PAY_TONE, canSendProof, fmtDateTime, isOpen, peso } from "../../lib/format";
import { useAct } from "../../lib/hooks";
import { toast, useAuth } from "../../store";

type Ev = { status: string; at: string };
type Order = {
  id: number; status: string; mode: string; payment_method: string; payment_status: string; has_proof: boolean;
  subtotal: string; delivery_fee: string; total: string; created_at: string; cancel_reason: string;
  items: { product_id: number | null; name: string; qty: number }[]; events: Ev[];
};

const TABS = [["active", "Active"], ["history", "History"], ["payments", "Payments"]] as const;
type Tab = (typeof TABS)[number][0];

function ProofUpload({ id, secondary = false }: { id: number; secondary?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const up = useAct((file: File) => { const form = new FormData(); form.append("file", file); return api(`/orders/${id}/proof`, { form }); }, { invalidate: ["my-orders"], success: "Proof sent. We will confirm your payment shortly." });
  return (
    <>
      <input ref={ref} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => e.target.files?.[0] && up.mutate(e.target.files[0])} />
      <button className={`btn sm${secondary ? "" : " primary"}`} aria-label={`Send payment proof for order ${id}`} disabled={up.isPending} onClick={() => ref.current?.click()}><UploadSimple size={16} aria-hidden="true" /> {up.isPending ? "Sending…" : "Send proof"}</button>
    </>
  );
}

const PayTag = ({ o }: { o: Order }) => <span className={`badge ${PAY_TONE[o.payment_status] ?? ""}`}>{PAY_LABEL[o.payment_status] ?? o.payment_status}</span>;

function Payments({ orders }: { orders: Order[] }) {
  const live = orders.filter((o) => o.status !== "Cancelled");
  const sum = (f: (o: Order) => boolean) => live.filter(f).reduce((a, o) => a + Number(o.total), 0);
  const owed = sum((o) => o.payment_status === "unpaid" || o.payment_status === "proof_sent");
  const cod = sum((o) => o.payment_status === "cod_due");
  const paid = sum((o) => o.payment_status === "paid");
  return (
    <>
      <div className="payment-summary" role="group" aria-label="Payment summary">
        <div className="card"><small className="muted">Outstanding</small><strong className="num">{peso(owed)}</strong></div>
        <div className="card"><small className="muted">On delivery</small><strong className="num">{peso(cod)}</strong></div>
        <div className="card"><small className="muted">Paid</small><strong className="num">{peso(paid)}</strong></div>
      </div>
      {orders.map((o) => (
        <article className="card order-card" aria-label={`Payment for order ${o.id}`} key={o.id}>
          <div className="row spread"><strong>Order #{o.id}</strong>{o.status === "Cancelled" ? <span className="badge bad">Cancelled</span> : <PayTag o={o} />}</div>
          <div className="row spread"><small className="muted">{fmtDateTime(o.created_at)} · {o.payment_method}</small><strong className="num">{peso(o.total)}</strong></div>
          <div className="order-primary-actions"><Link to={`/orders/${o.id}`} className="btn sm">View order</Link>{o.status !== "Cancelled" && canSendProof(o) && <ProofUpload id={o.id} />}</div>
        </article>))}
    </>
  );
}

export default function MyOrders() {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const q = useQuery({ queryKey: ["my-orders"], queryFn: () => api<Order[]>("/orders/mine"), enabled: !!user, refetchInterval: 20_000 });
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [printOrder, setPrintOrder] = useState<PrintableOrder | null>(null);
  const closePrint = useCallback(() => { setPrintOrder(null); setPrintingId(null); }, []);
  const [tab, setTab] = useState<Tab>("active");
  const tabsId = useId();
  if (!ready) return <Skeleton h={240} />;
  if (!user) return <Navigate to="/login" state={{ from: "/orders" }} replace />;
  if (q.isLoading) return <Skeleton h={240} />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;

  const print = async (id: number) => {
    if (printingId !== null) return;
    setPrintingId(id);
    try { setPrintOrder(await api<PrintableOrder>(`/orders/${id}`)); }
    catch (error) { toast((error as Error).message); setPrintingId(null); }
  };
  const orders = q.data ?? [];
  const active = orders.filter((o) => isOpen(o.status));
  const history = orders.filter((o) => !isOpen(o.status));
  const list = tab === "active" ? active : history;
  const needsProof = orders.filter((o) => o.status !== "Cancelled" && canSendProof(o)).length;
  const counts = { active: active.length, history: history.length, payments: needsProof };

  return (
    <div className="orders-page">
      <header className="orders-hero">
      <div className="orders-heading"><h1>My orders</h1><p>Track deliveries and manage payments.</p></div>
      <div className="order-tabs" role="tablist" aria-label="Order views">
        {TABS.map(([k, label]) => (
          <button key={k} id={`${tabsId}-${k}`} role="tab" aria-selected={tab === k} aria-controls={`${tabsId}-panel`} tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)} onKeyDown={(e) => {
            const index = TABS.findIndex(([key]) => key === k);
            const next = e.key === "ArrowRight" ? (index + 1) % TABS.length : e.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
            if (next < 0) return;
            e.preventDefault();
            const key = TABS[next][0]; setTab(key); document.getElementById(`${tabsId}-${key}`)?.focus();
          }}>
            {label}{counts[k] > 0 && <span className="order-tab-count" aria-label={`${counts[k]} ${k === "payments" ? "awaiting proof" : "orders"}`}>{counts[k]}</span>}
          </button>))}
      </div>
      </header>

      <section className="orders-list" role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`} tabIndex={0}>
      {!orders.length ? <Empty icon={<Receipt size={40} aria-hidden="true" />} title="No orders yet" action={<Link to="/" className="btn primary">Start shopping</Link>} /> : tab === "payments" ? <Payments orders={orders} /> : !list.length ? (
        <Empty icon={tab === "active" ? <Truck size={36} aria-hidden="true" /> : <Wallet size={36} aria-hidden="true" />}
          title={tab === "active" ? "No orders in progress" : "No past orders yet"}
          hint={tab === "active" ? "Orders you place show up here while they are on their way." : undefined}
          action={tab === "active" ? <Link to="/" className="btn primary">Order now</Link> : undefined} />
      ) : list.map((o) => (
        <article className="card order-card" aria-label={`Order ${o.id}`} key={o.id}>
          <header className="order-card-header"><strong>Order #{o.id}</strong><StatusBadge status={o.status} /></header>
          <div className="order-meta muted"><span>{fmtDateTime(o.created_at)}</span><span>{o.mode === "pickup" ? "Pickup" : "Delivery"} · {o.payment_method}</span></div>
          {o.status === "Cancelled" ? <p className="err">Cancelled: {o.cancel_reason}</p> : isOpen(o.status) && <div className="order-progress"><OrderSteps order={o} compact /></div>}
          <div className="order-summary">
            <ul className="order-items">{o.items.map((item, index) => <li key={`${item.product_id}-${index}`}><span className="order-item-qty num">{item.qty}×</span><span className="wrap-any">{item.name}</span></li>)}</ul>
            <div className="order-total"><small className="order-total-label muted">Total</small><strong className="num">{peso(o.total)}</strong><small className="muted">{o.mode === "pickup" ? "No delivery fee" : Number(o.delivery_fee) === 0 ? "Free delivery" : `Incl. ${peso(o.delivery_fee)} delivery`}</small></div>
          </div>
          {o.status !== "Cancelled" && <div className="order-payment"><PayTag o={o} />{canSendProof(o) && <small className="muted">Upload proof after paying.</small>}{o.payment_status === "proof_sent" && <small className="muted">We're checking your payment.</small>}</div>}
          <div className="order-primary-actions">
            <Link to={`/orders/${o.id}`} className={`btn sm${isOpen(o.status) ? " primary" : ""}`} aria-label={`${isOpen(o.status) ? "Track" : "View"} order ${o.id}`}>{isOpen(o.status) && <Truck size={16} aria-hidden="true" />}{isOpen(o.status) ? "Track order" : "View details"}</Link>
            {canSendProof(o) && <ProofUpload id={o.id} secondary />}
          </div>
          <div className="order-secondary-actions">
            <button type="button" className="btn ghost sm" onClick={() => void print(o.id)} disabled={printingId !== null} aria-busy={printingId === o.id || undefined} aria-label={`Print or save order ${o.id} as PDF`}><Printer size={16} aria-hidden="true" />{printingId === o.id ? "Preparing…" : "Print PDF"}</button>
            {isOpen(o.status) && <Link to="/support" className="btn ghost sm"><ChatCircleDots size={16} aria-hidden="true" /> Chat</Link>}
            {isOpen(o.status) && <a href="tel:+639000000000" className="btn ghost sm"><Phone size={16} aria-hidden="true" /> Call</a>}
          </div>
        </article>))}
      </section>
      {printOrder && <OrderPrint order={printOrder} onClose={closePrint} onError={toast} />}
    </div>
  );
}
