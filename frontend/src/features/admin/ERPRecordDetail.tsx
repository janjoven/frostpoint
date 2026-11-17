import { ArrowLeft, ArrowClockwise } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ErrorState, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { ERPRecordDetail as RecordDetail, ERPSection, erpRecordsApi, erpSections, formatERPAmount, sectionLabels, sectionSlugs } from "../../lib/erpRecords";
import { MOCK_MODE } from "../../lib/mockMode";
import { useAuth } from "../../store";

export default function ERPRecordDetail({ sectionOverride }: { sectionOverride?: ERPSection }) {
  const params = useParams();
  const section = sectionOverride ?? params.section as ERPSection;
  const reference = params.reference ?? "";
  const valid = erpSections.includes(section);
  const user = useAuth((s) => s.user);
  const query = useQuery({ queryKey: ["erp-records", user?.id, section, "detail", reference],
    queryFn: () => api<RecordDetail>(`${erpRecordsApi}/${section}/${encodeURIComponent(reference)}`),
    enabled: !MOCK_MODE && valid && user?.role === "admin", retry: false, gcTime: 0, staleTime: 0 });
  if (!valid) return <p role="alert">ERP section not found.</p>;
  if (MOCK_MODE) return <p>Live ERP records are available in real API development mode.</p>;
  if (user?.role !== "admin") return <p role="alert">Admin access is required to review ERP records.</p>;
  const doc = query.data;
  return <div className="admin-detail-page aml-page erp-record-detail">
    <Link className="aml-back-link" to={`/admin/aml-network/${sectionSlugs[section]}`}><ArrowLeft size={17} aria-hidden="true" /> Back</Link>
    {query.isError ? <ErrorState error={query.error} retry={() => query.refetch()} /> : !doc ? <Skeleton /> : <>
      <div className="page-title"><div><div className="row"><h1>{section === "employees" ? doc.name || doc.reference : doc.reference}</h1><span className="badge">{doc.status || "No status"}</span></div><p className="muted aml-subtext">{sectionLabels[section]} · {doc.company || "Company not specified"} · Last updated: {doc.modified}</p></div><div className="row"><button className="btn" disabled={query.isFetching} onClick={() => query.refetch()}><ArrowClockwise size={18} aria-hidden="true" />Refresh</button><a className="btn" href={doc.erpUrl} target="_blank" rel="noreferrer">Open in ERP</a></div></div>
      <p className="muted aml-subtext">Read-only ERP record.{section === "vouchers" ? " Official voucher printing is available through ERP." : ""}</p>
      {section === "purchases" && <div className="row"><span className="badge">Approval Stage: {doc.workflowState || "—"}</span><span className="badge">Order Status: {doc.status || "—"}</span></div>}
      <section className="card"><h2>Record details</h2><dl className="aml-details erp-record-fields"><div><dt>Record ID</dt><dd>{doc.reference}</dd></div>{doc.fields.map((f) => <div key={f.label}><dt>{f.label}</dt><dd className="erp-record-value">{f.type === "money" ? formatERPAmount(f.value, f.currency) : f.value || "—"}</dd></div>)}</dl></section>
      {doc.tables.map((table) => <section className="card flush" key={table.label}><div className="aml-toolbar"><h2>{table.label}</h2></div><div className="table-wrap"><table><thead><tr><th>No.</th>{table.columns.map((col) => <th key={col.field}>{col.label}</th>)}</tr></thead><tbody>{table.rows.map((row, i) => <tr key={i}><td>{i + 1}</td>{table.columns.map((col) => <td key={col.field} className="erp-record-value">{col.type === "money" ? formatERPAmount(row[col.field], section === "purchases" ? doc.currency : "") : row[col.field] || "—"}</td>)}</tr>)}</tbody></table></div></section>)}
    </>}
  </div>;
}
