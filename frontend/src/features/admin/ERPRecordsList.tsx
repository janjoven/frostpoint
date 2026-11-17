import { ArrowLeft, ArrowClockwise, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorState, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { employeeStatuses, paymentStates, purchaseStatuses, purchaseWorkflowStates, uniqueStates, voucherStatuses } from "../../lib/amlStatuses";
import { ERPRecordPage, ERPSection, erpRecordsApi, formatERPAmount, useERPRecordSummary } from "../../lib/erpRecords";
import { useAuth } from "../../store";

export default function ERPRecordsList({ section, title, status, statuses, field }: {
  section: ERPSection; title: string; status?: string; statuses?: string[]; field?: "status" | "workflowState";
}) {
  const user = useAuth((s) => s.user);
  const purchases = section === "purchases", employees = section === "employees";
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [state, setState] = useState(purchases && field !== "workflowState" ? "" : statuses ? "__group" : status ?? "");
  const [orderStatus, setOrderStatus] = useState(purchases && field !== "workflowState" ? status ?? "" : "");
  const [page, setPage] = useState(1);
  const summary = useERPRecordSummary(section);
  useEffect(() => { const timer = setTimeout(() => setTerm(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const params = new URLSearchParams({ search: term, page: String(page), page_size: "25" });
  (state === "__group" ? statuses ?? [] : state ? [state] : []).forEach((s) => params.append(purchases ? "workflow_state" : "status", s));
  if (purchases && orderStatus) params.append("status", orderStatus);
  const query = useQuery({ queryKey: ["erp-records", user?.id, section, "list", params.toString()],
    queryFn: () => api<ERPRecordPage>(`${erpRecordsApi}/${section}?${params}`),
    enabled: user?.role === "admin", retry: false, gcTime: 0, staleTime: 0 });
  if (user?.role !== "admin") return <p role="alert">Admin access is required to review ERP records.</p>;
  const records = query.data?.records ?? [], total = query.data?.total ?? 0;
  const defaults = employees ? employeeStatuses : section === "vouchers" ? voucherStatuses : purchases ? purchaseWorkflowStates : paymentStates;
  const stateOptions = uniqueStates([...defaults, ...(summary.data?.buckets.map((b) => purchases ? b.workflowState : b.status) ?? [])]).filter(Boolean);
  const orderOptions = uniqueStates([...purchaseStatuses, ...(summary.data?.buckets.map((b) => b.status) ?? [])]).filter(Boolean);
  const stateLabel = purchases ? "Approval Stage" : employees ? "Employee Status" : section === "vouchers" ? "Document Status" : "Workflow State";
  const pages = Math.max(1, Math.ceil(total / 25));
  return <div className="admin-detail-page aml-page">
    <Link className="aml-back-link" to="/admin/aml-network"><ArrowLeft size={17} aria-hidden="true" /> Back</Link>
    <div className="page-title"><div><div className="row"><h1>{title}</h1></div><p className="muted aml-subtext">Read-only records across all companies accessible to the ERP integration user.</p></div><div className="row"><button className="btn" disabled={query.isFetching} onClick={() => { query.refetch(); summary.refetch(); }}><ArrowClockwise size={18} aria-hidden="true" />Refresh</button>{section === "payments" && <Link className="btn primary" to="/admin/aml-network/new-direct-payment-order"><Plus size={18} />Add Direct Payment Order</Link>}</div></div>
    {purchases && <p className="muted aml-subtext">Approval Stage and Order Status are separate ERP fields.</p>}
    {statuses && <details className="aml-mapping-note"><summary>Included workflow states</summary><ul>{statuses.map((s) => <li key={s}>{s}</li>)}</ul></details>}
    <section className="card flush" aria-label={title}>
      <div className="aml-toolbar"><label className="catalog-search aml-search"><MagnifyingGlass size={19} aria-hidden="true" /><span className="sr-only">Search {title}</span><input type="search" className="input" placeholder="Search reference, name or company…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label>
        <div className="row aml-status-filters"><label className="field"><span className="lbl">{stateLabel}</span><select className="input" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}><option value="">All {purchases || section === "payments" ? "workflow states" : "statuses"}</option>{statuses && <option value="__group">{title} (group)</option>}{stateOptions.map((s) => <option key={s}>{s}</option>)}</select></label>
          {purchases && <label className="field"><span className="lbl">Order Status</span><select className="input" value={orderStatus} onChange={(e) => { setOrderStatus(e.target.value); setPage(1); }}><option value="">All order statuses</option>{orderOptions.map((s) => <option key={s}>{s}</option>)}</select></label>}</div>
      </div>
      {query.isError ? <ErrorState error={query.error} retry={() => query.refetch()} /> : query.isPending ? <Skeleton /> : <>
        <p className="aml-record-count muted" role="status">{total} {employees ? "employees" : "records"} · ERP · All companies{query.isFetching ? " · Updating…" : ""}</p>
        {!records.length ? <Empty icon={<MagnifyingGlass size={32} aria-hidden="true" />} title="No matching ERP records" hint="Try another search or change the filters." /> : <div className="table-wrap admin-users-table"><table>
          <thead><tr><th>{employees ? "Employee" : "Reference"}</th><th>{employees ? "Department / Designation" : purchases ? "Supplier" : section === "vouchers" ? "Party" : "Payee"}</th><th>Company</th>{!employees && <><th>Date</th><th>Amount{section === "payments" ? " (Company Currency)" : section === "vouchers" ? " Paid" : ""}</th></>}{purchases && <th>Approval Stage</th>}<th>{purchases ? "Order Status" : stateLabel}</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{records.map((record) => {
            const to = `/admin/aml-network/records/${section}/${encodeURIComponent(record.reference)}`;
            return <tr key={record.reference}><td data-label={employees ? "Employee" : "Reference"}><Link className="aml-reference" to={to}>{employees ? record.name || record.reference : record.reference}</Link>{employees && <div className="muted aml-table-subtext">{record.reference}</div>}</td>
              <td data-label={employees ? "Department / Designation" : purchases ? "Supplier" : "Party"}>{employees ? <>{record.department || "—"}<div className="muted aml-table-subtext">{record.designation || "—"}</div></> : record.name || "—"}</td><td data-label="Company">{record.company || "—"}</td>
              {!employees && <><td data-label="Date">{record.date || "—"}</td><td data-label="Amount" className="num">{formatERPAmount(record.amount, record.currency)}</td></>}
              {purchases && <td data-label="Approval Stage"><span className="badge">{record.workflowState || "—"}</span></td>}
              <td data-label={purchases ? "Order Status" : stateLabel}><span className={`badge ${/pending|draft|returned/i.test(record.status) ? "warn" : /cancel|left/i.test(record.status) ? "bad" : ""}`}>{record.status || "—"}</span></td><td data-label="Actions"><Link className="btn sm" to={to}>Review</Link></td></tr>;
          })}</tbody>
        </table></div>}
        <div className="row spread aml-toolbar"><button className="btn sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="btn sm" disabled={page >= pages || query.isFetching} onClick={() => setPage(page + 1)}>Next</button></div>
      </>}
    </section>
  </div>;
}
