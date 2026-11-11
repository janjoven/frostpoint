import { FileArrowDown, FilePdf, Printer } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, ErrorState, Skeleton } from "../../components/ui";
import { api, download } from "../../lib/api";
import { peso } from "../../lib/format";
import { toast } from "../../store";

const PERIODS = ["daily", "weekly", "monthly", "yearly"] as const;

export default function Reports() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("weekly");
  const [busy, setBusy] = useState("");
  const q = useQuery({ queryKey: ["report", period], queryFn: () => api(`/admin/reports/${period}`) });
  const d = q.data;

  async function xlsx() {
    setBusy("xlsx");
    try { await download(`/admin/reports/${period}/export.xlsx`, `frostpoint-${period}.xlsx`); } catch (e) { toast((e as Error).message); }
    setBusy("");
  }
  async function pdf() {
    if (!d) return;
    setBusy("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      doc.setFontSize(18); doc.text(`FROSTPOINT — ${period} report`, 14, 18);
      doc.setFontSize(11);
      doc.text(`Revenue: PHP ${d.revenue.toFixed(2)}   Orders: ${d.orders}   Avg: PHP ${d.average.toFixed(2)}`, 14, 28);
      let y = 42;
      doc.text("Product", 14, y); doc.text("Qty", 110, y); doc.text("Total", 160, y);
      d.products.forEach((p: any) => { y += 8; doc.text(String(p.name), 14, y); doc.text(String(p.qty), 110, y); doc.text(`PHP ${p.total.toFixed(2)}`, 160, y); });
      doc.save(`frostpoint-${period}.pdf`);
    } catch { toast("PDF export failed"); }
    setBusy("");
  }

  return (
    <div className="stack">
      <div className="page-title">
        <h1>Reports</h1>
        <div className="row">
          <Button onClick={pdf} loading={busy === "pdf"} disabled={!d}><FilePdf size={20} aria-hidden="true" /> PDF</Button>
          <Button onClick={xlsx} loading={busy === "xlsx"}><FileArrowDown size={20} aria-hidden="true" /> Excel</Button>
          <button className="btn" onClick={() => window.print()}><Printer size={20} aria-hidden="true" /> Print</button>
        </div>
      </div>
      <div className="admin-orders-filters report-period-filters" role="group" aria-label="Report period">
        {PERIODS.map((p) => <button type="button" key={p} aria-pressed={period === p} onClick={() => setPeriod(p)} style={{ textTransform: "capitalize" }}>{p}</button>)}
      </div>
      {q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <>
          <div className="grid kpis">
            {[["Revenue", d && peso(d.revenue)], ["Orders", d?.orders], ["Average order", d && peso(d.average)], ["Delivery fees", d && peso(d.delivery_fees)]].map(([l, v]) => (
              <div className="card kpi" key={l as string}><span className="l">{l}</span>{v === undefined ? <Skeleton h={30} w="60%" /> : <span className="v">{v}</span>}</div>
            ))}
          </div>
          <section className="card" aria-labelledby="tr">
            <h2 id="tr" style={{ marginBottom: 12 }}>Revenue trend</h2>
            {d ? (
              <div role="img" aria-label={`Bar chart of ${period} revenue. Total ${peso(d.revenue)} from ${d.orders} orders.`} style={{ height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={d.series}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={20} />
                    <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} width={48} tickFormatter={(v) => `₱${v}`} />
                    <Tooltip formatter={(v: number) => [peso(v), "Revenue"]} contentStyle={{ background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <Skeleton h={240} />}
          </section>
          <section className="card flush" aria-labelledby="pb">
            <h2 id="pb" style={{ padding: 16 }}>Product breakdown</h2>
            <div className="table-wrap"><table>
              <thead><tr><th>Product</th><th className="r">Qty × Price</th><th className="r">Total</th></tr></thead>
              <tbody>
                {d?.products.map((p: any) => <tr key={p.name}><td>{p.name}</td><td className="r num">{p.qty} × {peso(p.price)}</td><td className="r num">{peso(p.total)}</td></tr>)}
                {d && !d.products.length && <tr><td colSpan={3} className="muted" style={{ textAlign: "center", padding: 24 }}>No sales in this period.</td></tr>}
              </tbody></table></div>
          </section>
        </>
      )}
    </div>
  );
}
