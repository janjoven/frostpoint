import { MapPin, Trash } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { ProofImage } from "../../components/ProofImage";
import { Modal, StatusBadge } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDateTime, isOpen, NEXT, PAY_LABEL, PAY_TONE, peso, toLocalInput } from "../../lib/format";
import { useAct } from "../../lib/hooks";
import { osmLink } from "../../lib/track";
import { ask } from "../../store";

export type Order = {
  id: number; customer_name: string; receiver_name: string; phone: string; address: string; location: string; mode: string;
  schedule_at: string | null; payment_method: string; payment_ref: string; payment_status: string; has_proof: boolean; notes: string;
  subtotal: string; delivery_fee: string; total: string; status: string; cancel_reason: string; created_at: string;
  items: { name: string; qty: number; price: string }[];
  events: { status: string; at: string }[];
  dest_lat: number | null; dest_lng: number | null; rider_id: number | null; rider_name: string; rider_accepted_at: string | null; has_delivery_proof: boolean;
};

export function useOrderActions() {
  const setStatus = useAct(async ({ id, status }: { id: number; status: string }) => {
    let reason = "";
    if (status === "Cancelled") {
      const r = await ask({ title: `Cancel order #${id}?`, confirm: "Cancel order", danger: true, input: { label: "Reason (required)", required: true } });
      if (!r) throw new Error("Cancellation aborted");
      reason = String(r);
    }
    return api(`/orders/${id}/status`, { method: "PATCH", body: { status, reason } });
  }, { invalidate: ["orders", "stats", "products"], success: "Order updated" });

  const remove = useAct(async (id: number) => {
    const ok = await ask({ title: `Delete order #${id}?`, body: "This permanently removes the order and its history.", confirm: "Delete", danger: true });
    if (!ok) throw new Error("Delete cancelled");
    return api(`/orders/${id}`, { method: "DELETE" });
  }, { invalidate: ["orders", "stats"], success: "Order deleted" });
  return { setStatus, remove };
}

export function StatusSelect({ o }: { o: Order }) {
  const { setStatus } = useOrderActions();
  const next = NEXT[o.status] ?? [];
  if (!next.length) return <StatusBadge status={o.status} />;
  return (
    <label>
      <span className="sr-only">Change status of order {o.id}</span>
      <select className="input" style={{ minWidth: 170 }} value={o.status} disabled={setStatus.isPending}
        onChange={(e) => setStatus.mutate({ id: o.id, status: e.target.value })}>
        <option value={o.status}>{o.status}</option>
        {next.map((n) => <option key={n}>{n}</option>)}
      </select>
    </label>
  );
}

export const ProofViewer = ProofImage;

/** Staff pick which rider delivers an order; riders only see orders assigned to them. */
function RiderPicker({ o }: { o: Order }) {
  const riders = useQuery({ queryKey: ["riders"], queryFn: () => api<{ id: number; name: string }[]>("/riders") });
  const assign = useAct((rider_id: number | null) => api(`/orders/${o.id}/rider`, { method: "PATCH", body: { rider_id } }),
    { invalidate: ["orders"], success: "Rider updated" });
  return (
    <div className="stack" style={{ gap: 6 }}>
      <label className="field"><span className="lbl">Rider</span>
        <select className="input" value={o.rider_id ?? ""} disabled={assign.isPending}
          onChange={(e) => assign.mutate(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Not assigned</option>
          {riders.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      {o.rider_id && <small className="muted">{o.rider_accepted_at ? `Accepted ${fmtDateTime(o.rider_accepted_at)}` : "Not accepted yet"}</small>}
      {riders.data && !riders.data.length && <small className="muted">No riders yet. Add one under Users, Team &amp; Access.</small>}
    </div>
  );
}

export function OrderDetail({ o, onClose }: { o: Order; onClose: () => void }) {
  const { remove } = useOrderActions();
  const resched = useAct((v: string) => api(`/orders/${o.id}/schedule`, { method: "PATCH", body: { schedule_at: new Date(v).toISOString() } }), { invalidate: ["orders"], success: "Schedule updated" });
  const pay = useAct((payment_status: "paid" | "unpaid") => api(`/orders/${o.id}/payment`, { method: "PATCH", body: { payment_status } }),
    { invalidate: ["orders", "stats"], success: "Payment updated" });
  return (
    <Modal title={`Order #${o.id}`} onClose={onClose}>
      <div className="stack">
        <div className="row spread"><StatusBadge status={o.status} /><span className="muted">{fmtDateTime(o.created_at)}</span></div>
        <div>
          <strong>{o.receiver_name}</strong> <span className="muted">· {o.phone}</span>
          <p className="muted wrap-any">{o.mode === "pickup" ? "Pickup" : `${o.address || "—"} (${o.location})`}</p>
          {o.dest_lat != null && o.dest_lng != null && <a className="row" style={{ gap: 4 }} href={osmLink({ lat: o.dest_lat, lng: o.dest_lng })} target="_blank" rel="noreferrer"><MapPin size={16} aria-hidden="true" /> Customer's pin on the map</a>}
          {o.notes && <p className="wrap-any">Note: {o.notes}</p>}
          {o.cancel_reason && <p className="err">Cancelled: {o.cancel_reason}</p>}
        </div>
        <div className="table-wrap"><table>
          <tbody>
            {o.items.map((i, k) => <tr key={k}><td>{i.name}</td><td className="r num">{i.qty} × {peso(i.price)}</td><td className="r num">{peso(Number(i.price) * i.qty)}</td></tr>)}
            <tr><td colSpan={2} className="muted">Delivery fee</td><td className="r num">{peso(o.delivery_fee)}</td></tr>
            <tr><td colSpan={2}><strong>Total</strong></td><td className="r num"><strong>{peso(o.total)}</strong></td></tr>
          </tbody>
        </table></div>
        <div className="row spread">
          <span className="muted">Payment: {o.payment_method}{o.payment_ref && ` · ref ${o.payment_ref}`}</span>
          <span className={`badge ${PAY_TONE[o.payment_status] ?? ""}`}>{PAY_LABEL[o.payment_status] ?? o.payment_status}</span>
        </div>
        {o.has_proof && <ProofViewer id={o.id} />}
        {o.mode === "delivery" && isOpen(o.status) && <RiderPicker o={o} />}
        {o.mode === "delivery" && !isOpen(o.status) && o.rider_name && <div className="muted">Rider: {o.rider_name}</div>}
        {o.has_delivery_proof && <div className="stack" style={{ gap: 6 }}><strong>Delivery photo</strong><ProofViewer id={o.id} kind="delivery-proof" /></div>}
        {o.status !== "Cancelled" && (o.payment_status === "paid"
          ? <button className="btn sm" disabled={pay.isPending} onClick={() => pay.mutate("unpaid")}>Undo mark as paid</button>
          : <button className="btn primary sm" disabled={pay.isPending} onClick={() => pay.mutate("paid")}>Mark as paid</button>)}
        <div>
          <strong>History</strong>
          <ul className="muted" style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {o.events.map((e, k) => <li key={k}>{e.status} · {fmtDateTime(e.at)}</li>)}
          </ul>
        </div>
        <label className="field"><span className="lbl">Scheduled for</span>
          <input type="datetime-local" className="input" defaultValue={toLocalInput(o.schedule_at ?? o.created_at)}
            onBlur={(e) => e.target.value && e.target.value !== toLocalInput(o.schedule_at ?? o.created_at) && resched.mutate(e.target.value)} />
        </label>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="btn danger" onClick={() => remove.mutate(o.id, { onSuccess: onClose })}><Trash size={18} aria-hidden="true" /> Delete</button>
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </Modal>
  );
}
