import { Minus, Plus, ShoppingCart, Trash } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { Empty, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { peso } from "../../lib/format";
import { Product, useAuth, useCart } from "../../store";

export function useCartLines() {
  const lines = useCart((s) => s.lines);
  const q = useQuery({ queryKey: ["products"], queryFn: () => api<Product[]>("/products") });
  const items = (q.data ?? []).filter((p) => lines[p.id]).map((p) => ({ p, qty: lines[p.id] }));
  return { items, loading: q.isLoading, subtotal: items.reduce((a, i) => a + Number(i.p.price) * i.qty, 0) };
}

export default function Cart() {
  const { items, loading, subtotal } = useCartLines();
  const { set } = useCart();
  const user = useAuth((s) => s.user);
  const threshold = useQuery({ queryKey: ["settings"], queryFn: () => api<Record<string, string>>("/settings"), enabled: !!user });
  const free = Number(threshold.data?.free_delivery_threshold ?? 0);

  const ready = useAuth((s) => s.ready);

  if (loading || !ready) return <Skeleton h={200} />;
  // Signed-in customers edit their cart on the one-page checkout; this page remains for guests.
  if (user && items.length) return <Navigate to="/checkout" replace />;
  if (!items.length) return <Empty icon={<ShoppingCart size={40} aria-hidden="true" />} title="Your cart is empty" hint="Add some ice to get started." action={<Link to="/" className="btn primary">Browse products</Link>} />;
  return (
    <div className="stack" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1>Your cart</h1>
      {items.map(({ p, qty }) => (
        <div className="card row spread nowrap" key={p.id}>
          <div className="grow"><strong>{p.name}</strong><div className="muted num">{peso(p.price)}/{p.uom}</div></div>
          <div className="row nowrap" style={{ gap: 4 }}>
            <button className="btn icon" aria-label={`Decrease ${p.name}`} onClick={() => set(p.id, qty - 1 < p.min_order_qty ? 0 : qty - 1)}><Minus size={16} aria-hidden="true" /></button>
            <span className="num" style={{ minWidth: 32, textAlign: "center" }} aria-live="polite">{qty}</span>
            <button className="btn icon" aria-label={`Increase ${p.name}`} disabled={qty >= p.stock} onClick={() => set(p.id, qty + 1)}><Plus size={16} aria-hidden="true" /></button>
          </div>
          <strong className="num" style={{ minWidth: 70, textAlign: "right" }}>{peso(Number(p.price) * qty)}</strong>
          <button className="btn ghost icon" aria-label={`Remove ${p.name}`} onClick={() => set(p.id, 0)}><Trash size={18} aria-hidden="true" /></button>
        </div>
      ))}
      {free > 0 && (
        <div className="card stack" style={{ gap: 6 }}>
          <span>{subtotal >= free ? "You've unlocked free delivery!" : `Add ${peso(free - subtotal)} more for free delivery`}</span>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={free} aria-valuenow={Math.min(subtotal, free)} aria-label="Progress to free delivery"><i style={{ width: `${Math.min(100, (subtotal / free) * 100)}%` }} /></div>
        </div>
      )}
      <div className="card row spread"><span>Subtotal</span><strong className="num">{peso(subtotal)}</strong></div>
      <Link to="/checkout" className="btn primary">Sign in to check out</Link>
    </div>
  );
}
