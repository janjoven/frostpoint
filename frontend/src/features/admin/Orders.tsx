import { MagnifyingGlass, Receipt } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Empty, ErrorState, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDateTime, isOpen, PAY_LABEL, PAY_TONE, peso } from "../../lib/format";
import { Order, OrderDetail, StatusSelect } from "./OrderParts";

const FILTERS = ["All", "Pending", "Completed", "Cancelled"] as const;

export default function Orders() {
  const q = useQuery({ queryKey: ["orders", "all"], queryFn: () => api<Order[]>("/orders") });
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState<Order | null>(null);

  const rows = (q.data ?? []).filter((o) => {
    if (f === "Pending" && !isOpen(o.status)) return false;
    if (f === "Completed" && o.status !== "Delivered Successfully") return false;
    if (f === "Cancelled" && o.status !== "Cancelled") return false;
    const t = term.trim().toLowerCase();
    return !t || `${o.id} ${o.receiver_name} ${o.phone}`.toLowerCase().includes(t);
  });

  return (
    <div className="stack">
      <div className="page-title"><h1>Orders</h1></div>
      <div className="row spread">
        <div className="pill-filters" role="group" aria-label="Filter orders">
          {FILTERS.map((x) => <button key={x} className="pill" aria-pressed={f === x} onClick={() => setF(x)}>{x}</button>)}
        </div>
        <label className="row nowrap" style={{ gap: 6 }}>
          <MagnifyingGlass size={20} aria-hidden="true" /><span className="sr-only">Search orders</span>
          <input className="input" placeholder="Search # or name" value={term} onChange={(e) => setTerm(e.target.value)} type="search" />
        </label>
      </div>
      <div className="card flush">
        {q.isLoading ? <div style={{ padding: 16 }}><Skeleton h={200} /></div> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !rows.length ? (
          <Empty icon={<Receipt size={32} aria-hidden="true" />} title="No orders match" hint="Try another filter or search." />
        ) : (
          <div className="table-wrap"><table>
            <thead><tr><th>#</th><th>Customer</th><th>Items</th><th>Mode</th><th>Payment</th><th className="r">Total</th><th>Status</th><th><span className="sr-only">Details</span></th></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.id}>
                <td className="num">{o.id}</td>
                <td>{o.receiver_name}<div className="muted" style={{ fontSize: 13 }}>{fmtDateTime(o.created_at)}</div></td>
                <td className="muted">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</td>
                <td>{o.mode}{o.rider_name && <div className="muted" style={{ fontSize: 13 }}>{o.rider_name}</div>}</td>
                <td>{o.payment_method}<div><span className={`badge ${PAY_TONE[o.payment_status] ?? ""}`}>{PAY_LABEL[o.payment_status] ?? o.payment_status}</span></div></td>
                <td className="r num">{peso(o.total)}</td><td><StatusSelect o={o} /></td>
                <td><button className="btn sm" onClick={() => setOpen(o)} aria-label={`View order ${o.id}`}>View</button></td>
              </tr>))}
            </tbody></table></div>
        )}
      </div>
      {open && <OrderDetail o={q.data!.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} />}
    </div>
  );
}
