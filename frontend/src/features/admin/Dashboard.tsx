import { ArrowDownRight, ArrowUpRight, Bell, CurrencyCircleDollar, Headset, Package, Plus, Receipt, Truck, Users, WarningCircle, Minus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Empty, ErrorState, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDateTime, peso } from "../../lib/format";
import { useAuth } from "../../store";
import { Order, OrderDetail, StatusSelect } from "./OrderParts";

const TIP = { background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 12 };
const STATUS_COLOR: Record<string, string> = {
  "Order Placed": "var(--primary)", "Order Confirmed": "var(--primary)", Preparing: "var(--warning)", "Out for Delivery": "var(--warning)", "Delivered Successfully": "var(--success)", Cancelled: "var(--danger)",
};

function greeting() {
  const h = Number(new Date().toLocaleString("en-PH", { hour: "numeric", hour12: false, timeZone: "Asia/Manila" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Delta({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return <span className="delta flat"><Minus size={12} aria-hidden="true" /> no prior data</span>;
  const up = pct >= 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      {up ? <ArrowUpRight size={12} weight="bold" aria-hidden="true" /> : <ArrowDownRight size={12} weight="bold" aria-hidden="true" />}
      {Math.abs(pct)}% <span className="sr-only">{up ? "up" : "down"}</span><span className="muted"> last 7d vs prior</span>
    </span>
  );
}

function Spark({ data, k }: { data: { [k: string]: any }[]; k: string }) {
  const vals = data.map((d) => d[k] as number);
  const max = Math.max(...vals, 1);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${28 - (v / max) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="spark" aria-hidden="true">
      <polyline points={`0,30 ${pts} 100,30`} fill="currentColor" opacity="0.12" stroke="none" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Kpi({ label, value, icon, tone, sub, spark }: { label: string; value?: ReactNode; icon: ReactNode; tone: string; sub?: ReactNode; spark?: ReactNode }) {
  return (
    <div className={`card kpi-card tone-${tone}`}>
      <div className="row spread nowrap"><span className="l">{label}</span><span className="chip" aria-hidden="true">{icon}</span></div>
      {value === undefined ? <Skeleton h={32} w="60%" /> : <span className="v">{value}</span>}
      <div className="sub">{sub}</div>
      {spark}
    </div>
  );
}

export default function Dashboard() {
  const me = useAuth((s) => s.user)!;
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api("/admin/stats"), refetchInterval: 30_000 });
  const orders = useQuery({ queryKey: ["orders", "latest"], queryFn: () => api<Order[]>("/orders") });
  const [open, setOpen] = useState<Order | null>(null);
  const [range, setRange] = useState(14);
  const s = stats.data;

  if (stats.isError) return <ErrorState error={stats.error} retry={() => stats.refetch()} />;

  const series: any[] = s ? s.spark.slice(-range) : [];
  const total = series.reduce((a, b) => a + b.revenue, 0);
  const statusData = s ? Object.entries(s.by_status as Record<string, number>).map(([name, value]) => ({ name, value })) : [];
  const topMax = Math.max(...(s?.top_products.map((p: any) => p.total) ?? [1]), 1);
  const spark7 = s?.spark.slice(-14);

  const alerts: { icon: ReactNode; text: string; to: string }[] = [];
  if (s?.placed) alerts.push({ icon: <Receipt size={18} aria-hidden="true" />, text: `${s.placed} new order${s.placed > 1 ? "s" : ""} to confirm`, to: "/admin/orders" });
  if (s?.out_for_delivery) alerts.push({ icon: <Truck size={18} aria-hidden="true" />, text: `${s.out_for_delivery} out for delivery`, to: "/admin/orders" });
  if (s?.low_stock) alerts.push({ icon: <Package size={18} aria-hidden="true" />, text: `${s.low_stock} low-stock`, to: "/admin/products" });
  if (s?.unread_support) alerts.push({ icon: <Headset size={18} aria-hidden="true" />, text: `${s.unread_support} unread message${s.unread_support > 1 ? "s" : ""}`, to: "/admin/support" });

  return (
    <div className="stack" style={{ gap: 20 }}>
      <header className="dash-hero">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Manila" })}</p>
          <h1>{greeting()}, {me.name.split(" ")[0]}</h1>
          <p className="muted">{s ? (s.orders_pending ? `You have ${s.orders_pending} order${s.orders_pending > 1 ? "s" : ""} in progress.` : "All caught up — no pending orders.") : "Loading today's numbers…"}</p>
        </div>
        <div className="row">
          <Link to="/admin/products" className="btn"><Plus size={18} aria-hidden="true" /> Product</Link>
          <Link to="/admin/orders" className="btn primary"><Receipt size={18} aria-hidden="true" /> View orders</Link>
        </div>
      </header>

      {alerts.length > 0 && (
        <div className="alerts" role="status" aria-label="Needs attention">
          {alerts.map((a) => <Link key={a.text} to={a.to} className="alert-chip">{a.icon}{a.text}</Link>)}
        </div>
      )}

      <div className="grid kpis">
        <Kpi tone="blue" label="Revenue today" icon={<CurrencyCircleDollar size={20} weight="duotone" />} value={s && peso(s.revenue_today)}
          sub={s && <span className="muted">Yesterday {peso(s.revenue_yesterday)}</span>} spark={spark7 && <Spark data={spark7} k="revenue" />} />
        <Kpi tone="green" label="Revenue · 30d" icon={<CurrencyCircleDollar size={20} weight="duotone" />} value={s && peso(s.spark.reduce((a: number, b: any) => a + b.revenue, 0))}
          sub={s && <Delta pct={s.revenue_week_change} />} spark={s && <Spark data={s.spark} k="revenue" />} />
        <Kpi tone="violet" label="Orders" icon={<Receipt size={20} weight="duotone" />} value={s?.orders_total}
          sub={s && <><span className="muted">{s.orders_today} today · </span><Delta pct={s.orders_week_change} /></>} spark={spark7 && <Spark data={spark7} k="orders" />} />
        <Kpi tone="amber" label="Pending work" icon={<Bell size={20} weight="duotone" />} value={s?.orders_pending}
          sub={s && <span className="muted">{s.placed} new · {s.out_for_delivery} on the road</span>} />
        <Kpi tone={s?.low_stock ? "red" : "teal"} label="Low stock" icon={<WarningCircle size={20} weight="duotone" />} value={s?.low_stock}
          sub={s && <span className="muted">{s.low_stock ? "Restock soon" : "Inventory healthy"}</span>} />
        <Kpi tone="teal" label="Customers" icon={<Users size={20} weight="duotone" />} value={s?.customers} sub={<span className="muted">Registered accounts</span>} />
      </div>

      <div className="grid two">
        <section className="card" aria-labelledby="rev">
          <div className="row spread" style={{ marginBottom: 8 }}>
            <div><h2 id="rev">Revenue</h2><p className="muted">{s ? <><strong className="num" style={{ color: "var(--text)" }}>{peso(total)}</strong> in the last {range} days</> : " "}</p></div>
            <div className="seg" role="group" aria-label="Chart range">
              {[7, 14, 30].map((r) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}d</button>)}
            </div>
          </div>
          {s ? (
            <>
              <div role="img" aria-label={`Revenue over ${range} days, total ${peso(total)}`} style={{ height: 250 }}>
                <ResponsiveContainer>
                  <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
                    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 4" />
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fill: "var(--muted)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={28} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} width={52} tickFormatter={(v) => `₱${v}`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number, n) => [n === "revenue" ? peso(v) : v, n === "revenue" ? "Revenue" : "Orders"]} contentStyle={TIP} />
                    <Area dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} fill="url(#g)" isAnimationActive={false} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <details style={{ marginTop: 8 }}><summary>View as table</summary>
                <div className="table-wrap"><table><thead><tr><th>Date</th><th className="r">Orders</th><th className="r">Revenue</th></tr></thead>
                  <tbody>{series.map((d) => <tr key={d.date}><td>{d.date}</td><td className="r num">{d.orders}</td><td className="r num">{peso(d.revenue)}</td></tr>)}</tbody></table></div>
              </details>
            </>
          ) : <Skeleton h={250} />}
        </section>

        <section className="card" aria-labelledby="mix">
          <h2 id="mix">Order status</h2>
          {s ? (!statusData.length ? <Empty icon={<Receipt size={28} aria-hidden="true" />} title="No orders yet" /> : (
            <div className="stack" style={{ gap: 8 }}>
              <div style={{ height: 170, position: "relative" }} role="img" aria-label={`Orders by status: ${statusData.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none" isAnimationActive={false}>
                      {statusData.map((d) => <Cell key={d.name} fill={STATUS_COLOR[d.name]} />)}
                    </Pie>
                    <Tooltip contentStyle={TIP} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><span className="num">{s.orders_total}</span><small className="muted">orders</small></div>
              </div>
              <ul className="legend">
                {statusData.map((d) => <li key={d.name}><i style={{ background: STATUS_COLOR[d.name] }} aria-hidden="true" />{d.name}<b className="num">{d.value}</b></li>)}
              </ul>
            </div>
          )) : <Skeleton h={230} />}
        </section>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <section className="card" aria-labelledby="top">
          <h2 id="top" style={{ marginBottom: 12 }}>Top products <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>· 30 days</span></h2>
          {!s ? <Skeleton h={140} /> : !s.top_products.length ? <Empty icon={<Package size={28} aria-hidden="true" />} title="No sales yet" /> : (
            <ol className="bars">
              {s.top_products.map((p: any, i: number) => (
                <li key={p.name}>
                  <div className="row spread nowrap"><span><span className="rank">{i + 1}</span>{p.name}</span><b className="num">{peso(p.total)}</b></div>
                  <div className="progress" aria-hidden="true"><i style={{ width: `${(p.total / topMax) * 100}%` }} /></div>
                  <small className="muted num">{p.qty} sold</small>
                </li>))}
            </ol>)}
        </section>
        <section className="card" aria-labelledby="ls">
          <div className="row spread" style={{ marginBottom: 12 }}><h2 id="ls">Stock watch</h2><Link to="/admin/products" className="btn sm">Manage</Link></div>
          {!s ? <Skeleton h={140} /> : !s.low_stock_items.length ? (
            <Empty icon={<Package size={28} aria-hidden="true" />} title="Everything is stocked" hint="Items at or below their alert level appear here." />
          ) : (
            <ul className="bars" style={{ listStyle: "none", padding: 0 }}>
              {s.low_stock_items.map((p: any) => (
                <li key={p.id}>
                  <div className="row spread nowrap"><span>{p.name}</span><span className="badge warn"><WarningCircle size={14} aria-hidden="true" /> <span className="num">{p.stock}</span> {p.uom} left</span></div>
                  <div className="progress warn" aria-hidden="true"><i style={{ width: `${Math.min(100, (p.stock / Math.max(p.alert, 1)) * 100)}%` }} /></div>
                </li>))}
            </ul>)}
        </section>
      </div>

      <section className="card flush" aria-labelledby="lo">
        <div className="row spread" style={{ padding: 16 }}><h2 id="lo">Latest orders</h2><Link to="/admin/orders" className="btn sm">See all</Link></div>
        {orders.isLoading ? <div style={{ padding: 16 }}><Skeleton h={120} /></div> : !orders.data?.length ? (
          <Empty icon={<Receipt size={32} aria-hidden="true" />} title="No orders yet" hint="New orders will appear here." />
        ) : (
          <div className="table-wrap"><table>
            <thead><tr><th>#</th><th>Customer</th><th>When</th><th className="r">Total</th><th>Status</th><th><span className="sr-only">Details</span></th></tr></thead>
            <tbody>{orders.data.slice(0, 6).map((o) => (
              <tr key={o.id}>
                <td className="num">{o.id}</td><td>{o.receiver_name}<div className="muted" style={{ fontSize: 13 }}>{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div></td>
                <td className="muted">{fmtDateTime(o.created_at)}</td>
                <td className="r num">{peso(o.total)}</td><td><StatusSelect o={o} /></td>
                <td><button className="btn sm" onClick={() => setOpen(o)} aria-label={`View order ${o.id}`}>View</button></td>
              </tr>))}
            </tbody></table></div>
        )}
      </section>
      {open && <OrderDetail o={orders.data?.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} />}
    </div>
  );
}
