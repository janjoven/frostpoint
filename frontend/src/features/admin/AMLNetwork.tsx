import { ArrowLeft, ArrowRight, CheckCircle, Clock, CreditCard, FileText, HandCoins, MagnifyingGlass, Receipt, SealCheck, ShoppingCart, Tray, Users } from "@phosphor-icons/react";
import { useState } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Empty, Modal } from "../../components/ui";
import { peso } from "../../lib/format";

const sections = [
  { id: "payments", slug: "direct-payment-orders", tone: "blue", label: "Direct Payment Order", icon: CreditCard, hint: "Review payment orders and their approval status." },
  { id: "purchases", slug: "purchase-requests", tone: "teal", label: "Purchase Request", icon: FileText, hint: "Review requested supplies, quantities and estimated costs." },
  { id: "vouchers", slug: "disbursement-vouchers", tone: "blue", label: "Disbursement Voucher", icon: Receipt, hint: "Review vouchers and scheduled fund releases." },
  { id: "employees", slug: "employees", tone: "teal", label: "Employee List", icon: Users, hint: "Find employee contact details and team assignments." },
] as const;
type Section = typeof sections[number]["id"];
type ListView = { section: Section; slug: string; label: string; status?: string; purchaseOrders?: boolean };
const views: ListView[] = [
  { section: "payments", slug: "direct-payment-orders", label: "Direct Payment Order List" },
  { section: "payments", slug: "payments-pending-gm", label: "Pending in GM", status: "Pending in GM" },
  { section: "payments", slug: "payments-approved", label: "Approved", status: "Approved" },
  { section: "purchases", slug: "purchase-requests", label: "Received", status: "Received" },
  { section: "purchases", slug: "purchase-orders", label: "Purchase Order", purchaseOrders: true },
  { section: "vouchers", slug: "disbursement-vouchers", label: "Disbursement Voucher List" },
  { section: "vouchers", slug: "vouchers-pending-approval", label: "Pending for Approval", status: "Pending for Approval" },
  { section: "vouchers", slug: "vouchers-for-disbursement", label: "For Disbursement", status: "For Disbursement" },
  { section: "vouchers", slug: "vouchers-posted-disbursed", label: "Posted & Disburse", status: "Posted & Disburse" },
  { section: "employees", slug: "employees", label: "Employee List" },
];
function cardTone(view: ListView) {
  if (view.status === "Pending in GM" || view.status === "Pending for Approval") return "amber";
  if (view.status === "Approved" || view.status === "Posted & Disburse") return "green";
  if (view.status === "Received" || view.section === "employees") return "teal";
  return "blue";
}
function cardIcon(view: ListView) {
  if (view.status === "Pending in GM" || view.status === "Pending for Approval") return Clock;
  if (view.status === "Approved") return CheckCircle;
  if (view.status === "Received") return Tray;
  if (view.status === "For Disbursement") return HandCoins;
  if (view.status === "Posted & Disburse") return SealCheck;
  if (view.purchaseOrders) return ShoppingCart;
  if (view.section === "employees") return Users;
  return view.section === "payments" ? CreditCard : Receipt;
}
type DocumentRecord = { reference: string; name: string; description: string; date: string; amount: number; status: string };
const documents: Record<Exclude<Section, "employees">, DocumentRecord[]> = {
  payments: [
    { reference: "DPO-2026-001", name: "Masbate Ice Supplies", description: "Ice production supplies", date: "Nov 12, 2026", amount: 12500, status: "Pending in GM" },
    { reference: "DPO-2026-002", name: "City Power Services", description: "November electricity bill", date: "Nov 11, 2026", amount: 8400, status: "Approved" },
    { reference: "DPO-2026-003", name: "Island Fuel Depot", description: "Delivery vehicle fuel", date: "Nov 10, 2026", amount: 3200, status: "Paid" },
  ],
  purchases: [
    { reference: "PR-2026-001", name: "Rico Staff", description: "Food-grade ice bags · 500 pcs", date: "Nov 12, 2026", amount: 2500, status: "Received" },
    { reference: "PR-2026-002", name: "Ramil Rider", description: "Insulated delivery boxes · 4 pcs", date: "Nov 11, 2026", amount: 6400, status: "Received" },
    { reference: "PR-2026-003", name: "Alex Admin", description: "Water dispenser cleaning kits · 6 sets", date: "Nov 10, 2026", amount: 1800, status: "Draft" },
  ],
  vouchers: [
    { reference: "DV-2026-001", name: "Masbate Ice Supplies", description: "Production supplies payment", date: "Nov 12, 2026", amount: 12500, status: "For Disbursement" },
    { reference: "DV-2026-002", name: "Island Fuel Depot", description: "Delivery fuel reimbursement", date: "Nov 10, 2026", amount: 3200, status: "Posted & Disburse" },
    { reference: "DV-2026-003", name: "City Power Services", description: "Utilities payment", date: "Nov 9, 2026", amount: 8400, status: "Pending for Approval" },
  ],
};
const purchaseOrders: DocumentRecord[] = [
  { reference: "PO-2026-001", name: "Masbate Packaging Supply", description: "Food-grade ice bags · 500 pcs", date: "Nov 12, 2026", amount: 2500, status: "Approved" },
  { reference: "PO-2026-002", name: "Island Equipment Supply", description: "Insulated delivery boxes · 4 pcs", date: "Nov 11, 2026", amount: 6400, status: "Pending for Approval" },
];
function recordsFor(view: ListView) {
  const source = view.purchaseOrders ? purchaseOrders : view.section === "employees" ? [] : documents[view.section];
  return source.filter((record) => !view.status || record.status === view.status);
}
const employees = [
  { id: "EMP-001", name: "Alex Admin", role: "Administrator", department: "Administration", email: "admin@example.com", phone: "0917 000 0001", status: "Active" },
  { id: "EMP-002", name: "Rico Staff", role: "Operations staff", department: "Operations", email: "staff@example.com", phone: "0917 000 0002", status: "Active" },
  { id: "EMP-003", name: "Ramil Rider", role: "Delivery rider", department: "Delivery", email: "rider@example.com", phone: "0917 000 0003", status: "Active" },
  { id: "EMP-004", name: "Andrea Owner", role: "Owner", department: "Management", email: "owner@example.com", phone: "0917 000 0004", status: "On leave" },
];
const statusTone = (status: string) => ["Approved", "Paid", "Posted & Disburse", "Active"].includes(status) ? "ok" : ["Pending in GM", "Pending for Approval", "On leave"].includes(status) ? "warn" : "";
type Preview = { title: string; fields: { label: string; value: string }[] };

export default function AMLNetwork() {
  return <Routes>
    <Route index element={<AMLOverview />} />
    <Route path=":sectionSlug" element={<AMLListPage />} />
    <Route path="*" element={<Navigate to="/admin/aml-network" replace />} />
  </Routes>;
}

function AMLOverview() {
  return <div className="admin-detail-page aml-page">
    <div className="page-title"><div><div className="row"><h1>AML Network</h1><span className="badge">Mock preview</span></div><p className="muted aml-subtext">Payments, purchasing and employee records in one place.</p></div></div>
    {sections.map(({ id, label }) => <section key={id} className="aml-group" aria-labelledby={`aml-group-${id}`}>
      <h2 id={`aml-group-${id}`}>{id === "employees" ? "Employee" : label}</h2>
      <div className="dashboard-kpis aml-summary-grid">
        {views.filter((view) => view.section === id).map((view) => {
          const Icon = cardIcon(view);
          return <Link key={view.slug} to={`/admin/aml-network/${view.slug}`} className={`card kpi-card aml-summary-card tone-${cardTone(view)}`} data-ui-id={`aml-${view.slug}`}>
          <div className="row spread nowrap"><span className="l">{view.label}</span><span className="chip"><Icon size={20} aria-hidden="true" /></span></div>
          <strong className="v">{id === "employees" ? employees.length : recordsFor(view).length}<span className="sr-only"> {id === "employees" ? "employees" : "records"}</span></strong>
          <span className="aml-card-action">View list <ArrowRight size={16} aria-hidden="true" /></span>
        </Link>; })}
      </div>
    </section>)}
    <p className="muted aml-subtext">Sample data only. Select a card to open its full list.</p>
  </div>;
}

function AMLListPage() {
  const { sectionSlug } = useParams();
  const current = views.find((item) => item.slug === sectionSlug);
  return current ? <AMLRecords key={current.slug} view={current} /> : <Navigate to="/admin/aml-network" replace />;
}

function AMLRecords({ view }: { view: ListView }) {
  const section = view.section;
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const group = sections.find((item) => item.id === section)!;
  const current = { ...group, label: view.label };
  const isRequest = section === "purchases" && !view.purchaseOrders;
  const partyLabel = isRequest ? "Requested by" : view.purchaseOrders ? "Supplier" : "Payee";
  const term = search.trim().toLowerCase();
  const matches = (values: string[]) => values.some((value) => value.toLowerCase().includes(term));
  const people = employees.filter((person) => matches(Object.values(person)));
  const records = recordsFor(view).filter((record) => matches([record.reference, record.name, record.description, record.status]));
  const count = section === "employees" ? people.length : records.length;

  return (
    <div className="admin-detail-page aml-page">
      <Link className="aml-back-link" to="/admin/aml-network"><ArrowLeft size={17} aria-hidden="true" /> AML Network</Link>
      <div className="page-title"><div><div className="row"><h1>{current.label}</h1><span className="badge">Mock preview</span></div><p className="muted aml-subtext">{current.hint}</p></div></div>
      <section className="card flush" aria-labelledby="aml-section-title">
        <div className="aml-toolbar">
          <h2 id="aml-section-title">{section === "employees" ? "Employees" : "Records"}</h2>
          <label className="catalog-search aml-search"><MagnifyingGlass size={19} aria-hidden="true" /><span className="sr-only">Search {current.label}</span><input className="input" type="search" placeholder={section === "employees" ? "Search employees…" : "Search reference, name or status…"} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
        <div className="aml-record-count muted" role="status">{count} {section === "employees" ? "employees" : "records"} · Sample data only</div>
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
            <thead><tr><th>Reference</th><th>{partyLabel} / {section === "purchases" ? "Items" : "Purpose"}</th><th className="r">{isRequest ? "Estimated cost" : "Amount"}</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{records.map((record) => <tr key={record.reference}>
              <td data-label="Reference"><strong className="aml-reference">{record.reference}</strong><div className="muted aml-table-subtext">{record.date}</div></td>
              <td data-label={partyLabel}><strong>{record.name}</strong><div className="muted aml-table-subtext">{record.description}</div></td>
              <td data-label={isRequest ? "Estimated cost" : "Amount"} className="r num"><strong>{peso(record.amount)}</strong></td>
              <td data-label="Status"><span className={`badge ${statusTone(record.status)}`}>{record.status}</span></td>
              <td data-label="Actions"><button type="button" className="btn sm" aria-label={`View ${record.reference}`} onClick={() => setPreview({ title: record.reference, fields: [{ label: "Document", value: current.label }, { label: partyLabel, value: record.name }, { label: "Description", value: record.description }, { label: "Date", value: record.date }, { label: isRequest ? "Estimated cost" : "Amount", value: peso(record.amount) }, { label: "Status", value: record.status }] })}>View details</button></td>
            </tr>)}</tbody>
          </>}
        </table></div>}
      </section>
      {preview && <Modal title={preview.title} onClose={() => setPreview(null)}><p className="muted aml-subtext">Mock preview · Sample data only</p><dl className="aml-details">{preview.fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl><div className="admin-form-actions"><button type="button" className="btn primary" onClick={() => setPreview(null)}>Close</button></div></Modal>}
    </div>
  );
}
