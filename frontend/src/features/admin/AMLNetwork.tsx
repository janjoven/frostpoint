import { ArrowLeft, ArrowRight, CheckCircle, Clock, CreditCard, FileText, HandCoins, MagnifyingGlass, Plus, Receipt, SealCheck, ShoppingCart, Tray, Users } from "@phosphor-icons/react";
import { useState } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Empty, Modal } from "../../components/ui";
import { peso } from "../../lib/format";
import RequisitionSlip from "./RequisitionSlip";
import RequisitionList, { getRequisitions } from "./RequisitionList";
import DirectPaymentOrder from "./DirectPaymentOrder";
import { loadPaymentDraft, paymentTotals } from "../../lib/directPaymentDraft";
import { employeeStatuses, matchesCard, paymentPending, paymentReturned, paymentStates, purchasePending, purchaseStatuses, purchaseWorkflowStates, requisitionPending, uniqueStates, voucherStatuses } from "../../lib/amlStatuses";
import { paymentEntries, voucherNetAmount } from "../../lib/paymentEntries";
import VoucherPreview from "./VoucherPreview";

const sections = [
  { id: "requisitions", slug: "requisitions", tone: "blue", label: "Requisition Slip", icon: FileText, hint: "Review requisition slips and their approval status." },
  { id: "payments", slug: "direct-payment-orders", tone: "blue", label: "Direct Payment Order", icon: CreditCard, hint: "Review payment orders and their approval status." },
  { id: "purchases", slug: "purchase-requests", tone: "teal", label: "Purchase Order", icon: FileText, hint: "Review purchase orders, quantities and estimated costs." },
  { id: "vouchers", slug: "disbursement-vouchers", tone: "blue", label: "Disbursement Voucher", icon: Receipt, hint: "Review Payment Entry records by document status." },
  { id: "employees", slug: "employees", tone: "teal", label: "Employee List", icon: Users, hint: "Find employee contact details and team assignments." },
] as const;
type Section = typeof sections[number]["id"];
type ListView = { section: Section; slug: string; label: string; status?: string; statuses?: string[]; field?: "status" | "workflowState"; purchaseOrders?: boolean };
const views: ListView[] = [
  { section: "requisitions", slug: "requisitions", label: "Requisition List" },
  { section: "requisitions", slug: "requisitions-pending", label: "Pending Approval", statuses: requisitionPending },
  { section: "requisitions", slug: "requisitions-returned", label: "Returned to Requestor", status: "Returned to Requestor" },
  { section: "requisitions", slug: "requisitions-for-mr-dpo", label: "For MR/DPO", status: "For MR/DPO" },
  { section: "payments", slug: "direct-payment-orders", label: "Direct Payment Order List" },
  { section: "payments", slug: "payments-pending-approval", label: "Pending Approval", statuses: paymentPending },
  { section: "payments", slug: "payments-returned", label: "Returned for Review", statuses: paymentReturned },
  { section: "payments", slug: "payments-approved", label: "Approved", status: "Approved" },
  { section: "payments", slug: "payments-received", label: "Received", status: "Received" },
  { section: "payments", slug: "payments-completed", label: "Completed", status: "Completed" },
  { section: "purchases", slug: "purchase-orders", label: "Purchase Order List", purchaseOrders: true },
  { section: "purchases", slug: "purchase-pending-approval", label: "Pending Approval", statuses: purchasePending, field: "workflowState", purchaseOrders: true },
  { section: "purchases", slug: "purchase-for-purchase", label: "For Purchase", status: "For Purchase", field: "workflowState", purchaseOrders: true },
  { section: "purchases", slug: "purchase-to-receive", label: "To Receive", status: "To Receive", purchaseOrders: true },
  { section: "purchases", slug: "purchase-to-bill", label: "To Bill", status: "To Bill", purchaseOrders: true },
  { section: "purchases", slug: "purchase-completed", label: "Completed", status: "Completed", purchaseOrders: true },
  { section: "vouchers", slug: "disbursement-vouchers", label: "Disbursement Voucher List" },
  ...voucherStatuses.map((status) => ({ section: "vouchers" as const, slug: `vouchers-${status.toLowerCase()}`, label: status, status })),
  { section: "employees", slug: "employees", label: "Employee List" },
  ...employeeStatuses.map((status) => ({ section: "employees" as const, slug: `employees-${status.toLowerCase()}`, label: status, status })),
];
function cardTone(view: ListView) {
  if (view.status === "Submitted") return "green";
  if (view.status === "Draft") return "amber";
  if (view.status === "Cancelled") return "red";
  if (view.statuses && view.label === "Pending Approval") return "amber";
  if (view.label.includes("Returned") || ["Inactive", "Suspended", "Left"].includes(view.label)) return "amber";
  if (["Completed", "For MR/DPO", "Active"].includes(view.label)) return "green";
  if (["To Receive", "Received", "For Purchase"].includes(view.label)) return "teal";
  if (view.section === "requisitions" && view.status === "Draft") return "teal";
  if (view.section === "requisitions" && view.status) return "amber";
  if (view.status === "Pending in GM" || view.status === "Pending for Approval") return "amber";
  if (view.status === "Approved" || view.status === "Posted & Disburse") return "green";
  if (view.status === "Received" || view.section === "employees") return "teal";
  return "blue";
}
function cardIcon(view: ListView) {
  if (view.status === "Submitted") return CheckCircle;
  if (view.status === "Draft") return FileText;
  if (view.label === "Pending Approval" || view.label.includes("Returned")) return Clock;
  if (view.label === "Completed" || view.label === "For MR/DPO") return SealCheck;
  if (view.section === "requisitions") return view.status?.startsWith("Pending") ? Clock : FileText;
  if (view.status === "Pending in GM" || view.status === "Pending for Approval") return Clock;
  if (view.status === "Approved") return CheckCircle;
  if (view.status === "Received") return Tray;
  if (view.status === "For Disbursement") return HandCoins;
  if (view.status === "Posted & Disburse") return SealCheck;
  if (view.purchaseOrders) return ShoppingCart;
  if (view.section === "employees") return Users;
  return view.section === "payments" ? CreditCard : Receipt;
}
type DocumentRecord = { reference: string; name: string; description: string; date: string; amount: number; status: string; workflowState?: string; local?: boolean };
const documents: Record<Exclude<Section, "employees" | "requisitions">, DocumentRecord[]> = {
  payments: [
    { reference: "DPO-2026-001", name: "Masbate Ice Supplies", description: "Ice production supplies", date: "Nov 12, 2026", amount: 12500, status: "Pending in GM" },
    { reference: "DPO-2026-002", name: "City Power Services", description: "November electricity bill", date: "Nov 11, 2026", amount: 8400, status: "Approved" },
    { reference: "DPO-2026-003", name: "Island Fuel Depot", description: "Delivery vehicle fuel", date: "Nov 10, 2026", amount: 3200, status: "Received" },
    { reference: "DPO-2026-004", name: "Masbate Packaging Supply", description: "Packaging payment", date: "Nov 10, 2026", amount: 2500, status: "Completed" },
    { reference: "DPO-2026-005", name: "City Power Services", description: "Billing details for review", date: "Nov 9, 2026", amount: 1500, status: "GM returned for review in ABD" },
  ],
  purchases: [
    { reference: "PR-2026-001", name: "Rico Staff", description: "Food-grade ice bags · 500 pcs", date: "Nov 12, 2026", amount: 2500, status: "Received" },
    { reference: "PR-2026-002", name: "Ramil Rider", description: "Insulated delivery boxes · 4 pcs", date: "Nov 11, 2026", amount: 6400, status: "Received" },
    { reference: "PR-2026-003", name: "Alex Admin", description: "Water dispenser cleaning kits · 6 sets", date: "Nov 10, 2026", amount: 1800, status: "Draft" },
  ],
  vouchers: paymentEntries.map((entry) => ({ reference: entry.reference, name: entry.payee, description: entry.particulars.map((item) => item.description).join("; "), date: entry.date, amount: voucherNetAmount(entry), status: entry.status })),
};
const purchaseOrders: DocumentRecord[] = [
  { reference: "PO-2026-001", name: "Masbate Packaging Supply", description: "Food-grade ice bags · 500 pcs", date: "Nov 12, 2026", amount: 2500, status: "To Receive", workflowState: "For Purchase" },
  { reference: "PO-2026-002", name: "Island Equipment Supply", description: "Insulated delivery boxes · 4 pcs", date: "Nov 11, 2026", amount: 6400, status: "Draft", workflowState: "Pending in GM" },
  { reference: "PO-2026-003", name: "Masbate Ice Supplies", description: "Production materials", date: "Nov 10, 2026", amount: 1800, status: "To Bill", workflowState: "Approved and Signed" },
  { reference: "PO-2026-004", name: "Island Fuel Depot", description: "Fuel supply", date: "Nov 9, 2026", amount: 3200, status: "Completed", workflowState: "Completed" },
];
function recordsFor(view: ListView): DocumentRecord[] {
  if (view.section === "requisitions") return getRequisitions().filter((record) => matchesCard(record.status, view.status, view.statuses)).map((record) => ({ reference: record.reference, name: record.requestedBy, description: record.projectName, date: record.date, amount: 0, status: record.status }));
  if (view.section === "payments") {
    const draft = loadPaymentDraft();
    const local: DocumentRecord[] = draft ? [{ reference: "LOCAL-DPO-DRAFT", name: draft.fields.payee, description: draft.fields.expenseType || "Browser-local payment order draft", date: draft.fields.transactionDate, amount: paymentTotals(draft).total, status: "Draft", local: true }] : [];
    return [...local, ...documents.payments].filter((record) => matchesCard(record.status, view.status, view.statuses));
  }
  const source = view.purchaseOrders ? purchaseOrders : view.section === "employees" ? [] : documents[view.section];
  return source.filter((record) => matchesCard(record[view.field ?? "status"] ?? "", view.status, view.statuses));
}
const employees = [
  { id: "EMP-001", name: "Alex Admin", role: "Administrator", department: "Administration", email: "admin@example.com", phone: "0917 000 0001", status: "Active" },
  { id: "EMP-002", name: "Rico Staff", role: "Operations staff", department: "Operations", email: "staff@example.com", phone: "0917 000 0002", status: "Active" },
  { id: "EMP-003", name: "Ramil Rider", role: "Delivery rider", department: "Delivery", email: "rider@example.com", phone: "0917 000 0003", status: "Active" },
  { id: "EMP-004", name: "Andrea Owner", role: "Owner", department: "Management", email: "owner@example.com", phone: "0917 000 0004", status: "Inactive" },
  { id: "EMP-005", name: "Sample Employee", role: "Operations staff", department: "Operations", email: "employee5@example.com", phone: "0917 000 0005", status: "Suspended" },
  { id: "EMP-006", name: "Former Employee", role: "Delivery rider", department: "Delivery", email: "employee6@example.com", phone: "0917 000 0006", status: "Left" },
];
const statusTone = (status: string) => ["Approved", "Completed", "Active", "For MR/DPO", "Submitted"].includes(status) ? "ok" : status === "Cancelled" ? "bad" : /pending|returned|suspended|inactive|draft/i.test(status) ? "warn" : "";
type Preview = { title: string; fields: { label: string; value: string }[] };

export default function AMLNetwork() {
  return <Routes>
    <Route index element={<AMLOverview />} />
    <Route path="new-requisition" element={<RequisitionSlip />} />
    <Route path="new-direct-payment-order" element={<DirectPaymentOrder />} />
    <Route path="disbursement-vouchers/:reference/print" element={<VoucherPreview />} />
    <Route path=":sectionSlug" element={<AMLListPage />} />
    <Route path="*" element={<Navigate to="/admin/aml-network" replace />} />
  </Routes>;
}

function AMLOverview() {
  return <div className="admin-detail-page aml-page">
    <div className="page-title"><div><div className="row"><h1>AML Network</h1><span className="badge">Mock preview</span></div><p className="muted aml-subtext">Payments, purchasing and employee records in one place.</p></div></div>
    {sections.map(({ id, label }) => <section key={id} className="aml-group" aria-labelledby={`aml-group-${id}`}>
      <div className="row spread"><h2 id={`aml-group-${id}`}>{id === "employees" ? "Employee" : label}</h2>{id === "requisitions" && <NewRequisitionButton />}{id === "payments" && <NewPaymentButton />}</div>
      {id === "vouchers" && <p className="muted aml-subtext">Payment Entry · Document status</p>}
      {id === "purchases" && <p className="muted aml-subtext">Approval stages and order statuses are separate; a purchase order can appear in more than one card.</p>}
      <div className="dashboard-kpis aml-summary-grid">
        {views.filter((view) => view.section === id).map((view) => {
          const Icon = cardIcon(view);
          return <Link key={view.slug} to={`/admin/aml-network/${view.slug}`} className={`card kpi-card aml-summary-card tone-${cardTone(view)}`} data-ui-id={`aml-${view.slug}`}>
          <div className="row spread nowrap"><span className="l">{view.label}</span><span className="chip"><Icon size={20} aria-hidden="true" /></span></div>
          <strong className="v">{id === "employees" ? employees.filter((person) => matchesCard(person.status, view.status)).length : recordsFor(view).length}<span className="sr-only"> {id === "employees" ? "employees" : "records"}</span></strong>
          <span className="aml-card-action">View list <ArrowRight size={16} aria-hidden="true" /></span>
        </Link>; })}
      </div>
    </section>)}
    <p className="muted aml-subtext">Preview counts use sample records and browser-local drafts. Grouped approval cards are proposed mappings for review.</p>
  </div>;
}

function NewRequisitionButton() {
  return <Link className="btn primary" to="/admin/aml-network/new-requisition" data-ui-id="aml-new-requisition"><Plus size={18} aria-hidden="true" /><strong>Add New Requisition Slip</strong></Link>;
}

function NewPaymentButton() {
  return <Link className="btn primary" to="/admin/aml-network/new-direct-payment-order" data-ui-id="aml-new-direct-payment-order"><Plus size={18} aria-hidden="true" /><strong>New Direct Payment Order</strong></Link>;
}

function AMLListPage() {
  const { sectionSlug } = useParams();
  const current = views.find((item) => item.slug === sectionSlug);
  if (current?.section === "requisitions") return <RequisitionList key={current.slug} title={current.label} status={current.status} statuses={current.statuses} />;
  return current ? <AMLRecords key={current.slug} view={current} /> : <Navigate to="/admin/aml-network" replace />;
}

function AMLRecords({ view }: { view: ListView }) {
  const section = view.section;
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState(view.statuses ? "__group" : view.field === "workflowState" ? view.status ?? "" : section === "purchases" ? "" : view.status ?? "");
  const [orderFilter, setOrderFilter] = useState(section === "purchases" && view.field !== "workflowState" ? view.status ?? "" : "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const group = sections.find((item) => item.id === section)!;
  const current = { ...group, label: view.label };
  const isRequest = section === "purchases" && !view.purchaseOrders;
  const partyLabel = isRequest ? "Requested by" : view.purchaseOrders ? "Supplier" : "Payee";
  const term = search.trim().toLowerCase();
  const matches = (values: string[]) => values.some((value) => value.toLowerCase().includes(term));
  const matchState = (value: string) => stateFilter === "__group" ? matchesCard(value, undefined, view.statuses) : !stateFilter || value === stateFilter;
  const people = employees.filter((person) => matchState(person.status) && matches(Object.values(person)));
  const records = recordsFor({ ...view, status: undefined, statuses: undefined }).filter((record) => matchState(section === "purchases" ? record.workflowState ?? "" : record.status) && (!orderFilter || record.status === orderFilter) && matches([record.reference, record.name, record.description, record.status, record.workflowState ?? ""]));
  const count = section === "employees" ? people.length : records.length;
  const filterStates = section === "employees" ? employeeStatuses : section === "vouchers" ? voucherStatuses : section === "purchases" ? uniqueStates(purchaseWorkflowStates) : uniqueStates(paymentStates);
  const stateLabel = section === "purchases" ? "Approval Stage" : section === "employees" ? "Employee Status" : section === "vouchers" ? "Document Status" : "Workflow State";

  return (
    <div className="admin-detail-page aml-page">
      <Link className="aml-back-link" to="/admin/aml-network"><ArrowLeft size={17} aria-hidden="true" /> AML Network</Link>
      <div className="page-title"><div><div className="row"><h1>{current.label}</h1><span className="badge">Mock preview</span></div><p className="muted aml-subtext">{current.hint}</p></div>{section === "payments" && <NewPaymentButton />}</div>
      {view.statuses && <details className="aml-mapping-note"><summary>Proposed group · {view.statuses.length} workflow states</summary><p className="muted aml-subtext">For UI review; ERP field mapping and permissions still need confirmation.</p><ul>{view.statuses.map((state) => <li key={state}>{state}</li>)}</ul></details>}
      {section === "purchases" && <p className="muted aml-subtext">Approval Stage filters the workflow. Order Status filters fulfillment. The two values are independent.</p>}
      <section className="card flush" aria-labelledby="aml-section-title">
        <div className="aml-toolbar">
          <h2 id="aml-section-title">{section === "employees" ? "Employees" : "Records"}</h2>
          <label className="catalog-search aml-search"><MagnifyingGlass size={19} aria-hidden="true" /><span className="sr-only">Search {current.label}</span><input className="input" type="search" placeholder={section === "employees" ? "Search employees…" : "Search reference, name or status…"} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="row aml-status-filters"><label className="field"><span className="lbl">{stateLabel}</span><select className="input" aria-label={stateLabel} value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="">All {section === "employees" || section === "vouchers" ? "statuses" : "workflow states"}</option>{view.statuses && <option value="__group">{view.label} (group)</option>}{filterStates.map((state) => <option key={state}>{state}</option>)}</select></label>{section === "purchases" && <label className="field"><span className="lbl">Order Status</span><select className="input" aria-label="Order Status" value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option value="">All order statuses</option>{purchaseStatuses.map((state) => <option key={state}>{state}</option>)}</select></label>}</div>
        </div>
        <div className="aml-record-count muted" role="status">{count} {section === "employees" ? "employees" : "records"} · {section === "payments" ? "Sample records and your browser-local draft" : "Sample data only"}</div>
        {!count ? <Empty icon={<MagnifyingGlass size={32} aria-hidden="true" />} title="No matching records" hint="Try another name, reference or status." /> : <div className="table-wrap admin-users-table"><table>
          {section === "employees" ? <>
            <thead><tr><th>Employee</th><th>Role</th><th>Department</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{people.map((person) => <tr key={person.id}>
              <td data-label="Employee"><strong>{person.name}</strong><div className="muted aml-table-subtext">{person.id}</div></td>
              <td data-label="Role">{person.role}</td><td data-label="Department">{person.department}</td>
              <td data-label="Status"><span className={`badge ${statusTone(person.status)}`}>{person.status}</span></td>
              <td data-label="Actions"><button type="button" className="btn sm" aria-label={`View ${person.name}`} onClick={() => setPreview({ title: person.name, fields: Object.entries({ "Employee ID": person.id, Role: person.role, Department: person.department, Email: person.email, Phone: person.phone, Status: person.status }).map(([label, value]) => ({ label, value })) })}>View details</button></td>
            </tr>)}</tbody>
          </> : <>
            <thead><tr><th>Reference</th><th>{partyLabel} / {section === "purchases" ? "Items" : "Purpose"}</th><th className="r">{isRequest ? "Estimated cost" : "Amount"}</th>{section === "purchases" && <th>Approval Stage</th>}<th>{section === "purchases" ? "Order Status" : stateLabel}</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{records.map((record) => <tr key={record.reference}>
              <td data-label="Reference">{section === "vouchers" ? <Link className="aml-reference" state={{ from: `/admin/aml-network/${view.slug}` }} to={`/admin/aml-network/disbursement-vouchers/${encodeURIComponent(record.reference)}/print`}><strong>{record.reference}</strong></Link> : <strong className="aml-reference">{record.reference}</strong>}<div className="muted aml-table-subtext">{record.date}</div></td>
              <td data-label={partyLabel}><strong>{record.name}</strong><div className="muted aml-table-subtext">{record.description}</div></td>
              <td data-label={isRequest ? "Estimated cost" : "Amount"} className="r num"><strong>{peso(record.amount)}</strong></td>
              {section === "purchases" && <td data-label="Approval Stage"><span className={`badge ${statusTone(record.workflowState ?? "")}`}>{record.workflowState || "—"}</span></td>}
              <td data-label={section === "purchases" ? "Order Status" : stateLabel}><span className={`badge ${statusTone(record.status)}`}>{record.status}</span></td>
              <td data-label="Actions">{section === "vouchers" ? <Link className="btn sm" aria-label={`View and print ${record.reference}`} state={{ from: `/admin/aml-network/${view.slug}` }} to={`/admin/aml-network/disbursement-vouchers/${encodeURIComponent(record.reference)}/print`}>View / Print</Link> : record.local ? <Link className="btn sm" to="/admin/aml-network/new-direct-payment-order">Edit draft</Link> : <button type="button" className="btn sm" aria-label={`View ${record.reference}`} onClick={() => setPreview({ title: record.reference, fields: [{ label: "Document", value: current.label }, { label: partyLabel, value: record.name }, { label: "Description", value: record.description }, { label: "Date", value: record.date }, { label: isRequest ? "Estimated cost" : "Amount", value: peso(record.amount) }, { label: "Status", value: record.status }] })}>View details</button>}</td>
            </tr>)}</tbody>
          </>}
        </table></div>}
      </section>
      {preview && <Modal title={preview.title} onClose={() => setPreview(null)}><p className="muted aml-subtext">Mock preview · Sample data only</p><dl className="aml-details">{preview.fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl><div className="admin-form-actions"><button type="button" className="btn primary" onClick={() => setPreview(null)}>Close</button></div></Modal>}
    </div>
  );
}
