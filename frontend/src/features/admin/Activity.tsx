import { ArrowRight, ClockCounterClockwise, MagnifyingGlass, PlusCircle, PencilSimple, Trash, CheckCircle, XCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { Empty, ErrorState, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDateTime } from "../../lib/format";

const ACTIONS = ["All", "Added", "Edited", "Deleted", "Approved", "Rejected"];
const ICON: Record<string, ReactNode> = {
  Added: <PlusCircle size={16} aria-hidden="true" />, Edited: <PencilSimple size={16} aria-hidden="true" />, Deleted: <Trash size={16} aria-hidden="true" />,
  Approved: <CheckCircle size={16} aria-hidden="true" />, Rejected: <XCircle size={16} aria-hidden="true" />,
};
const CLS: Record<string, string> = { Added: "ok", Approved: "ok", Deleted: "bad", Rejected: "bad", Edited: "warn" };

function Diff({ meta }: { meta: any }) {
  const before = meta?.before ?? (meta?.changes && Object.fromEntries(Object.entries(meta.changes).map(([k, v]: any) => [k, v.before])));
  const after = meta?.after ?? (meta?.changes && Object.fromEntries(Object.entries(meta.changes).map(([k, v]: any) => [k, v.after])));
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])).filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  if (!keys.length) return null;
  return (
    <div className="diff">
      {keys.map((k) => (
        <div key={k} style={{ display: "contents" }}>
          <span className="muted">{k}</span>
          <span className="b wrap-any">{before?.[k] === undefined ? "—" : String(before[k])}</span>
          <span className="a wrap-any"><ArrowRight size={12} aria-hidden="true" /> {after?.[k] === undefined ? "—" : String(after[k])}</span>
        </div>
      ))}
    </div>
  );
}

export default function Activity() {
  const [action, setAction] = useState("All");
  const [term, setTerm] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const qs = new URLSearchParams();
  if (action !== "All") qs.set("action", action);
  if (term) qs.set("q", term);
  if (since) qs.set("since", new Date(since).toISOString());
  if (until) qs.set("until", new Date(until + "T23:59:59").toISOString());
  const q = useQuery({ queryKey: ["activity", qs.toString()], queryFn: () => api<any[]>("/admin/activity?" + qs) });
  return (
    <div className="stack">
      <div className="page-title"><h1>Activity Log</h1></div>
      <div className="card stack">
        <div className="row">
          <label className="row nowrap grow" style={{ gap: 6 }}><MagnifyingGlass size={20} aria-hidden="true" /><span className="sr-only">Search activity</span>
            <input className="input" type="search" placeholder="Search description or user" value={term} onChange={(e) => setTerm(e.target.value)} /></label>
          <label className="field"><span className="sr-only">From date</span><input className="input" type="date" value={since} onChange={(e) => setSince(e.target.value)} aria-label="From date" /></label>
          <label className="field"><span className="sr-only">To date</span><input className="input" type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="To date" /></label>
        </div>
        <div className="pill-filters" role="group" aria-label="Filter by action">
          {ACTIONS.map((a) => <button key={a} className="pill" aria-pressed={action === a} onClick={() => setAction(a)}>{a}</button>)}
        </div>
      </div>
      <div className="card stack">
        {q.isLoading ? <Skeleton h={160} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? (
          <Empty icon={<ClockCounterClockwise size={32} aria-hidden="true" />} title="No activity found" />
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }} className="stack">
            {q.data.map((l) => (
              <li key={l.id} style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div className="row spread nowrap">
                  <span className={`badge ${CLS[l.action] ?? ""}`}>{ICON[l.action]}{l.action}</span>
                  <small className="muted">{fmtDateTime(l.created_at)}</small>
                </div>
                <p className="wrap-any" style={{ marginTop: 6 }}>{l.description}</p>
                <small className="muted">{l.user_name} · {l.user_email}</small>
                <Diff meta={l.meta} />
              </li>))}
          </ol>)}
      </div>
    </div>
  );
}
