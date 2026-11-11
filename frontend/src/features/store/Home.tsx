import { ArrowCounterClockwise, MagnifyingGlass, Plus, Snowflake } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ProductArt } from "../../components/ProductArt";
import { Stepper } from "../../components/Stepper";
import { Empty, ErrorState, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { peso } from "../../lib/format";
import { usualLines } from "../../lib/usual";
import { Product, useAuth, useCart } from "../../store";

function Row({ p }: { p: Product }) {
  const qty = useCart((s) => s.lines[p.id] ?? 0);
  const set = useCart((s) => s.set);
  const out = p.stock < p.min_order_qty;
  const low = !out && p.stock <= p.low_stock_at;
  return (
    <article className="card prod-row">
      <Link to={`/product/${p.id}`} className="prod-art" tabIndex={-1} aria-hidden="true"><ProductArt category={p.category} compact /></Link>
      <div className="prod-info">
        <h2><Link to={`/product/${p.id}`}>{p.name}</Link>{p.badge && <span className="badge" style={{ marginLeft: 6 }}>{p.badge}</span>}</h2>
        <p className="muted wrap-any">{p.description}</p>
        <div className="row nowrap" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className="num"><strong>{peso(p.price)}</strong><small className="muted">/{p.uom}</small></span>
          {p.min_order_qty > 1 && <small className="muted">min {p.min_order_qty} {p.uom}</small>}
          {low && <span className="badge warn">Only {p.stock} left</span>}
          {out && <span className="badge bad">Out of stock</span>}
        </div>
      </div>
      <div className="prod-act">
        {out ? null : qty ? <Stepper value={qty} min={p.min_order_qty} max={p.stock} label={p.name} onChange={(v) => set(p.id, v)} />
          : <button className="btn primary sm" aria-label={`Add ${p.name} to cart`} onClick={() => set(p.id, p.min_order_qty)}><Plus size={16} aria-hidden="true" /> Add</button>}
      </div>
    </article>
  );
}

export default function Home() {
  const user = useAuth((s) => s.user);
  const q = useQuery({ queryKey: ["products"], queryFn: () => api<Product[]>("/products") });
  const promos = useQuery({ queryKey: ["promos"], queryFn: () => api<any[]>("/promotions") });
  const mine = useQuery({ queryKey: ["my-orders"], queryFn: () => api<any[]>("/orders/mine"), enabled: !!user });
  const lines = useCart((s) => s.lines);
  const setLine = useCart((s) => s.set);
  const nav = useNavigate();
  const [term, setTerm] = useState("");
  const [cat, setCat] = useState("All");
  const cats = ["All", ...Array.from(new Set((q.data ?? []).map((p) => p.category)))];
  const list = (q.data ?? []).filter((p) => (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(term.trim().toLowerCase()));
  const usual = usualLines(mine.data, q.data);
  const usualTotal = usual.reduce((a, l) => a + Number(l.p.price) * l.qty, 0);
  const count = Object.values(lines).reduce((a, b) => a + b, 0);
  const subtotal = (q.data ?? []).reduce((a, p) => a + Number(p.price) * (lines[p.id] ?? 0), 0);

  const reorder = () => {
    usual.forEach(({ p, qty }) => setLine(p.id, qty));
    nav("/checkout");
  };

  return (
    <div className="stack" style={{ maxWidth: 720, margin: "0 auto", paddingBottom: count ? 72 : 0 }}>
      {promos.data?.[0] && (
        <section className="hero" aria-label="Promotion">
          <strong style={{ fontSize: 18 }}>{promos.data[0].title}</strong>
          <p className="wrap-any">{promos.data[0].message}</p>
        </section>
      )}
      <h1 className="sr-only">Shop</h1>
      {usual.length > 0 && (
        <section className="card row nowrap" aria-label="Your usual order">
          <div className="grow">
            <small className="muted" style={{ textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>Your usual</small>
            <div className="wrap-any"><strong>{usual.map((l) => `${l.qty} ${l.p.uom} ${l.p.name}`).join(" · ")}</strong></div>
            <small className="muted num">{peso(usualTotal)} + delivery</small>
          </div>
          <button className="btn primary" onClick={reorder}><ArrowCounterClockwise size={18} aria-hidden="true" /> Reorder</button>
        </section>
      )}
      <label className="row nowrap" style={{ gap: 8 }}>
        <MagnifyingGlass size={22} aria-hidden="true" /><span className="sr-only">Search products</span>
        <input className="input" type="search" placeholder="Search ice, water…" value={term} onChange={(e) => setTerm(e.target.value)} />
      </label>
      <div className="pill-filters" role="group" aria-label="Categories">
        {cats.map((c) => <button key={c} className="pill" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      {q.isLoading ? <div className="stack"><Skeleton h={96} /><Skeleton h={96} /><Skeleton h={96} /></div> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !list.length ? (
        <Empty icon={<Snowflake size={32} aria-hidden="true" />} title="No products found" hint="Try a different search." />
      ) : (
        <div className="stack" style={{ gap: 10 }}>{list.map((p) => <Row key={p.id} p={p} />)}</div>
      )}
      {count > 0 && (
        <div className="ordbar">
          <Link to={user ? "/checkout" : "/cart"} className="btn primary">
            <span>{count} item{count > 1 ? "s" : ""}</span><span className="num">Checkout · {peso(subtotal)}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
