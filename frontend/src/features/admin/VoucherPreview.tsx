import { ArrowLeft, ArrowsOut, FilePdf, Printer, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useParams } from "react-router-dom";
import { Button, Empty } from "../../components/ui";
import { PaymentEntry, VoucherPrintOptions, paymentEntries, voucherAmountWords, voucherMoney, voucherNetAmount, voucherPrintConfig } from "../../lib/paymentEntries";
import { createVoucherPdf } from "../../lib/voucherPdf";

function VoucherDocument({ entry, options }: { entry: PaymentEntry; options: VoucherPrintOptions }) {
  return <article className="voucher-document" aria-label={`Disbursement voucher ${entry.reference}`}>
    <header className="voucher-document-header">{voucherPrintConfig.logoUrl ? <img className="voucher-company-logo" src={voucherPrintConfig.logoUrl} alt={`${entry.company} logo`} /> : <div className="voucher-company-mark" aria-label="Company logo placeholder">ACC</div>}<div><h2>{entry.company}</h2><p>{voucherPrintConfig.formatCode} – {voucherPrintConfig.title} – {voucherPrintConfig.revisionDate}</p></div></header>
    <div className="voucher-document-stamp"><strong>SAMPLE - UI PREVIEW</strong><span>{entry.status}</span></div>
    <div className="voucher-document-info"><div><p><strong>Pay To:</strong> {entry.payee}</p><p><strong>Cost Center:</strong> {entry.costCenter}</p><p><strong>Terms of Payment:</strong> {entry.terms || "—"}</p><p><strong>Purchase Invoice Number:</strong> {entry.invoice || "—"}</p></div><div><p><strong>Voucher No.:</strong> {entry.reference}</p><p><strong>Date Posted:</strong> {entry.date}</p><p><strong>P.O Number:</strong> {entry.purchaseOrder || "—"}</p><p><strong>P.R Number:</strong> {entry.purchaseRequest || "—"}</p></div></div>
    <table className="voucher-particulars"><thead><tr><th>PARTICULARS</th><th>AMOUNT</th></tr></thead><tbody>{entry.particulars.map((item, index) => <tr key={index}><td>{item.description}</td><td>{voucherMoney(item.amount)}</td></tr>)}</tbody><tfoot><tr><th>Net Amount</th><td>{voucherMoney(voucherNetAmount(entry))}</td></tr></tfoot></table>
    <table className="voucher-payments"><thead><tr><th>Type</th><th>Check Bank</th><th>Check No.</th><th>Date</th><th>Amount</th></tr></thead><tbody>{entry.payments.map((payment, index) => <tr key={index}><td>{payment.type}</td><td>{payment.bank || "—"}</td><td>{payment.checkNumber || "—"}</td><td>{payment.date}</td><td>{voucherMoney(payment.amount)}</td></tr>)}</tbody></table>
    <section className="voucher-document-section"><h3>Bank Details</h3><table className="voucher-bank-details"><tbody><tr><th>Bank</th><td>{entry.bank}</td></tr><tr><th>Account Name</th><td>{entry.accountName}</td></tr><tr><th>Account Number</th><td>{entry.accountNumber}</td></tr></tbody></table></section>
    {options.notes && <section className="voucher-document-section"><h3>Internal Notes:</h3><p className="voucher-notes">{entry.notes || "None"}</p></section>}
    <p className="voucher-amount-words">Received the amount of <strong>{voucherAmountWords(voucherNetAmount(entry))}</strong></p>
    {options.signatures && <section className="voucher-approval-block" aria-label="Approval and receipt"><div className="voucher-approvals"><div><p>Recommending Approval:</p><div className="voucher-signatory"><strong>{voucherPrintConfig.recommending.name}</strong><span>{voucherPrintConfig.recommending.title}</span></div></div><div><p>Approved by:</p><div className="voucher-signatory"><strong>{voucherPrintConfig.approved.name}</strong><span>{voucherPrintConfig.approved.title}</span></div></div></div><div className="voucher-receiver"><p>Received By:</p><strong>{voucherPrintConfig.receivedBy}</strong><em>(SIGNATURE OVER PRINTED NAME)</em></div></section>}
    <footer>Sample data - for UI review only. Not an official payment voucher.</footer>
  </article>;
}

function VoucherPrint({ entry, options, onClose, onError }: { entry: PaymentEntry; options: VoucherPrintOptions; onClose: () => void; onError: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    const previousTitle = document.title;
    document.title = `${entry.reference}-voucher-sample`;
    window.addEventListener("afterprint", onClose);
    const images = Array.from(root.current?.querySelectorAll("img") ?? []);
    Promise.all([document.fonts.ready, ...images.map((img) => img.decode().catch(() => {}))]).then(() => {
      if (!active) return;
      try { window.print(); } catch { onError(); onClose(); }
    });
    return () => { active = false; document.title = previousTitle; window.removeEventListener("afterprint", onClose); };
  }, [entry, options, onClose, onError]);
  return createPortal(<div id="voucher-print-root" ref={root}><VoucherDocument entry={entry} options={options} /></div>, document.body);
}

function VoucherPreviewContent() {
  const { reference } = useParams();
  const location = useLocation();
  const entry = paymentEntries.find((item) => item.reference === reference);
  const [options, setOptions] = useState<VoucherPrintOptions>({ notes: true, signatures: true });
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fullPage, setFullPage] = useState(false);
  const [printing, setPrinting] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
  const closePrint = useCallback(() => setPrinting(false), []);
  const printError = useCallback(() => setError("Printing is unavailable. Download the PDF and print it from your PDF viewer."), []);
  const from = (location.state as { from?: string } | null)?.from;
  const back = from?.startsWith("/admin/aml-network/") ? from : "/admin/aml-network/disbursement-vouchers";
  if (!entry) return <div className="admin-detail-page"><Link className="aml-back-link" to={back}><ArrowLeft size={17} aria-hidden="true" /> Voucher list</Link><Empty icon={<FilePdf size={32} />} title="Voucher not found" hint="Return to the list and select a sample voucher." /></div>;

  async function pdf(action: "preview" | "download") {
    if (!entry) return;
    setBusy(action); setError("");
    try {
      const doc = await createVoucherPdf(entry, options);
      if (!alive.current) return;
      if (action === "download") doc.save(`${entry.reference}-voucher-sample.pdf`);
      else setPdfUrl(URL.createObjectURL(doc.output("blob")));
    } catch { if (alive.current) setError("The PDF could not be created. Try again or use Print to save a PDF."); }
    finally { if (alive.current) setBusy(""); }
  }
  return <div className={`admin-detail-page aml-page voucher-preview-page${fullPage ? " voucher-full-page" : ""}`}>
    <Link className="aml-back-link" to={back}><ArrowLeft size={17} aria-hidden="true" /> Disbursement Voucher List</Link>
    <div className="page-title"><div><div className="row"><h1>{entry.reference}</h1><span className={`badge ${entry.status === "Submitted" ? "ok" : entry.status === "Cancelled" ? "bad" : "warn"}`}>{entry.status}</span></div><p className="muted aml-subtext">Disbursement Voucher / Payment Entry · Sample preview</p></div>
      <div className="row voucher-actions"><button type="button" className="btn" aria-pressed={fullPage} onClick={() => setFullPage(!fullPage)}>{fullPage ? <X size={18} aria-hidden="true" /> : <ArrowsOut size={18} aria-hidden="true" />}{fullPage ? "Standard view" : "Full page"}</button><Button loading={busy === "download"} disabled={!!busy || printing} onClick={() => pdf("download")}><FilePdf size={18} aria-hidden="true" />Download PDF</Button><Button className="primary" disabled={!!busy || printing} onClick={() => { setError(""); setPrinting(true); }}><Printer size={18} aria-hidden="true" />Print</Button></div>
    </div>
    {error && <p className="err" role="alert">{error}</p>}
    <div className="voucher-preview-layout">
      <aside className="card voucher-options" aria-label="Print settings"><h2>Print settings</h2><dl><div><dt>Print format</dt><dd>Disbursement Voucher</dd></div><div><dt>Paper</dt><dd>A4 · Portrait</dd></div><div><dt>Language</dt><dd>English</dd></div></dl>
        <label className="requisition-checkbox"><input type="checkbox" checked={options.notes} disabled={!!busy || printing} onChange={(event) => { setPdfUrl(null); setOptions({ ...options, notes: event.target.checked }); }} />Include internal notes</label>
        <label className="requisition-checkbox"><input type="checkbox" checked={options.signatures} disabled={!!busy || printing} onChange={(event) => { setPdfUrl(null); setOptions({ ...options, signatures: event.target.checked }); }} />Include approval and receipt</label>
        <Button loading={busy === "preview"} disabled={!!busy || printing} onClick={() => pdfUrl ? setPdfUrl(null) : pdf("preview")}><FilePdf size={18} aria-hidden="true" />{pdfUrl ? "Document preview" : "PDF preview"}</Button>
        {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="aml-subtext">Open PDF in a new tab</a>}
        <p className="muted aml-subtext">Preview data only. Print format and field mappings can be configured for your ERP later.</p>
      </aside>
      <div className="voucher-preview-canvas" aria-busy={busy === "preview"}>{pdfUrl ? <iframe className="voucher-pdf-frame" title={`PDF preview for ${entry.reference}`} src={pdfUrl}><p>Use Download PDF to view this document.</p></iframe> : <VoucherDocument entry={entry} options={options} />}</div>
    </div>
    {printing && <VoucherPrint entry={entry} options={options} onClose={closePrint} onError={printError} />}
  </div>;
}

export default function VoucherPreview() {
  const { reference } = useParams();
  return <VoucherPreviewContent key={reference} />;
}
