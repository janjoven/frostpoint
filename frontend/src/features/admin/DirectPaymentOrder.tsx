import { ArrowLeft, ClipboardText, FloppyDisk, Plus, Trash } from "@phosphor-icons/react";
import { FormEvent, ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "../../components/ui";
import { emptyPaymentDraft, loadPaymentDraft, PaymentDraft, PaymentField, PaymentRow, paymentTotals, savePaymentDraft } from "../../lib/directPaymentDraft";
import { peso } from "../../lib/format";

type Column = { key: string; label: string; type?: "number" | "date" | "checkbox"; required?: boolean };
const referenceColumns: Column[] = [{ key: "type", label: "Reference Type" }, { key: "amount", label: "Amount", type: "number" }];
const expenseColumns: Column[] = [
  { key: "expense", label: "Expense", required: true }, { key: "particulars", label: "Particulars" },
  { key: "qty", label: "Qty", type: "number" }, { key: "uom", label: "UOM" },
  { key: "unitCost", label: "Unit Cost", type: "number" }, { key: "amount", label: "Amount", type: "number", required: true },
];
const advanceColumns: Column[] = [
  { key: "clear", label: "Clear", type: "checkbox" }, { key: "type", label: "Type" }, { key: "payee", label: "Payee" },
  { key: "bank", label: "Check Bank" }, { key: "date", label: "Cash/Check Date", type: "date" },
];

function PaymentTable({ label, columns, rows, onChange }: { label: string; columns: Column[]; rows: PaymentRow[]; onChange: (rows: PaymentRow[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const updateCell = (id: string, key: string, value: string) => onChange(rows.map((row) => {
    if (row.id !== id) return row;
    const values = { ...row.values, [key]: value };
    if ((key === "qty" || key === "unitCost") && values.qty && values.unitCost) values.amount = (Math.round(Number(values.qty) * Number(values.unitCost) * 100) / 100).toFixed(2);
    return { ...row, values };
  }));
  return <>
    <p className="requisition-label">{label}</p>
    <div className="table-wrap dpo-table"><table aria-label={label} style={{ minWidth: columns.length > 4 ? 1000 : 620 }}>
      <thead><tr><th className="dpo-check"><input type="checkbox" aria-label={`Select all ${label} rows`} disabled={!rows.length} checked={rows.length > 0 && rows.every((row) => selected.includes(row.id))} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th><th>No.</th>{columns.map((column) => <th key={column.key}>{column.label}{column.required ? " *" : ""}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{!rows.length ? <tr><td colSpan={columns.length + 3}><div className="requisition-empty"><ClipboardText size={35} weight="thin" aria-hidden="true" /><span>No Data</span></div></td></tr> : rows.map((row, index) => <tr key={row.id}>
        <td><input type="checkbox" aria-label={`Select ${label} row ${index + 1}`} checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></td><td>{index + 1}</td>
        {columns.map((column) => <td key={column.key}>{column.type === "checkbox" ? <input type="checkbox" aria-label={`${label} ${column.label} ${index + 1}`} checked={row.values[column.key] === "1"} onChange={(event) => updateCell(row.id, column.key, event.target.checked ? "1" : "")} /> : <input className="input" aria-label={`${label} ${column.label} ${index + 1}`} type={column.type ?? "text"} min={column.type === "number" ? 0 : undefined} step={column.type === "number" ? "any" : undefined} required={column.required} value={row.values[column.key] ?? ""} onChange={(event) => updateCell(row.id, column.key, event.target.value)} />}</td>)}
        <td><button type="button" className="btn ghost icon" aria-label={`Remove ${label} row ${index + 1}`} onClick={() => { onChange(rows.filter((item) => item.id !== row.id)); setSelected(selected.filter((id) => id !== row.id)); }}><Trash size={17} aria-hidden="true" /></button></td>
      </tr>)}</tbody>
    </table></div>
    <div className="row requisition-row-actions"><button type="button" className="btn sm" onClick={() => onChange([...rows, { id: crypto.randomUUID(), values: Object.fromEntries(columns.map((column) => [column.key, ""])) }])}><Plus size={16} aria-hidden="true" />Add Row</button>{selected.length > 0 && <button type="button" className="btn sm" onClick={() => { onChange(rows.filter((row) => !selected.includes(row.id))); setSelected([]); }}><Trash size={16} aria-hidden="true" />Remove selected ({selected.length})</button>}</div>
  </>;
}

function FormSection({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="dpo-section" aria-label={title}>{title && <h2>{title}</h2>}{children}</section>;
}

export default function DirectPaymentOrder() {
  const [draft, setDraft] = useState<PaymentDraft>(() => loadPaymentDraft() ?? emptyPaymentDraft());
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const totals = paymentTotals(draft);
  const update = <K extends keyof PaymentDraft>(key: K, value: PaymentDraft[K]) => { setDraft((current) => ({ ...current, [key]: value })); setSaved(false); setError(""); };
  const field = (key: PaymentField, label: string, type = "text", required = false) => <Field label={label + (required ? " *" : "")}>{(props) => <input {...props} className="input" type={type} required={required} min={type === "number" ? 0 : undefined} max={key === "discountPercentage" ? 100 : undefined} step={type === "number" ? "any" : undefined} value={draft.fields[key]} onChange={(event) => update("fields", { ...draft.fields, [key]: event.target.value })} />}</Field>;
  const check = (key: "approvedSigned" | "audited" | "eGovPaid" | "summaryPayments", label: string) => <label className="requisition-checkbox"><input type="checkbox" checked={draft[key]} onChange={(event) => update(key, event.target.checked)} />{label}</label>;
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (![draft.fields.department, draft.fields.requestorName, draft.fields.payeeType, draft.fields.payee, draft.fields.costCenter].every((value) => value.trim())) { setError("Complete the required fields before saving."); return; }
    try { savePaymentDraft(draft); setSaved(true); setError(""); }
    catch { setError("This browser could not save the draft. Check your browser storage settings and try again."); }
  }
  return <div className="admin-detail-page aml-page requisition-page dpo-page">
    <Link className="aml-back-link" to="/admin/aml-network"><ArrowLeft size={17} aria-hidden="true" /> AML Network</Link>
    <form className="stack requisition-form" onSubmit={save}>
      <div className="page-title"><div><div className="row"><h1>New Direct Payment Order</h1><span className={`badge ${saved ? "ok" : "warn"}`}>{saved ? "Saved locally" : "Not saved"}</span></div><p className="muted aml-subtext">Prepare a direct payment order and its supporting details.</p></div><div className="row"><Link className="btn" to="/admin/aml-network/direct-payment-orders">Cancel</Link><button type="submit" className="btn primary"><FloppyDisk size={18} aria-hidden="true" />Save draft</button></div></div>
      <div className="card flush">
        <FormSection title="Direct Payment Order"><div className="dpo-grid"><div className="stack">
          <Field label="Direct Payment Type">{(props) => <select {...props} className="input" value={draft.fields.paymentType} onChange={(event) => update("fields", { ...draft.fields, paymentType: event.target.value })}><option>Direct Expense</option></select>}</Field>
          {field("department", "Department", "text", true)}{field("requestorName", "Requestor Name", "text", true)}
        </div><div className="stack">{field("company", "Company")}{field("transactionDate", "Transaction Date", "date", true)}{field("rsNumber", "RS No.")}{check("approvedSigned", "Approved and Signed")}{check("audited", "Audited")}</div></div></FormSection>
        <FormSection title="To pay"><div className="dpo-grid"><div className="stack">{field("payeeType", "Payee Type", "text", true)}{field("payee", "Payee", "text", true)}</div></div></FormSection>
        <FormSection><PaymentTable label="Reference" columns={referenceColumns} rows={draft.references} onChange={(rows) => update("references", rows)} />{check("eGovPaid", "EGov Paid")}</FormSection>
        <FormSection title="Bank / Receiver Details"><div className="dpo-grid"><div className="stack">{field("bankAccount", "Bank Account")}{field("accountName", "Account Name")}</div><div className="stack">{field("receivedBy", "Received By")}{field("equipment", "Equipment")}</div></div></FormSection>
        <FormSection title="Accounting Dimension"><div className="dpo-grid"><div className="stack">{field("projectId", "Project ID")}{field("equipmentCode", "Equipment Code")}</div><div className="stack">{field("costCenter", "Cost Center", "text", true)}{field("governmentProjectId", "Government Project ID")}</div></div></FormSection>
        <FormSection><div className="dpo-grid">{field("expenseType", "Expense Type")}{field("deliveryPoint", "Delivery Point")}</div></FormSection>
        <FormSection title="Expenses"><PaymentTable label="Expense List" columns={expenseColumns} rows={draft.expenses} onChange={(rows) => update("expenses", rows)} /><p className="muted aml-subtext">Quantity × unit cost fills the amount. You can also enter the amount directly.</p></FormSection>
        <FormSection title="Discounts"><div className="dpo-grid">{field("discountPercentage", "Additional Discount Percentage", "number")}{field("discountAmount", "Additional Discount Amount", "number")}</div></FormSection>
        <FormSection title="Tax and Charges"><div className="dpo-grid"><div className="stack">{field("taxCategory", "Tax Category")}{field("taxCharges", "Total Tax and Charges", "number")}<Field label="Total Amount (Company Default)">{(props) => <input {...props} className="input" readOnly value={peso(totals.total)} />}</Field></div></div><p className="muted aml-subtext">Preview total: expenses less percentage and fixed discounts, plus entered tax and charges.</p></FormSection>
        <FormSection title="Totals">{check("summaryPayments", "With Summary Payments")}</FormSection>
        <FormSection><div className="dpo-grid"><div className="stack">{field("cashAdvanceReference", "Cash Advance Reference")}<Field label="Total Expense">{(props) => <input {...props} className="input" readOnly value={peso(totals.expenses)} />}</Field></div>{field("refundAmount", "For Refund Amount", "number")}</div></FormSection>
        <FormSection><PaymentTable label="CA Reference Table" columns={advanceColumns} rows={draft.cashAdvances} onChange={(rows) => update("cashAdvances", rows)} /></FormSection>
        <FormSection><Field label="Internal Notes">{(props) => <textarea {...props} className="input" rows={5} value={draft.fields.notes} onChange={(event) => update("fields", { ...draft.fields, notes: event.target.value })} />}</Field></FormSection>
      </div>
      <p className="muted aml-subtext">Drafts are saved in this browser. ERP submission and payment processing are not connected. <Link to="/admin/aml-network/direct-payment-orders">View payment orders</Link></p>
      {error && <div className="err" role="alert">{error}</div>}<div role="status" aria-live="polite">{saved && <span className="requisition-save-message">Draft saved in this browser.</span>}</div>
    </form>
  </div>;
}
