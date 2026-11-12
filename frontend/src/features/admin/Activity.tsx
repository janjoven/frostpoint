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
const diffValue = (value: unknown) => value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);

function Diff({ meta }: { meta: any }) {
  const before = meta?.before ?? (meta?.changes && Object.fromEntries(Object.entries(meta.changes).map(([k, v]: any) => [k, v.before])));
  const after = meta?.after ?? (meta?.changes && Object.fromEntries(Object.entries(meta.changes).map(([k, v]: any) => [k, v.after])));
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])).filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  if (!keys.length) return null;
  return (
    <div className="diff">
      {keys.map((k) => (
        <div key={k} style={{ display: "contents" }}>
          <span className="muted activity-change-field">{k.replace(/_/g, " ")}</span>
          <span className="b wrap-any" aria-label={`Previous value: ${diffValue(before?.[k])}`}>{diffValue(before?.[k])}</span>
          <span className="a wrap-any" aria-label={`New value: ${diffValue(after?.[k])}`}><ArrowRight size={12} aria-hidden="true" /> {diffValue(after?.[k])}</span>
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
    <div className="admin-detail-page admin-activity-page">
      <div className="page-title"><h1>Activity Log</h1></div>
      <div className="card stack admin-activity-controls">
        <div className="admin-activity-filters">
          <label className="field activity-search-field"><span className="lbl">Search activity</span><span className="catalog-search"><MagnifyingGlass size={20} aria-hidden="true" />
            <input className="input" type="search" placeholder="Search description or user" value={term} onChange={(e) => setTerm(e.target.value)} /></span></label>
          <label className="field"><span className="lbl">From date</span><input className="input" type="date" value={since} max={until || undefined} onChange={(e) => setSince(e.target.value)} /></label>
          <label className="field"><span className="lbl">To date</span><input className="input" type="date" value={until} min={since || undefined} onChange={(e) => setUntil(e.target.value)} /></label>
        </div>
        <div className="pill-filters admin-activity-actions" role="group" aria-label="Filter by action">
          {ACTIONS.map((a) => <button key={a} className="pill" aria-pressed={action === a} onClick={() => setAction(a)}>{a}</button>)}
        </div>
      </div>
      <div className="card admin-activity-results">
        {q.isLoading ? <Skeleton h={160} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? (
          <Empty icon={<ClockCounterClockwise size={32} aria-hidden="true" />} title="No activity found" />
        ) : (
          <ol className="admin-activity-list">
            {q.data.map((l) => (
              <li key={l.id}>
                <div className="row spread activity-entry-header">
                  <span className={`badge ${CLS[l.action] ?? ""}`}>{ICON[l.action]}{l.action}</span>
                  <time className="muted" dateTime={l.created_at}>{fmtDateTime(l.created_at)}</time>
                </div>
                <p className="wrap-any activity-description">{l.description}</p>
                <div className="activity-actor muted"><span>{l.user_name}</span><span>{l.user_email}</span></div>
                <Diff meta={l.meta} />
              </li>))}
          </ol>)}
      </div>
    </div>
  );
}
