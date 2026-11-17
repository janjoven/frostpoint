import { ArrowLeft, FloppyDisk } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, ErrorState, Field, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { ERPRequisitionDetail, requisitionApi } from "../../lib/erpRequisitions";
import { peso } from "../../lib/format";
import { MOCK_MODE } from "../../lib/mockMode";
import { toast, useAuth } from "../../store";

export default function ERPRequisitionDetailPage() {
  const { reference = "" } = useParams();
  const user = useAuth((s) => s.user);
  const key = ["erp-requisitions", user?.id, "detail", reference];
  const query = useQuery({ queryKey: key, queryFn: () => api<ERPRequisitionDetail>(`${requisitionApi}/${encodeURIComponent(reference)}`),
    enabled: !MOCK_MODE && user?.role === "admin", retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false });
  if (MOCK_MODE) return <p>ERP records are available in the real API development mode.</p>;
  if (user?.role !== "admin") return <p role="alert">Admin access is required to review ERP requisitions.</p>;
  return <div className="admin-detail-page aml-page requisition-page">
    <Link className="aml-back-link" to="/admin/aml-network/requisitions"><ArrowLeft size={17} aria-hidden="true" /> Back</Link>
    {query.isError ? <ErrorState error={query.error} retry={() => query.refetch()} /> : query.isPending ? <Skeleton /> :
      <RequisitionForm key={`${reference}:${query.data.modified}`} record={query.data} queryKey={key} reload={() => query.refetch()} />}
  </div>;
}

function RequisitionForm({ record, queryKey, reload }: { record: ERPRequisitionDetail; queryKey: (string | number | undefined)[]; reload: () => void }) {
  const [draft, setDraft] = useState(record);
  const [dirty, setDirty] = useState(false);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => api<ERPRequisitionDetail>(`${requisitionApi}/${encodeURIComponent(record.reference)}`, { method: "PATCH", body: {
      modified: record.modified, costCenter: draft.costCenter, projectName: draft.projectName,
      requestedBy: draft.requestedBy, requesterContact: draft.requesterContact, withMR: draft.withMR,
      date: draft.date, requiredDate: draft.requiredDate,
      equipment: draft.equipment, notes: draft.notes,
      items: draft.items.map(({ id, name, uom, quantity }) => ({ id, name, uom, quantity })),
    } }),
    onSuccess: (updated) => { qc.setQueryData(queryKey, updated); qc.invalidateQueries({ queryKey: ["erp-requisitions"] }); setDraft(updated); setDirty(false); toast("Requisition saved in ERP"); },
  });
  const update = <K extends keyof ERPRequisitionDetail>(key: K, value: ERPRequisitionDetail[K]) => { setDraft((d) => ({ ...d, [key]: value })); setDirty(true); save.reset(); };
  const field = (key: "costCenter" | "projectName" | "requestedBy" | "requesterContact" | "date" | "requiredDate" | "equipment", label: string, type = "text", required = false) =>
    <Field label={label}>{(p) => <input {...p} className="input" type={type} required={required} value={draft[key]} onChange={(e) => update(key, e.target.value)} />}</Field>;
  const submit = (e: FormEvent) => { e.preventDefault(); if (record.canEdit && dirty) save.mutate(); };
  return <form className="stack requisition-form" onSubmit={submit}>
    <div className="page-title"><div><div className="row"><h1>{record.reference}</h1><span className="badge">{record.status || "No workflow state"}</span></div><p className="muted aml-subtext">Last updated in ERP: {record.modified}{dirty ? " · Unsaved changes" : ""}</p></div><div className="row"><a className="btn" href={record.erpUrl} target="_blank" rel="noreferrer">Open in ERP</a>{record.canEdit && <Button className="primary" type="submit" disabled={!dirty} loading={save.isPending}><FloppyDisk size={18} aria-hidden="true" />Save to ERP</Button>}</div></div>
    {!record.canEdit && <div className="card" role="status"><strong>Read-only access.</strong> {record.readOnlyReason}</div>}
    {save.isError && <div className="card"><ErrorState error={save.error} /><button className="btn sm" type="button" onClick={reload}>Reload from ERP (discard edits)</button></div>}
    <fieldset className="erp-edit-fields" disabled={!record.canEdit || save.isPending}>
      <div className="card flush requisition-card"><div className="requisition-fields"><div className="stack">
        {field("costCenter", "Cost Center", "text", true)}{field("projectName", "Project Name")}{field("requestedBy", "Requested By")}{field("requesterContact", "Requester Contact Number", "tel")}
        <label className="requisition-checkbox"><input type="checkbox" checked={draft.withMR} onChange={(e) => update("withMR", e.target.checked)} />With MR</label>
      </div><div className="stack">{field("date", "Date", "date")}{field("requiredDate", "Required Date", "date")}{field("equipment", "Equipment")}<Field label="Project Location">{(p) => <input {...p} className="input" readOnly value={record.projectLocation} />}</Field></div></div>
      <section className="requisition-items" aria-labelledby="erp-requisition-items"><h2 id="erp-requisition-items">Item Request</h2>
        <div className="table-wrap"><table><thead><tr><th>No.</th><th>Item Name</th><th>UOM</th><th>Quantity</th><th>Amount</th><th>Particulars / Reference</th></tr></thead><tbody>
          {draft.items.length ? draft.items.map((item, i) => <tr key={item.id}><td>{i + 1}</td>{(["name", "uom", "quantity"] as const).map((key) => <td key={key}><input className="input" aria-label={`${key === "name" ? "Item name" : key === "uom" ? "UOM" : "Quantity"} ${i + 1}`} value={item[key]} onChange={(e) => update("items", draft.items.map((row) => row.id === item.id ? { ...row, [key]: e.target.value } : row))} /></td>)}<td>{item.amount == null ? "—" : peso(item.amount)}</td><td><div>{item.particulars || "—"}</div><div className="muted">{[item.forDocument, item.itemType, item.itemOrExpense].filter(Boolean).join(" · ")}</div>{item.attachment && <span className="muted">Image attached in ERP</span>}</td></tr>) : <tr><td colSpan={6}>No items in this requisition.</td></tr>}
        </tbody></table></div>
        <p className="muted aml-subtext">Amounts, attachments and accounting references are preserved. Adding or removing ERP item rows is not available in this editor.</p>
        <Field label="Internal Notes">{(p) => <textarea {...p} className="input requisition-notes" rows={5} value={draft.notes} onChange={(e) => update("notes", e.target.value)} />}</Field>
      </section></div>
    </fieldset>
    <div className="card"><dl className="aml-details"><div><dt>Approved By</dt><dd>{record.approvedBy || "—"}</dd></div><div><dt>Approved Contact Number</dt><dd>{record.approvedContact || "—"}</dd></div></dl><p className="muted aml-subtext">Workflow approvals are managed in ERP.</p></div>
  </form>;
}
