import { ArrowLeft, ArrowClockwise, FileText, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorState, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { requisitionStates } from "../../lib/amlStatuses";
import { ERPRequisitionPage, requisitionApi } from "../../lib/erpRequisitions";
import { useAuth } from "../../store";

export default function ERPRequisitionList({ title, status, statuses }: { title: string; status?: string; statuses?: string[] }) {
  const user = useAuth((s) => s.user);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [withMR, setWithMR] = useState(false);
  const [state, setState] = useState(statuses ? "__group" : status ?? "");
  const [page, setPage] = useState(1);
  useEffect(() => { const timer = setTimeout(() => setTerm(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const params = new URLSearchParams({ search: term, with_mr: String(withMR), page: String(page), page_size: "25" });
  (state === "__group" ? statuses ?? [] : state ? [state] : []).forEach((s) => params.append("status", s));
  const query = useQuery({
    queryKey: ["erp-requisitions", user?.id, "list", params.toString()],
    queryFn: () => api<ERPRequisitionPage>(`${requisitionApi}?${params}`),
    enabled: user?.role === "admin", retry: false, staleTime: 0, gcTime: 0,
  });
  if (user?.role !== "admin") return <p role="alert">Admin access is required to review ERP requisitions.</p>;
  const records = query.data?.records ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));
  return <div className="admin-detail-page aml-page">
    <Link className="aml-back-link" to="/admin/aml-network"><ArrowLeft size={17} aria-hidden="true" /> Back</Link>
    <div className="page-title"><div><div className="row"><h1>{title}</h1></div><p className="muted aml-subtext">Review requests created by Frostpoint.</p></div><div className="row"><button className="btn" disabled={query.isFetching} onClick={() => query.refetch()}><ArrowClockwise size={18} aria-hidden="true" />Refresh</button><Link className="btn primary" to="/admin/aml-network/new-requisition"><Plus size={18} aria-hidden="true" />Add Requisition Slip</Link></div></div>
    {statuses && <details className="aml-mapping-note"><summary>Included workflow states</summary><p className="muted aml-subtext">This card groups pending and forwarded stages.</p><ul>{statuses.map((s) => <li key={s}>{s}</li>)}</ul></details>}
    <section className="card flush" aria-label="ERP requisition slips">
      <div className="aml-toolbar">
        <label className="catalog-search aml-search"><MagnifyingGlass size={19} aria-hidden="true" /><span className="sr-only">Search ERP requisitions</span><input type="search" className="input" placeholder="Search ID, project or requester…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label>
        <div className="row requisition-list-filters"><label className="requisition-checkbox"><input type="checkbox" checked={withMR} onChange={(e) => { setWithMR(e.target.checked); setPage(1); }} />With MR</label>
          <label><span className="sr-only">Filter by workflow state</span><select className="input" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}><option value="">All workflow states</option>{statuses && <option value="__group">{title} (group)</option>}{requisitionStates.map((s) => <option key={s}>{s}</option>)}</select></label></div>
      </div>
      {query.isError ? <ErrorState error={query.error} retry={() => query.refetch()} /> : query.isPending ? <Skeleton /> : <>
        <p className="aml-record-count muted" role="status">{total} {total === 1 ? "requisition" : "requisitions"} · ERP · {query.data?.prefix ? `${query.data.prefix} scope` : "All companies"}{query.isFetching ? " · Updating…" : ""}</p>
        {!records.length ? <Empty icon={<FileText size={32} aria-hidden="true" />} title="No matching ERP requisitions" hint="Try another search or change the filters." /> : <div className="table-wrap admin-users-table"><table>
          <thead><tr><th>ID</th><th>Status</th><th>Project Name</th><th>With MR</th><th>Requested By</th><th>Date</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{records.map((record) => {
            const to = `/admin/aml-network/requisitions/${encodeURIComponent(record.reference)}`;
            return <tr key={record.reference}><td data-label="ID"><Link className="aml-reference" to={to}>{record.reference}</Link></td><td data-label="Status"><span className={`badge ${/pending|returned/i.test(record.status) ? "warn" : ""}`}>{record.status || "—"}</span></td><td data-label="Project Name">{record.projectName || "—"}</td><td data-label="With MR">{record.withMR ? "Yes" : "No"}</td><td data-label="Requested By">{record.requestedBy || "—"}</td><td data-label="Date">{record.date || "—"}</td><td data-label="Actions"><Link className="btn sm" to={to}>Review</Link></td></tr>;
          })}</tbody>
        </table></div>}
        <div className="row spread aml-toolbar"><button className="btn sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="btn sm" disabled={page >= pages || query.isFetching} onClick={() => setPage(page + 1)}>Next</button></div>
      </>}
    </section>
    <p className="muted aml-subtext">This list shows Frostpoint's FRP- requisitions. ACCSYS and other request sources remain available in ERP.</p>
  </div>;
}
