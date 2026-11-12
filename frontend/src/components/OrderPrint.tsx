import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { fmtDateTime, PAY_LABEL, peso } from "../lib/format";
import { Logo, LogoName } from "./ui";

export type PrintableOrder = {
  id: number; created_at: string; status: string; mode: string;
  receiver_name: string; phone: string; address: string; location: string;
  payment_method: string; payment_status: string; payment_ref: string;
  subtotal: string; delivery_fee: string; total: string;
  schedule_at: string | null; notes: string; cancel_reason: string;
  items: { name: string; qty: number; price: string }[];
};

/** A separate print document ensures only the requested order is printed. */
export function OrderPrint({ order, onClose, onError }: { order: PrintableOrder; onClose: () => void; onError: (message: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const title = document.title;
    document.title = `Frostpoint-order-${order.id}`;
    const afterPrint = () => onClose();
    window.addEventListener("afterprint", afterPrint);
    const images = Array.from(ref.current?.querySelectorAll("img") ?? []);
    Promise.all([document.fonts.ready, ...images.map((img) => img.decode().catch(() => {}))])
      .then(() => {
        if (cancelled) return;
        try { window.print(); }
        catch { onError("Printing is unavailable. Try opening this page in your browser."); onClose(); }
      });
    return () => { cancelled = true; document.title = title; window.removeEventListener("afterprint", afterPrint); };
  }, [order, onClose, onError]);

  return createPortal(
    <div id="order-print-root" ref={ref}>
      <header className="order-print-header">
        <div className="brand"><Logo /><LogoName /></div>
        <div><h1>Order summary</h1><p>Order #{order.id}</p></div>
      </header>
      <div className="order-print-info">
        <section><h2>Order details</h2><p><strong>Placed:</strong> {fmtDateTime(order.created_at)}</p><p><strong>Status:</strong> {order.status}</p><p><strong>Method:</strong> {order.mode === "pickup" ? "Pickup" : "Delivery"}</p>{order.schedule_at && <p><strong>Scheduled:</strong> {fmtDateTime(order.schedule_at)}</p>}</section>
        <section><h2>{order.mode === "pickup" ? "Contact" : "Deliver to"}</h2><p>{order.receiver_name}</p><p>{order.phone}</p>{order.mode !== "pickup" && <p>{order.address}<br />{order.location}</p>}</section>
      </div>
      <table className="order-print-items">
        <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
        <tbody>{order.items.map((item, i) => <tr key={i}><td>{item.name}</td><td>{item.qty}</td><td>{peso(item.price)}</td><td>{peso(Number(item.price) * item.qty)}</td></tr>)}</tbody>
      </table>
      <div className="order-print-totals"><p><span>Subtotal</span><span>{peso(order.subtotal)}</span></p><p><span>Delivery fee</span><span>{peso(order.delivery_fee)}</span></p><p className="order-print-grand-total"><strong>Total</strong><strong>{peso(order.total)}</strong></p></div>
      <section className="order-print-payment"><h2>Payment</h2><p>{order.payment_method} · {order.status === "Cancelled" ? "Order cancelled" : PAY_LABEL[order.payment_status] ?? order.payment_status}</p>{order.payment_ref && <p>Reference: {order.payment_ref}</p>}</section>
      {order.notes && <section className="order-print-note"><h2>Order notes</h2><p>{order.notes}</p></section>}
      {order.cancel_reason && <section className="order-print-note"><h2>Cancellation reason</h2><p>{order.cancel_reason}</p></section>}
      <footer className="order-print-footer">Frostpoint · Ice &amp; water delivery · Masbate</footer>
    </div>, document.body,
  );
}
