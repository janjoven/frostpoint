import { CaretLeft, Minus, Plus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProductArt } from "../../components/ProductArt";
import { ErrorState, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { peso } from "../../lib/format";
import { Product, toast, useCart } from "../../store";

export default function ProductPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["products"], queryFn: () => api<Product[]>("/products") });
  const p = q.data?.find((x) => String(x.id) === id);
  const [qty, setQty] = useState<number | null>(null);
  const add = useCart((s) => s.add);
  const nav = useNavigate();
  if (q.isLoading) return <Skeleton h={320} />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!p) return <div className="empty"><strong>Product not found</strong><Link to="/" className="btn">Back to shop</Link></div>;
  const n = qty ?? p.min_order_qty;
  const set = (v: number) => setQty(Math.min(p.stock, Math.max(p.min_order_qty, v)));
  return (
    <div className="stack" style={{ maxWidth: 560, margin: "0 auto" }}>
      <Link to="/" className="row" style={{ gap: 4 }}><CaretLeft size={18} aria-hidden="true" /> All products</Link>
      <ProductArt category={p.category} badge={p.badge} />
      <div className="row spread nowrap"><h1>{p.name}</h1><span className="num"><strong style={{ fontSize: 20 }}>{peso(p.price)}</strong>/{p.uom}</span></div>
      <p className="muted">{p.description}</p>
      {p.min_order_qty > 1 && <p className="help">Minimum order: {p.min_order_qty} {p.uom}</p>}
      <div className="row">
        <span className="lbl" id="qtylbl">Quantity</span>
        <div className="row nowrap" role="group" aria-labelledby="qtylbl">
          <button className="btn icon" aria-label="Decrease quantity" onClick={() => set(n - 1)} disabled={n <= p.min_order_qty}><Minus size={18} aria-hidden="true" /></button>
          <input className="input num" style={{ width: 80, textAlign: "center" }} inputMode="numeric" value={n} aria-label="Quantity" onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")) || p.min_order_qty)} />
          <button className="btn icon" aria-label="Increase quantity" onClick={() => set(n + 1)} disabled={n >= p.stock}><Plus size={18} aria-hidden="true" /></button>
        </div>
        <span className="num"><strong>{peso(Number(p.price) * n)}</strong></span>
      </div>
      <div className="row">
        <button className="btn grow" disabled={p.stock < p.min_order_qty} onClick={() => { add(p.id, n); toast("Added to cart"); }}>Add to cart</button>
        <button className="btn primary grow" disabled={p.stock < p.min_order_qty} onClick={() => { add(p.id, n); nav("/checkout"); }}>Order now</button>
      </div>
    </div>
  );
}
