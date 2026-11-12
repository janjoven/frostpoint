import { ArrowClockwise, ArrowDownRight, ArrowUpRight, Bell, CaretRight, CheckCircle, CurrencyCircleDollar, Headset, Package, Plus, Receipt, Truck, Users, WarningCircle, Minus } from "@phosphor-icons/react";
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
  "Order Placed": "#38bdf8", "Order Confirmed": "var(--primary)", Preparing: "var(--warning)", "Out for Delivery": "#8b5cf6", "Delivered Successfully": "var(--success)", Cancelled: "var(--danger)",
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
      {Math.abs(pct)}% <span className="sr-only">{up ? "up" : "down"}</span><span className="muted"> vs previous 7 days</span>
    </span>
  );
}

function Kpi({ label, value, icon, tone, sub }: { label: string; value?: ReactNode; icon: ReactNode; tone: string; sub?: ReactNode }) {
  return (
    <div className={`card kpi-card tone-${tone}`} data-ui-id={`kpi-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <div className="row spread nowrap"><span className="l">{label}</span><span className="chip" aria-hidden="true">{icon}</span></div>
      {value === undefined ? <Skeleton h={32} w="60%" /> : <span className="v">{value}</span>}
      <div className="sub">{sub}</div>
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
  const statusData = s ? Object.entries(s.by_status as Record<string, number>).filter(([, value]) => value > 0).map(([name, value]) => ({ name, value })) : [];
  const topMax = Math.max(...(s?.top_products.map((p: any) => p.total) ?? [1]), 1);

  const alerts: { icon: ReactNode; text: string; hint: string; to: string; tone: string }[] = [];
  if (s?.placed) alerts.push({ icon: <Receipt size={20} aria-hidden="true" />, text: `${s.placed} order${s.placed > 1 ? "s" : ""} to confirm`, hint: "Review incoming orders", to: "/admin/orders", tone: "blue" });
  if (s?.out_for_delivery) alerts.push({ icon: <Truck size={20} aria-hidden="true" />, text: `${s.out_for_delivery} out for delivery`, hint: "Check delivery progress", to: "/admin/orders", tone: "blue" });
  if (s?.low_stock) alerts.push({ icon: <Package size={20} aria-hidden="true" />, text: `${s.low_stock} low-stock item${s.low_stock > 1 ? "s" : ""}`, hint: "Review inventory levels", to: "/admin/products", tone: "amber" });
  if (s?.unread_support) alerts.push({ icon: <Headset size={20} aria-hidden="true" />, text: `${s.unread_support} unread message${s.unread_support > 1 ? "s" : ""}`, hint: "Reply to your customers", to: "/admin/support", tone: "blue" });

  return (
    <div className="dashboard-page">
      <header className="dash-hero" data-ui-id="dashboard-hero">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Manila" })}</p>
          <h1>{greeting()}, {me.name.split(" ")[0]}</h1>
          <p className="muted">{s ? (s.orders_pending ? `You have ${s.orders_pending} order${s.orders_pending > 1 ? "s" : ""} in progress.` : "All caught up — no pending orders.") : "Loading today's numbers…"}</p>
        </div>
        <div className="row dashboard-hero-actions">
          <Link to="/admin/products" className="btn"><Plus size={18} aria-hidden="true" /> Manage products</Link>
          <Link to="/admin/orders" className="btn primary"><Receipt size={18} aria-hidden="true" /> View orders</Link>
          <button className="btn icon dashboard-refresh" type="button" title="Refresh dashboard" aria-label="Refresh dashboard" onClick={() => { void stats.refetch(); void orders.refetch(); }} disabled={stats.isFetching || orders.isFetching} aria-busy={stats.isFetching || orders.isFetching}><ArrowClockwise size={18} aria-hidden="true" /></button>
        </div>
      </header>

      <section className="dashboard-attention" aria-label="Dashboard tasks">
        {alerts.length ? <div className="dashboard-alerts">{alerts.map((a) => <Link key={a.text} to={a.to} className={`dashboard-alert tone-${a.tone}`} title={a.hint}><span className="dashboard-alert-icon">{a.icon}</span><span className="dashboard-alert-copy"><strong>{a.text}</strong></span><CaretRight size={16} aria-hidden="true" /></Link>)}</div> : s ? <div className="dashboard-caught-up"><CheckCircle size={20} aria-hidden="true" /> All caught up. Nothing needs your attention right now.</div> : <Skeleton h={48} />}
      </section>

      <div className="dashboard-kpis" role="group" aria-label="Business metrics">
        <Kpi tone="blue" label="Revenue today" icon={<CurrencyCircleDollar size={20} weight="duotone" />} value={s && peso(s.revenue_today)}
          sub={s && <span className="muted">Yesterday {peso(s.revenue_yesterday)}</span>} />
        <Kpi tone="teal" label="Revenue · 30 days" icon={<CurrencyCircleDollar size={20} weight="duotone" />} value={s && peso(s.spark.reduce((a: number, b: any) => a + b.revenue, 0))}
          sub={s && <Delta pct={s.revenue_week_change} />} />
        <Kpi tone="blue" label="Total orders" icon={<Receipt size={20} weight="duotone" />} value={s?.orders_total}
          sub={s && <><span className="muted">{s.orders_today} today · </span><Delta pct={s.orders_week_change} /></>} />
        <Kpi tone="blue" label="In progress" icon={<Bell size={20} weight="duotone" />} value={s?.orders_pending}
          sub={s && <span className="muted">{s.placed} new · {s.out_for_delivery} on the road</span>} />
        <Kpi tone={s?.low_stock ? "red" : "teal"} label="Low stock" icon={<WarningCircle size={20} weight="duotone" />} value={s?.low_stock}
          sub={s && <span className="muted">{s.low_stock ? "Restock soon" : "Inventory healthy"}</span>} />
        <Kpi tone="blue" label="Customers" icon={<Users size={20} weight="duotone" />} value={s?.customers} sub={<span className="muted">Registered accounts</span>} />
      </div>

      <div className="dashboard-charts">
        <section className="card dashboard-panel" aria-labelledby="rev" data-ui-id="revenue-overview">
          <div className="dashboard-panel-heading">
            <div><h2 id="rev">Revenue overview</h2><p className="muted">{s ? <><strong className="num dashboard-chart-total">{peso(total)}</strong><span className="dashboard-chart-period">Last {range} days</span></> : " "}</p></div>
            <div className="seg" role="group" aria-label="Chart range">
              {[7, 14, 30].map((r) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}d</button>)}
            </div>
          </div>
          {s ? (
            <>
              <div className="dashboard-revenue-plot" role="img" aria-label={`Revenue over ${range} days, total ${peso(total)}`}>
                <ResponsiveContainer>
                  <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
                    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 4" />
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fill: "var(--muted)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={28} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} width={52} tickFormatter={(v) => `₱${v}`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number, n) => [n === "revenue" ? peso(v) : v, n === "revenue" ? "Revenue" : "Orders"]} contentStyle={TIP} />
                    <Area dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} fill="url(#g)" isAnimationActive={false} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <details className="dashboard-chart-table"><summary>View revenue table</summary>
                <div className="table-wrap"><table><thead><tr><th>Date</th><th className="r">Orders</th><th className="r">Revenue</th></tr></thead>
                  <tbody>{series.map((d) => <tr key={d.date}><td>{d.date}</td><td className="r num">{d.orders}</td><td className="r num">{peso(d.revenue)}</td></tr>)}</tbody></table></div>
              </details>
            </>
          ) : <Skeleton h={250} />}
        </section>

        <section className="card dashboard-panel dashboard-status-panel" aria-labelledby="mix" data-ui-id="order-status">
          <div className="dashboard-panel-heading"><div><h2 id="mix">Order status</h2><p className="muted">Your orders, grouped by progress.</p></div></div>
          {s ? (!statusData.length ? <Empty icon={<Receipt size={28} aria-hidden="true" />} title="No orders yet" /> : (
            <div className="dashboard-status-body">
              <div className="dashboard-status-plot" role="img" aria-label={`Orders by status: ${statusData.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" innerRadius="60%" outerRadius="88%" paddingAngle={3} stroke="none" isAnimationActive={false}>
                      {statusData.map((d) => <Cell key={d.name} fill={STATUS_COLOR[d.name]} />)}
                    </Pie>
                    <Tooltip contentStyle={TIP} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><span className="num">{s.orders_total}</span><small className="muted">orders</small></div>
              </div>
              <ul className="legend">
                {statusData.map((d) => <li key={d.name}><i style={{ background: STATUS_COLOR[d.name] }} aria-hidden="true" /><span className="dashboard-status-label">{d.name}</span><b className="num">{d.value}</b></li>)}
              </ul>
            </div>
          )) : <Skeleton h={230} />}
        </section>
      </div>

      <section className="card flush dashboard-latest" aria-labelledby="lo" data-ui-id="latest-orders">
        <div className="dashboard-panel-heading dashboard-table-heading"><div><h2 id="lo">Latest orders</h2><p className="muted">Review recent orders and update their status.</p></div><Link to="/admin/orders" className="btn ghost sm">View all <CaretRight size={16} aria-hidden="true" /></Link></div>
        {orders.isLoading ? <div style={{ padding: 16 }}><Skeleton h={120} /></div> : orders.isError ? <ErrorState error={orders.error} retry={() => orders.refetch()} /> : !orders.data?.length ? (
          <Empty icon={<Receipt size={32} aria-hidden="true" />} title="No orders yet" hint="New orders will appear here." />
        ) : (
          <><div className="table-wrap dashboard-orders-table"><table>
            <thead><tr><th>Order</th><th>Customer / items</th><th>Placed</th><th className="r">Total</th><th>Status</th><th><span className="sr-only">Details</span></th></tr></thead>
            <tbody>{orders.data.slice(0, 6).map((o) => (
              <tr key={o.id}>
                <td className="num"><strong>#{o.id}</strong></td><td><strong className="dashboard-customer">{o.receiver_name}</strong><div className="muted dashboard-order-items">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div></td>
                <td className="muted">{fmtDateTime(o.created_at)}</td>
                <td className="r num"><strong>{peso(o.total)}</strong></td><td><StatusSelect o={o} /></td>
                <td><button className="btn sm" onClick={() => setOpen(o)} aria-label={`View order ${o.id}`}>View</button></td>
              </tr>))}
            </tbody></table></div>
            <div className="dashboard-orders-mobile">{orders.data.slice(0, 6).map((o) => <article className="dashboard-mobile-order" key={o.id}><div className="row spread"><strong>#{o.id}</strong><strong className="num">{peso(o.total)}</strong></div><div><strong className="dashboard-customer">{o.receiver_name}</strong><p className="muted dashboard-order-items">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p></div><small className="muted">{fmtDateTime(o.created_at)}</small><div className="row spread"><StatusSelect o={o} /><button className="btn sm" onClick={() => setOpen(o)} aria-label={`View order ${o.id}`}>View</button></div></article>)}</div></>
        )}
      </section>
      <div className="dashboard-secondary">
        <section className="card dashboard-panel" aria-labelledby="top">
          <div className="dashboard-panel-heading"><div><h2 id="top">Top products</h2><p className="muted">Best sellers over the last 30 days.</p></div><Link to="/admin/reports" className="btn ghost sm">Reports <CaretRight size={16} aria-hidden="true" /></Link></div>
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
        <section className="card dashboard-panel" aria-labelledby="ls">
          <div className="dashboard-panel-heading"><div><h2 id="ls">Stock watch</h2><p className="muted">Items approaching their stock limit.</p></div><Link to="/admin/products" className="btn ghost sm">Manage <CaretRight size={16} aria-hidden="true" /></Link></div>
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

      {open && <OrderDetail o={orders.data?.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} />}
    </div>
  );
}
