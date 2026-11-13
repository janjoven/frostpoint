import { ArrowLeft, ClipboardText, FloppyDisk, Plus, Trash } from "@phosphor-icons/react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "../../components/ui";

type Item = { id: string; name: string; uom: string; quantity: string };
type Slip = {
  costCenter: string; date: string; projectName: string; requiredDate: string;
  requestedBy: string; approvedBy: string; requesterContact: string; approvedContact: string;
  withMR: boolean; equipment: string; items: Item[]; notes: string;
};
const DRAFT_KEY = "fp-aml-requisition-draft-v1";
const emptySlip = (): Slip => ({
  costCenter: "", date: "", projectName: "", requiredDate: "", requestedBy: "", approvedBy: "",
  requesterContact: "", approvedContact: "", withMR: false, equipment: "", items: [], notes: "",
});
export function loadDraft(): Slip {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    const initial = emptySlip();
    if (!saved || typeof saved !== "object") return initial;
    for (const key of Object.keys(initial) as (keyof Slip)[]) {
      if (key === "items") continue;
      if (typeof saved[key] !== typeof initial[key]) return initial;
    }
    if (!Array.isArray(saved.items) || !saved.items.every((item: Item) => item && [item.id, item.name, item.uom, item.quantity].every((value) => typeof value === "string"))) return initial;
    return { ...initial, ...saved };
  } catch { return emptySlip(); }
}

export default function RequisitionSlip() {
  const [slip, setSlip] = useState<Slip>(loadDraft);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof Slip>(key: K, value: Slip[K]) => {
    setSlip((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError("");
  };
  const updateItem = (id: string, key: "name" | "uom" | "quantity", value: string) => {
    update("items", slip.items.map((item) => item.id === id ? { ...item, [key]: value } : item));
  };
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slip.costCenter.trim()) { setError("Enter a cost center before saving."); return; }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(slip));
      setSaved(true);
      setError("");
    } catch { setError("This browser could not save the draft. Check your browser storage settings and try again."); }
  }
  const textField = (key: Exclude<keyof Slip, "items" | "notes" | "withMR">, label: string, type = "text", required = false) => (
    <Field label={label}>{(props) => <input {...props} className="input" type={type} value={slip[key]} required={required} onChange={(event) => update(key, event.target.value)} />}</Field>
  );
  const allSelected = slip.items.length > 0 && selected.length === slip.items.length;

  return <div className="admin-detail-page aml-page requisition-page">
    <Link className="aml-back-link" to="/admin/aml-network"><ArrowLeft size={17} aria-hidden="true" /> AML Network</Link>
    <form className="stack requisition-form" onSubmit={save}>
      <div className="page-title">
        <div><div className="row"><h1>New Requisition Slip</h1><span className={`badge ${saved ? "ok" : "warn"}`}>{saved ? "Saved locally" : "Not saved"}</span></div><p className="muted aml-subtext">Prepare a requisition for supplies, materials or equipment.</p></div>
        <div className="row"><Link className="btn" to="/admin/aml-network">Cancel</Link><button className="btn primary" type="submit"><FloppyDisk size={18} aria-hidden="true" />Save draft</button></div>
      </div>
      <div className="card flush requisition-card">
        <div className="requisition-fields">
          <div className="stack">
            {textField("costCenter", "Cost Center *", "text", true)}
            {textField("projectName", "Project Name")}
            {textField("requestedBy", "Requested By")}
            {textField("requesterContact", "Requester Contact Number", "tel")}
            <label className="requisition-checkbox"><input type="checkbox" checked={slip.withMR} onChange={(event) => update("withMR", event.target.checked)} />With MR</label>
          </div>
          <div className="stack">
            {textField("date", "Date", "date")}
            {textField("requiredDate", "Required Date", "date")}
            {textField("approvedBy", "Approved By")}
            {textField("approvedContact", "Approved Contact Number", "tel")}
            {textField("equipment", "Equipment")}
          </div>
        </div>
        <section className="requisition-items" aria-labelledby="requisition-items-title">
          <h2 id="requisition-items-title">Item Request</h2>
          <p className="requisition-label" id="requisition-list-label">Item List</p>
          <div className="table-wrap requisition-table"><table aria-labelledby="requisition-list-label">
            <thead><tr>
              <th className="requisition-select"><input type="checkbox" aria-label="Select all items" checked={allSelected} disabled={!slip.items.length} onChange={(event) => setSelected(event.target.checked ? slip.items.map((item) => item.id) : [])} /></th>
              <th className="requisition-number">No.</th><th>Item Name</th><th>UOM</th><th>Quantity</th>
              <th className="requisition-select"><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>{slip.items.length === 0 ? <tr><td colSpan={6}><div className="requisition-empty"><ClipboardText size={35} weight="thin" aria-hidden="true" /><span>No Data</span></div></td></tr> : slip.items.map((item, index) => <tr key={item.id}>
              <td><input type="checkbox" aria-label={`Select item ${index + 1}`} checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /></td>
              <td className="muted">{index + 1}</td>
              <td><input className="input" aria-label={`Item name ${index + 1}`} value={item.name} onChange={(event) => updateItem(item.id, "name", event.target.value)} required /></td>
              <td><input className="input" aria-label={`UOM ${index + 1}`} value={item.uom} placeholder="e.g. pcs" onChange={(event) => updateItem(item.id, "uom", event.target.value)} required /></td>
              <td><input className="input" type="number" min="0.001" step="any" aria-label={`Quantity ${index + 1}`} value={item.quantity} onChange={(event) => updateItem(item.id, "quantity", event.target.value)} required /></td>
              <td><button className="btn ghost icon" type="button" aria-label={`Remove item ${index + 1}`} onClick={() => { update("items", slip.items.filter((row) => row.id !== item.id)); setSelected(selected.filter((id) => id !== item.id)); }}><Trash size={17} aria-hidden="true" /></button></td>
            </tr>)}</tbody>
          </table></div>
          <div className="row requisition-row-actions">
            <button type="button" className="btn sm" onClick={() => update("items", [...slip.items, { id: crypto.randomUUID(), name: "", uom: "", quantity: "" }])}><Plus size={16} aria-hidden="true" />Add Row</button>
            {selected.length > 0 && <button type="button" className="btn sm" onClick={() => { update("items", slip.items.filter((item) => !selected.includes(item.id))); setSelected([]); }}><Trash size={16} aria-hidden="true" />Remove selected ({selected.length})</button>}
          </div>
          <Field label="Internal Notes">{(props) => <textarea {...props} className="input requisition-notes" value={slip.notes} onChange={(event) => update("notes", event.target.value)} rows={4} />}</Field>
        </section>
      </div>
      <p className="muted aml-subtext">Drafts are saved in this browser. ERP submission is not connected yet. <Link to="/admin/aml-network/requisitions">View requisition list</Link></p>
      <div role="status" aria-live="polite">{saved && <span className="requisition-save-message">Draft saved in this browser.</span>}</div>
      {error && <div className="err" role="alert">{error}</div>}
    </form>
  </div>;
}
