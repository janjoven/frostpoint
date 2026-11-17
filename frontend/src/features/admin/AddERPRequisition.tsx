import { ArrowLeft, Plus, Trash } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Field } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { requisitionApi } from "../../lib/erpRequisitions";
import { toast, useAuth } from "../../store";

type Item = { id: string; name: string; uom: string; quantity: string };
type Slip = { costCenter: string; date: string; projectName: string; requiredDate: string; requestedBy: string;
  requesterContact: string; withMR: boolean; equipment: string; notes: string; items: Item[] };
type Capabilities = { canCreate: boolean; blockedReason: string; namingSeries: string; prefix: string };
type Submission = { state: string; reference: string; replayed?: boolean };
const STORAGE = "fp-erp-requisition-create-v1";

function initial(name: string): { slip: Slip; requestId: string; uncertain: boolean } {
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const defaults: Slip = { costCenter: "", date: today, projectName: "", requiredDate: "", requestedBy: name,
    requesterContact: "", withMR: false, equipment: "", notes: "", items: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
    const legacy = JSON.parse(localStorage.getItem("fp-aml-requisition-draft-v1") ?? "null");
    const source = saved?.slip ?? legacy;
    const slip = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof Slip)[]) {
      if (key === "items") continue;
      if (typeof source?.[key] === typeof defaults[key]) (slip as any)[key] = source[key];
    }
    slip.date ||= today; slip.requestedBy ||= name;
    if (Array.isArray(source?.items)) slip.items = source.items.filter((item: Item) => item && [item.id, item.name, item.uom, item.quantity].every((v) => typeof v === "string"));
    return { slip, requestId: typeof saved?.requestId === "string" && /^[\da-f-]{36}$/i.test(saved.requestId) ? saved.requestId : crypto.randomUUID(), uncertain: saved?.uncertain === true };
  } catch { return { slip: defaults, requestId: crypto.randomUUID(), uncertain: false }; }
}

function ERPLinkInput({ kind, label, value, onChange, required = false }: {
  kind: "cost-centers" | "projects" | "uoms" | "equipment"; label: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  const user = useAuth((s) => s.user);
  const [search, setSearch] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setSearch(value.trim()), 300); return () => clearTimeout(timer); }, [value]);
  const query = useQuery({ queryKey: ["erp-requisition-lookups", user?.id, kind, search],
    queryFn: () => api<{ options: { value: string; label: string; description: string }[] }>(`${requisitionApi}/lookups/${kind}?search=${encodeURIComponent(search)}`),
    retry: false, staleTime: 30000, gcTime: 0 });
  return <Field label={label} help={query.isError ? "ERP lookup unavailable. The integration user needs Select permission for this field's records." : "Choose an ERP value, or enter its exact ID."}>{(p) => <>
    <input {...p} className="input" list={`${p.id}-values`} value={value} required={required} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
    <datalist id={`${p.id}-values`}>{query.data?.options.map((o) => <option key={o.value} value={o.value}>{o.label} {o.description}</option>)}</datalist>
  </>}</Field>;
}

export default function AddERPRequisition() {
  const user = useAuth((s) => s.user);
  const [draft, setDraft] = useState(() => initial(user?.name ?? ""));
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const caps = useQuery({ queryKey: ["erp-requisitions", user?.id, "capabilities"],
    queryFn: () => api<Capabilities>(`${requisitionApi}/capabilities`), enabled: user?.role === "admin", retry: false, gcTime: 0, staleTime: 0 });
  useEffect(() => { try { localStorage.setItem(STORAGE, JSON.stringify(draft)); setStorageError(false); } catch { setStorageError(true); } }, [draft]);
  const finish = (result: Submission) => {
    if (result.state !== "created") { setMessage(result.state === "failed" ? "ERP rejected the previous request. You can correct it and try again." : "The submission is not confirmed yet. Keep the same submission ID and check again.");
      if (result.state === "failed") setDraft((d) => ({ ...d, uncertain: false })); return; }
    try { localStorage.removeItem(STORAGE); localStorage.removeItem("fp-aml-requisition-draft-v1"); } catch { /* creation already succeeded */ }
    qc.invalidateQueries({ queryKey: ["erp-requisitions"] });
    toast(`${result.reference} created in ERP`);
    navigate(`/admin/aml-network/requisitions/${encodeURIComponent(result.reference)}`);
  };
  const create = useMutation({ mutationFn: () => {
    // Persist the exact submission ID BEFORE transmitting, including recovery after a tab closes.
    try { localStorage.setItem(STORAGE, JSON.stringify({ ...draft, uncertain: true })); } catch { setStorageError(true); }
    return api<Submission>(requisitionApi, { method: "POST", body: {
    requestId: draft.requestId, ...draft.slip, requiredDate: draft.slip.requiredDate || null,
    items: draft.slip.items.map(({ name, uom, quantity }) => ({ name, uom, quantity })),
  } }); }, onSuccess: finish, onError: (error) => {
    setMessage(error.message);
    if (!(error instanceof ApiError) || [0, 409, 500, 502, 503, 504].includes(error.status)) setDraft((d) => ({ ...d, uncertain: true }));
    else if (!draft.uncertain) setDraft((d) => ({ ...d, uncertain: false }));
  }, retry: false });
  const check = useMutation({ mutationFn: () => api<Submission>(`${requisitionApi}/submissions/${draft.requestId}`), onSuccess: finish,
    onError: (e) => setMessage(`${e.message} Keep this submission ID and retry the same submission when the connection returns.`) });
  const locked = create.isPending || check.isPending || draft.uncertain;
  function update<K extends keyof Slip>(key: K, value: Slip[K]) {
    if (locked) return;
    setDraft((d) => ({ ...d, slip: { ...d.slip, [key]: value }, requestId: crypto.randomUUID() }));
    setMessage(""); create.reset();
  }
  const slip = draft.slip;
  function submit(e: FormEvent) { e.preventDefault(); if (!slip.items.length) { setMessage("Add at least one requested item."); return; } if (caps.data?.canCreate && !create.isPending) { setMessage(""); create.mutate(); } }
  const field = (key: "date" | "requiredDate" | "requestedBy" | "requesterContact", label: string, type = "text", required = false) =>
    <Field label={label}>{(p) => <input {...p} className="input" type={type} required={required} value={slip[key]} onChange={(e) => update(key, e.target.value)} />}</Field>;
  if (user?.role !== "admin") return <p role="alert">Admin access is required to create ERP requisitions.</p>;
  return <div className="admin-detail-page aml-page requisition-page"><Link className="aml-back-link" to="/admin/aml-network/requisitions"><ArrowLeft size={17} aria-hidden="true" /> Back</Link>
    <form className="stack requisition-form" onSubmit={submit}>
      <div className="page-title"><div><div className="row"><h1>Add Requisition Slip</h1><span className="badge">FROSTPOINT · FRP-</span></div><p className="muted aml-subtext">Create a Frostpoint request in ERP. ERP assigns its ID and initial workflow state.</p></div><Button type="submit" className="primary" loading={create.isPending} disabled={!caps.data?.canCreate || check.isPending}><Plus size={18} aria-hidden="true" />{draft.uncertain ? "Retry Same Submission" : "Create in ERP"}</Button></div>
      {!caps.data?.canCreate && <div className="card" role="status"><p>{caps.isError ? (caps.error as Error).message : caps.isPending ? "Checking ERP Create permission…" : caps.data?.blockedReason}</p><button type="button" className="btn sm" onClick={() => caps.refetch()} disabled={caps.isFetching}>Check permission again</button></div>}
      {storageError && <p className="err" role="alert">This browser could not save recovery information. Keep this page open until the submission is confirmed.</p>}
      {message && <p className="err" role="alert">{message}</p>}
      {draft.uncertain && <div className="card"><p>The previous submission needs confirmation. Its contents are locked to prevent accidental duplicates.</p><p className="muted">Submission ID: {draft.requestId}</p><Button type="button" loading={check.isPending} disabled={create.isPending} onClick={() => check.mutate()}>Check ERP Submission Status</Button></div>}
      <fieldset className="erp-edit-fields" disabled={locked}><div className="card flush requisition-card"><div className="requisition-fields"><div className="stack">
        <ERPLinkInput kind="cost-centers" label="Cost Center" required value={slip.costCenter} onChange={(v) => update("costCenter", v)} />
        <ERPLinkInput kind="projects" label="Project Name" value={slip.projectName} onChange={(v) => update("projectName", v)} />
        {field("requestedBy", "Requested By", "text", true)}{field("requesterContact", "Requester Contact Number", "tel")}
        <label className="requisition-checkbox"><input type="checkbox" checked={slip.withMR} onChange={(e) => update("withMR", e.target.checked)} />With MR</label>
      </div><div className="stack">{field("date", "Date", "date", true)}{field("requiredDate", "Required Date", "date")}<ERPLinkInput kind="equipment" label="Equipment" value={slip.equipment} onChange={(v) => update("equipment", v)} /></div></div>
      <section className="requisition-items" aria-labelledby="create-requisition-items"><h2 id="create-requisition-items">Item Request</h2><div className="table-wrap"><table><thead><tr><th>No.</th><th>Item Name</th><th>UOM</th><th>Quantity</th><th>Actions</th></tr></thead><tbody>{slip.items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><input className="input" required aria-label={`Item name ${index + 1}`} value={item.name} onChange={(e) => update("items", slip.items.map((i) => i.id === item.id ? { ...i, name: e.target.value } : i))} /></td><td><ERPLinkInput kind="uoms" label={`UOM ${index + 1}`} required value={item.uom} onChange={(v) => update("items", slip.items.map((i) => i.id === item.id ? { ...i, uom: v } : i))} /></td><td><input className="input" type="number" min="0.001" step="0.001" required aria-label={`Quantity ${index + 1}`} value={item.quantity} onChange={(e) => update("items", slip.items.map((i) => i.id === item.id ? { ...i, quantity: e.target.value } : i))} /></td><td><button type="button" className="btn ghost icon" aria-label={`Remove item ${index + 1}`} onClick={() => update("items", slip.items.filter((i) => i.id !== item.id))}><Trash size={18} /></button></td></tr>)}</tbody></table></div>
        {!slip.items.length && <p className="muted">Add the items you need before creating the requisition.</p>}<button type="button" className="btn sm" onClick={() => update("items", [...slip.items, { id: crypto.randomUUID(), name: "", uom: "", quantity: "1" }])}><Plus size={16} />Add Row</button>
        <Field label="Internal Notes">{(p) => <textarea {...p} className="input requisition-notes" rows={4} value={slip.notes} onChange={(e) => update("notes", e.target.value)} />}</Field>
      </section></div></fieldset>
      <p className="muted aml-subtext">Your unfinished form is kept in this browser. Create in ERP sends it to the connected ERP system; approvals are handled by ERP.</p>
    </form></div>;
}
