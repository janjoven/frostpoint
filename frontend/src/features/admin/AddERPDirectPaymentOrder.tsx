import { ArrowLeft, Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Field } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { PaymentDraft, PaymentField, emptyPaymentDraft, loadPaymentDraft, paymentTotals } from "../../lib/directPaymentDraft";
import { expenseAmount, paymentCreateBody } from "../../lib/directPaymentCreate";
import { formatERPAmount } from "../../lib/erpRecords";
import { toast, useAuth } from "../../store";
import { FormSection, PaymentColumn, PaymentTable } from "./PaymentOrderControls";

const API = "/admin/erp/payment-orders", STORAGE = "fp-erp-payment-create-v1";
type Capabilities = { canCreate: boolean; blockedReason: string; departments: string[]; payeeTypes: string[]; referenceTypes: string[] };
type Submission = { state: string; reference: string; replayed?: boolean };
const expenses: PaymentColumn[] = [{ key: "expense", label: "Expense Account", required: true }, { key: "particulars", label: "Particulars" },
  { key: "qty", label: "Quantity", type: "number" }, { key: "uom", label: "UOM" }, { key: "unitCost", label: "Unit Cost", type: "number" }, { key: "amount", label: "Amount", type: "number", required: true }];
const references: PaymentColumn[] = [{ key: "type", label: "Reference Type", required: true }, { key: "name", label: "Reference Name", required: true }, { key: "amount", label: "Amount", type: "number" }];
const advances: PaymentColumn[] = [{ key: "type", label: "Type" }, { key: "payee", label: "Payee" }, { key: "bank", label: "Check Bank" },
  { key: "checkNumber", label: "Check Number" }, { key: "date", label: "Cash / Check Date", type: "date" }, { key: "amount", label: "Amount", type: "number" }];

function restore(name: string) {
  let draft = loadPaymentDraft() ?? emptyPaymentDraft();
  let requestId = crypto.randomUUID() as string, uncertain = false;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
    if (saved?.draft?.fields && Object.keys(draft.fields).every((key) => typeof saved.draft.fields[key] === "string") &&
        ["expenses", "references", "cashAdvances"].every((key) => Array.isArray(saved.draft[key]) && saved.draft[key].every((r: any) => r && typeof r.id === "string" && r.values && Object.values(r.values).every((v) => typeof v === "string")))) {
      draft = saved.draft;
      if (typeof saved.requestId === "string" && /^[\da-f-]{36}$/i.test(saved.requestId)) requestId = saved.requestId;
      uncertain = saved.uncertain === true;
    }
  } catch { /* use the valid legacy draft */ }
  draft = { ...draft, fields: { ...draft.fields, transactionDate: draft.fields.transactionDate || new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
    requestorName: draft.fields.requestorName || name, payeeType: draft.fields.payeeType || "Employee" } };
  return { draft, requestId, uncertain };
}

function PaymentERPLink({ kind, label, value, change, required = false, company = "", payeeType = "Employee", referenceType = "Purchase Order" }: {
  kind: string; label: string; value: string; change: (value: string) => void; required?: boolean; company?: string; payeeType?: string; referenceType?: string;
}) {
  const user = useAuth((s) => s.user);
  const [focused, setFocused] = useState(false), [search, setSearch] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setSearch(value.trim()), 300); return () => clearTimeout(timer); }, [value]);
  const params = new URLSearchParams({ search, company, payee_type: payeeType || "Employee", reference_type: referenceType || "Purchase Order" });
  const query = useQuery({ queryKey: ["erp-payment-lookups", user?.id, kind, params.toString()],
    queryFn: () => api<{ options: { value: string; label: string; description: string }[] }>(`${API}/lookups/${kind}?${params}`),
    enabled: focused && user?.role === "admin", retry: false, staleTime: 30000, gcTime: 0 });
  return <Field label={label} help={query.isError ? "ERP lookup unavailable. Select permission may be needed for this record type." : "Choose an ERP value or enter its exact ID."}>{(p) => <>
    <input {...p} className="input" value={value} required={required} autoComplete="off" list={`${p.id}-values`} onFocus={() => setFocused(true)} onChange={(e) => change(e.target.value)} />
    <datalist id={`${p.id}-values`}>{query.data?.options.map((o) => <option value={o.value} key={o.value}>{o.label} {o.description}</option>)}</datalist>
  </>}</Field>;
}

export default function AddERPDirectPaymentOrder() {
  const user = useAuth((s) => s.user);
  const [state, setState] = useState(() => restore(user?.name ?? ""));
  const [message, setMessage] = useState(""), [storageError, setStorageError] = useState(false);
  const navigate = useNavigate(), qc = useQueryClient();
  const caps = useQuery({ queryKey: ["erp-payment-capabilities", user?.id], queryFn: () => api<Capabilities>(`${API}/capabilities`),
    enabled: user?.role === "admin", retry: false, gcTime: 0, staleTime: 0 });
  useEffect(() => { try { localStorage.setItem(STORAGE, JSON.stringify(state)); setStorageError(false); } catch { setStorageError(true); } }, [state]);
  function finish(result: Submission) {
    if (result.state !== "created") { setMessage(result.state === "failed" ? "ERP rejected the previous request. Correct the fields and try again." : "The previous submission is still unconfirmed. Keep its ID and check again.");
      if (result.state === "failed") setState((s) => ({ ...s, uncertain: false })); return; }
    try { localStorage.removeItem(STORAGE); localStorage.removeItem("fp-aml-direct-payment-draft-v1"); } catch { /* record is already saved */ }
    qc.invalidateQueries({ queryKey: ["erp-records"] });
    toast(`${result.reference} created in ERP`);
    navigate(`/admin/aml-network/records/payments/${encodeURIComponent(result.reference)}`);
  }
  const create = useMutation({ mutationFn: () => {
    try { localStorage.setItem(STORAGE, JSON.stringify({ ...state, uncertain: true })); } catch { setStorageError(true); }
    return api<Submission>(API, { method: "POST", body: paymentCreateBody(state.draft, state.requestId) });
  }, onSuccess: finish, onError: (e) => { setMessage(e.message);
    if (!(e instanceof ApiError) || [0, 409, 500, 502, 503, 504].includes(e.status)) setState((s) => ({ ...s, uncertain: true }));
    else if (!state.uncertain) setState((s) => ({ ...s, uncertain: false }));
  }, retry: false });
  const check = useMutation({ mutationFn: () => api<Submission>(`${API}/submissions/${state.requestId}`), onSuccess: finish, onError: (e) => setMessage(e.message) });
  const locked = create.isPending || check.isPending || state.uncertain;
  const draft = state.draft, totals = paymentTotals(draft);
  const update = <K extends keyof PaymentDraft>(key: K, value: PaymentDraft[K]) => { if (locked) return; setState((s) => ({ ...s, draft: { ...s.draft, [key]: value }, requestId: crypto.randomUUID() })); setMessage(""); create.reset(); };
  const changeField = (key: PaymentField, value: string) => update("fields", { ...draft.fields, [key]: value, ...(key === "payeeType" ? { payee: "" } : {}) });
  const linked: Partial<Record<PaymentField, string>> = { company: "companies", rsNumber: "requisitions", payee: "payees", bankAccount: "bank-accounts", equipment: "equipment", projectId: "projects",
    equipmentCode: "equipment", costCenter: "cost-centers", expenseType: "accounts", taxCategory: "tax-categories", cashAdvanceReference: "cash-advances" };
  const field = (key: PaymentField, label: string, type = "text", required = false) => linked[key] ?
    <PaymentERPLink kind={linked[key]!} label={label} value={draft.fields[key]} change={(v) => changeField(key, v)} required={required} company={draft.fields.company} payeeType={draft.fields.payeeType} /> :
    <Field label={label}>{(p) => <input {...p} className="input" type={type} required={required} min={type === "number" ? 0 : undefined} max={key === "discountPercentage" ? 100 : undefined} step={type === "number" ? "any" : undefined} value={draft.fields[key]} onChange={(e) => changeField(key, e.target.value)} />}</Field>;
  function submit(e: FormEvent) { e.preventDefault(); if (!draft.expenses.length) { setMessage("Add at least one expense row."); return; } if (caps.data?.canCreate && !create.isPending) { setMessage(""); create.mutate(); } }
  if (user?.role !== "admin") return <p role="alert">Admin access is required to create ERP payment requests.</p>;
  return <div className="admin-detail-page aml-page requisition-page dpo-page"><Link className="aml-back-link" to="/admin/aml-network/direct-payment-orders"><ArrowLeft size={17} /> Back</Link>
    <form className="stack requisition-form" onSubmit={submit}><div className="page-title"><div><div className="row"><h1>Add Direct Payment Order</h1><span className="badge">FROSTPOINT · FRP-DPO-</span></div><p className="muted aml-subtext">Create a payment request in ERP. ERP controls its approval workflow.</p></div><Button type="submit" className="primary" loading={create.isPending} disabled={!caps.data?.canCreate || check.isPending}><Plus size={18} />{state.uncertain ? "Retry Same Submission" : "Create in ERP"}</Button></div>
      {!caps.data?.canCreate && <div className="card" role="status"><p>{caps.isError ? caps.error.message : caps.isPending ? "Checking ERP Create permission…" : caps.data?.blockedReason}</p><button type="button" className="btn sm" disabled={caps.isFetching} onClick={() => caps.refetch()}>Check permission again</button></div>}
      {message && <p className="err" role="alert">{message}</p>}{storageError && <p className="err" role="alert">Recovery information could not be saved. Keep this page open until the submission is confirmed.</p>}
      {state.uncertain && <div className="card"><p>The previous submission needs confirmation. Its contents are locked to prevent duplicate requests.</p><p className="muted">Submission ID: {state.requestId}</p><Button type="button" loading={check.isPending} disabled={create.isPending} onClick={() => check.mutate()}>Check ERP Submission Status</Button></div>}
      <fieldset className="erp-edit-fields" disabled={locked}><div className="card flush">
        <FormSection title="Direct Payment Order"><div className="dpo-grid"><div className="stack"><Field label="Direct Payment Type">{(p) => <select {...p} className="input" value={draft.fields.paymentType} onChange={(e) => changeField("paymentType", e.target.value)}><option>Direct Expense</option><option>Cash Advance</option></select>}</Field>
          <Field label="Department">{(p) => <select {...p} className="input" required value={draft.fields.department} onChange={(e) => changeField("department", e.target.value)}><option value="">Select a department</option>{caps.data?.departments.map((d) => <option key={d}>{d}</option>)}</select>}</Field>{field("requestorName", "Requestor Name", "text", true)}</div>
          <div className="stack">{field("company", "Company", "text", true)}{field("transactionDate", "Transaction Date", "date", true)}{field("rsNumber", "Requisition Slip (FRP-)")}</div></div></FormSection>
        <FormSection title="To Pay"><div className="dpo-grid"><Field label="Payee Type">{(p) => <select {...p} className="input" required value={draft.fields.payeeType} onChange={(e) => changeField("payeeType", e.target.value)}>{(caps.data?.payeeTypes ?? ["Employee", "Supplier"]).map((t) => <option key={t}>{t}</option>)}</select>}</Field>{field("payee", "Payee", "text", true)}</div></FormSection>
        <FormSection title="References"><PaymentTable label="Reference" columns={references} rows={draft.references} onChange={(r) => update("references", r)} renderCell={(col, row, i, change) => col.key === "type" ? <select className="input" required aria-label={`Reference Type ${i + 1}`} value={row.values.type ?? ""} onChange={(e) => change(e.target.value)}><option value="">Select type</option>{(caps.data?.referenceTypes ?? []).map((t) => <option key={t}>{t}</option>)}</select> : col.key === "name" ? <PaymentERPLink kind="references" label={`Reference Name ${i + 1}`} value={row.values.name ?? ""} change={change} referenceType={row.values.type} required /> : undefined} /></FormSection>
        <FormSection title="Bank / Receiver Details"><div className="dpo-grid"><div className="stack">{field("bankAccount", "Bank Account")}{field("accountName", "Account Name")}</div><div className="stack">{field("receivedBy", "Receiver Name")}{field("equipment", "Equipment")}</div></div></FormSection>
        <FormSection title="Accounting Dimension"><div className="dpo-grid"><div className="stack">{field("projectId", "Project ID")}{field("equipmentCode", "Equipment Code")}</div><div className="stack">{field("costCenter", "Cost Center", "text", true)}{field("governmentProjectId", "Government Project ID")}</div></div></FormSection>
        <FormSection><div className="dpo-grid">{field("expenseType", "Expense Type")}{field("deliveryPoint", "Delivery Point")}</div></FormSection>
        <FormSection title="Expenses"><PaymentTable label="Expense List" columns={expenses} rows={draft.expenses} onChange={(r) => update("expenses", r)} calculateAmount={expenseAmount} renderCell={(col, row, i, change) => col.key === "expense" || col.key === "uom" ? <PaymentERPLink kind={col.key === "expense" ? "accounts" : "uoms"} label={`${col.label} ${i + 1}`} required={col.required} value={row.values[col.key] ?? ""} change={change} company={draft.fields.company} /> : col.key === "amount" && row.values.qty && row.values.unitCost ? <input className="input" readOnly aria-label={`Expense Amount ${i + 1}`} value={row.values.amount ?? ""} /> : undefined} /><p className="muted aml-subtext">Quantity × unit cost calculates the amount. Without both values, enter the amount directly. The backend validates and recalculates totals.</p></FormSection>
        <FormSection title="Discounts"><div className="dpo-grid">{field("discountPercentage", "Discount Percentage", "number")}{field("discountAmount", "Fixed Discount Amount", "number")}</div></FormSection>
        <FormSection title="Tax and Charges"><div className="dpo-grid">{field("taxCategory", "Tax Category")}{field("taxCharges", "Tax and Charges", "number")}</div></FormSection>
        <FormSection title="Totals"><dl className="aml-details"><div><dt>Expense Subtotal (Company Currency)</dt><dd>{formatERPAmount(totals.expenses)}</dd></div><div><dt>Preview Total (Company Currency)</dt><dd>{formatERPAmount(totals.total)}</dd></div></dl><div className="dpo-grid">{field("cashAdvanceReference", "Cash Advance Reference")}{field("refundAmount", "Refund Amount", "number")}</div></FormSection>
        <FormSection title="Cash Advance References"><PaymentTable label="CA Reference Table" columns={advances} rows={draft.cashAdvances} onChange={(r) => update("cashAdvances", r)} renderCell={(col, row, i, change) => col.key === "type" ? <select className="input" aria-label={`Cash Advance Type ${i + 1}`} value={row.values.type || "CA Repayment"} onChange={(e) => change(e.target.value)}>{["Cash", "Check", "Withholding Tax", "Loan Repayment", "CA Repayment"].map((t) => <option key={t}>{t}</option>)}</select> : undefined} /></FormSection>
        <FormSection><Field label="Internal Notes">{(p) => <textarea {...p} className="input" rows={5} value={draft.fields.notes} onChange={(e) => changeField("notes", e.target.value)} />}</Field></FormSection>
      </div></fieldset><p className="muted aml-subtext">Create in ERP saves a payment request. Approval, audit, receipt, and payment execution remain in ERP. Unfinished form data is kept in this browser.</p>
    </form></div>;
}
