import { ArrowLeft, FileText, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, Modal } from "../../components/ui";
import { loadDraft } from "./RequisitionSlip";
import { matchesCard, requisitionStates } from "../../lib/amlStatuses";

type Requisition = {
  reference: string; status: string; projectName: string; withMR: boolean;
  requestedBy: string; costCenter: string; date: string; local?: boolean;
};
const samples: Requisition[] = [
  { reference: "RS-2026-000417", status: "Pending", projectName: "", withMR: false, requestedBy: "Rico Staff", costCenter: "Operations", date: "2026-11-13" },
  { reference: "RS-2026-000416", status: "Pending", projectName: "PRAC-0177", withMR: false, requestedBy: "Alex Admin", costCenter: "Administration", date: "2026-11-13" },
  { reference: "RS-2026-000414", status: "Pending", projectName: "PRAC-0032", withMR: false, requestedBy: "Rico Staff", costCenter: "Operations", date: "2026-11-12" },
  { reference: "RS-2026-000411", status: "Pending", projectName: "", withMR: true, requestedBy: "Ramil Rider", costCenter: "Delivery", date: "2026-11-11" },
  { reference: "RS-2026-000407", status: "Pending in RS Support", projectName: "PRAC-0198", withMR: false, requestedBy: "Rico Staff", costCenter: "Operations", date: "2026-11-09" },
  { reference: "RS-2026-000406", status: "Returned to Requestor", projectName: "PRAC-0031", withMR: false, requestedBy: "Rico Staff", costCenter: "Operations", date: "2026-11-09" },
  { reference: "RS-2026-000405", status: "For MR/DPO", projectName: "PRAC-0177", withMR: true, requestedBy: "Alex Admin", costCenter: "Administration", date: "2026-11-08" },
];
export function getRequisitions(): Requisition[] {
  const draft = loadDraft();
  return draft.costCenter.trim() ? [{ reference: "LOCAL-DRAFT", status: "Draft", projectName: draft.projectName, withMR: draft.withMR, requestedBy: draft.requestedBy, costCenter: draft.costCenter, date: draft.date, local: true }, ...samples] : samples;
}

export default function RequisitionList({ title, status, statuses }: { title: string; status?: string; statuses?: string[] }) {
  const [search, setSearch] = useState("");
  const [withMR, setWithMR] = useState(false);
  const [statusFilter, setStatusFilter] = useState(statuses ? "__group" : status ?? "");
  const [preview, setPreview] = useState<Requisition | null>(null);
  const term = search.trim().toLowerCase();
  const records = getRequisitions().filter((record) =>
    (statusFilter === "__group" ? matchesCard(record.status, undefined, statuses) : !statusFilter || record.status === statusFilter) && (!withMR || record.withMR) &&
    [record.reference, record.projectName, record.requestedBy, record.costCenter, record.status].some((value) => value.toLowerCase().includes(term))
  );
  return <div className="admin-detail-page aml-page">
    <Link className="aml-back-link" to="/admin/aml-network"><ArrowLeft size={17} aria-hidden="true" /> AML Network</Link>
    <div className="page-title"><div><div className="row"><h1>{title}</h1><span className="badge">Mock preview</span></div><p className="muted aml-subtext">Review requisition slips, projects and approval status.</p></div><Link className="btn primary" to="/admin/aml-network/new-requisition"><Plus size={18} aria-hidden="true" /><strong>Add New Requisition Slip</strong></Link></div>
    {statuses && <details className="aml-mapping-note"><summary>Proposed group · {statuses.length} workflow states</summary><p className="muted aml-subtext">Includes pending and forwarded approval stages; mapping awaits ERP review.</p><ul>{statuses.map((state) => <li key={state}>{state}</li>)}</ul></details>}
    <section className="card flush" aria-label="Requisition slips">
      <div className="aml-toolbar">
        <label className="catalog-search aml-search"><MagnifyingGlass size={19} aria-hidden="true" /><span className="sr-only">Search requisitions</span><input type="search" className="input" placeholder="Search ID, project or requester…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="row requisition-list-filters">
          <label className="requisition-checkbox"><input type="checkbox" checked={withMR} onChange={(event) => setWithMR(event.target.checked)} />With MR</label>
          <label><span className="sr-only">Filter by workflow state</span><select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All workflow states and local drafts</option>{statuses && <option value="__group">{title} (group)</option>}{requisitionStates.map((state) => <option key={state}>{state}</option>)}<option value="Draft">Draft (browser-local only)</option></select></label>
        </div>
      </div>
      <p className="aml-record-count muted" role="status">{records.length} {records.length === 1 ? "requisition" : "requisitions"} · Sample records and your browser-local draft</p>
      {!records.length ? <Empty icon={<FileText size={32} aria-hidden="true" />} title="No matching requisitions" hint="Try another search or change the filters." /> : <div className="table-wrap admin-users-table"><table>
        <thead><tr><th>ID</th><th>Status</th><th>Project Name</th><th>With MR</th><th>Requested By</th><th>Date</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{records.map((record) => <tr key={record.reference}>
          <td data-label="ID"><button type="button" className="aml-reference requisition-reference-button" onClick={() => setPreview(record)}>{record.reference}</button>{record.local && <div className="muted aml-table-subtext">Saved in this browser</div>}</td>
          <td data-label="Status"><span className={`badge ${/pending|returned/i.test(record.status) ? "warn" : record.status === "For MR/DPO" ? "ok" : ""}`}>{record.status}</span></td>
          <td data-label="Project Name">{record.projectName || "—"}</td>
          <td data-label="With MR"><span aria-label={record.withMR ? "With MR: Yes" : "With MR: No"}>{record.withMR ? "Yes" : "No"}</span></td>
          <td data-label="Requested By">{record.requestedBy || "—"}</td><td data-label="Date">{record.date || "—"}</td>
          <td data-label="Actions">{record.local ? <Link className="btn sm" to="/admin/aml-network/new-requisition">Edit draft</Link> : <button type="button" className="btn sm" aria-label={`View ${record.reference}`} onClick={() => setPreview(record)}>View details</button>}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    <p className="muted aml-subtext">ERP records are shown as samples. Live ERP syncing is not connected yet.</p>
    {preview && <Modal title={preview.reference} onClose={() => setPreview(null)}><p className="muted aml-subtext">{preview.local ? "Browser-local draft" : "Sample requisition"}</p><dl className="aml-details">{Object.entries({ Status: preview.status, "Cost Center": preview.costCenter, "Project Name": preview.projectName || "—", "Requested By": preview.requestedBy || "—", "With MR": preview.withMR ? "Yes" : "No", Date: preview.date || "—" }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="admin-form-actions">{preview.local && <Link className="btn" to="/admin/aml-network/new-requisition">Edit draft</Link>}<button type="button" className="btn primary" onClick={() => setPreview(null)}>Close</button></div></Modal>}
  </div>;
}
