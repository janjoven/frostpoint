import { PaymentEntry, VoucherPrintOptions, voucherAmountWords, voucherMoney, voucherNetAmount, voucherPrintConfig } from "./paymentEntries";

export async function createVoucherPdf(entry: PaymentEntry, options: VoucherPrintOptions) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let logo: string | undefined;
  if (voucherPrintConfig.logoUrl) {
    const response = await fetch(voucherPrintConfig.logoUrl);
    if (!response.ok) throw new Error("Company logo could not be loaded");
    const blob = await response.blob();
    logo = `data:${blob.type};base64,${btoa(Array.from(new Uint8Array(await blob.arrayBuffer()), (byte) => String.fromCharCode(byte)).join(""))}`;
  }
  const margin = 19, width = 172, bottom = 276;
  let y = 0;
  const write = (text: string, x: number, top: number, bold = false, size = 9, align: "left" | "right" | "center" = "left") => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(24, 32, 43);
    if (text.startsWith("₱")) {
      // Draw the peso sign as vectors so standard PDF fonts need no font download.
      const digits = text.slice(1), signWidth = 2.8, totalWidth = doc.getTextWidth(digits) + signWidth;
      const left = align === "right" ? x - totalWidth : align === "center" ? x - totalWidth / 2 : x;
      doc.text("P", left, top); doc.setDrawColor(24, 32, 43); doc.setLineWidth(0.15);
      doc.line(left - 0.2, top - 1.9, left + 2, top - 1.9); doc.line(left - 0.2, top - 1.4, left + 2, top - 1.4);
      doc.text(digits, left + signWidth, top);
    } else doc.text(text, x, top, { align });
  };
  const header = () => {
    if (logo) doc.addImage(logo, margin + 2, 20, 25, 25);
    else { doc.setDrawColor(80); doc.setLineWidth(0.3); doc.circle(margin + 14.5, 32.5, 12); write("ACC", margin + 14.5, 34, true, 12, "center"); }
    const titleX = margin + 33;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    const title = doc.splitTextToSize(entry.company, width - 33) as string[];
    title.forEach((line, index) => write(line, titleX, 29 + index * 5, true, 13));
    const titleBottom = 30.5 + (title.length - 1) * 5;
    doc.setDrawColor(30); doc.setLineWidth(0.5); doc.line(titleX, titleBottom, margin + width, titleBottom);
    write(`${voucherPrintConfig.formatCode} - ${voucherPrintConfig.title} - ${voucherPrintConfig.revisionDate}`, titleX, titleBottom + 4, true, 7);
    write(`SAMPLE - UI PREVIEW | ${entry.status.toUpperCase()}`, margin, 51, false, 7);
    y = 61;
  };
  const ensure = (height: number) => { if (y + height > bottom) { doc.addPage(); header(); } };
  const lines = (text: string, available: number): string[] => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    return doc.splitTextToSize(text || "-", available);
  };
  const metadata = [
    [`Pay To: ${entry.payee}`, `Voucher No.: ${entry.reference}`],
    [`Cost Center: ${entry.costCenter}`, `Date Posted: ${entry.date}`],
    [`Terms of Payment: ${entry.terms || "-"}`, `P.O Number: ${entry.purchaseOrder || "-"}`],
    [`Purchase Invoice Number: ${entry.invoice || "-"}`, `P.R Number: ${entry.purchaseRequest || "-"}`],
  ];
  header();
  metadata.forEach(([left, right]) => {
    const l = lines(left, 108), r = lines(right, 58), h = Math.max(l.length, r.length) * 4.5 + 1;
    ensure(h); l.forEach((line, i) => write(line, margin, y + i * 4.5)); r.forEach((line, i) => write(line, margin + 114, y + i * 4.5)); y += h;
  });
  y += 5;
  function table(headers: string[] | null, rows: string[][], widths: number[], red = false, rightLabels = false) {
    const drawHeader = () => {
      if (!headers) return;
      let x = margin;
      headers.forEach((label, index) => {
        doc.setFillColor(...(red ? [239, 68, 68] : [243, 246, 248]) as [number, number, number]);
        doc.setDrawColor(20); doc.setLineWidth(0.2); doc.rect(x, y, widths[index], 6, "FD");
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(red ? 255 : 24);
        doc.text(label, x + 1.2, y + 4.2); x += widths[index];
      });
      y += 6;
    };
    ensure(20); drawHeader();
    rows.forEach((row) => {
      // Split exceptionally long cells so content is never dropped at a page boundary.
      const wrapped = row.map((cell, index) => cell ? lines(cell, widths[index] - 4) : [""]);
      const maxLines = Math.max(...wrapped.map((cell) => cell.length));
      let offset = 0;
      while (offset < maxLines) {
        if (bottom - y < 10) { doc.addPage(); header(); drawHeader(); }
        const count = Math.min(maxLines - offset, Math.max(1, Math.floor((bottom - y - 4) / 4.5)));
        const h = count * 4.5 + 2;
        let x = margin;
        wrapped.forEach((cell, index) => {
          doc.setDrawColor(70); doc.setLineWidth(0.2); doc.rect(x, y, widths[index], h);
          cell.slice(offset, offset + count).forEach((line, lineIndex) => write(line, rightLabels && index === 0 ? x + widths[index] - 1.2 : x + 1.2, y + 4.5 + lineIndex * 4.5, false, 9, rightLabels && index === 0 ? "right" : "left"));
          x += widths[index];
        });
        y += h; offset += count;
      }
    });
    y += 5;
  }
  table(["PARTICULARS", "AMOUNT"], entry.particulars.map((item) => [item.description, voucherMoney(item.amount)]), [142, 30], true);
  ensure(10); y -= 5;
  doc.setDrawColor(20); doc.rect(margin + 142, y, 30, 6.5);
  write("Net Amount", margin + 141, y + 4.5, true, 9, "right"); write(voucherMoney(voucherNetAmount(entry)), margin + 143.2, y + 4.5);
  y += 11;
  table(["Type", "Check Bank", "Check No.", "Date", "Amount"], entry.payments.map((payment) => [payment.type, payment.bank, payment.checkNumber, payment.date, voucherMoney(payment.amount)]), [22, 41, 36, 39, 34]);
  ensure(35); write("Bank Details", margin, y, true, 10); y += 5;
  table(null, [["Bank", entry.bank], ["Account Name", entry.accountName], ["Account Number", entry.accountNumber]], [119, 53], false, true);
  if (options.notes) {
    ensure(20); write("Internal Notes:", margin, y, true, 10); y += 3;
    const noteLines = lines(entry.notes || "None", width - 5);
    let offset = 0;
    while (offset < noteLines.length) {
      ensure(10);
      const count = Math.min(noteLines.length - offset, Math.max(1, Math.floor((bottom - y - 5) / 4.5)));
      const h = Math.max(10, count * 4.5 + 5);
      doc.setDrawColor(195); doc.setFillColor(246, 246, 246); doc.roundedRect(margin, y, width, h, 1, 1, "FD");
      noteLines.slice(offset, offset + count).forEach((line, i) => write(line, margin + 2.5, y + 5 + i * 4.5));
      y += h; offset += count;
    }
    y += 8;
  }
  const receipt = lines(`Received the amount of ${voucherAmountWords(voucherNetAmount(entry))}`, width);
  ensure(receipt.length * 4.5 + (options.signatures ? 66 : 8));
  receipt.forEach((line) => {
    const prefix = "Received the amount of ";
    let x = margin, words = line;
    if (line.startsWith(prefix)) { write(prefix, x, y, false, 8); x += doc.getTextWidth(prefix); words = line.slice(prefix.length); }
    write(words, x, y, true, 8); doc.setDrawColor(24, 32, 43); doc.setLineWidth(0.15); doc.line(x, y + 0.6, x + doc.getTextWidth(words), y + 0.6);
    y += 4.5;
  });
  y += 9;
  if (options.signatures) {
    ensure(57);
    write("Recommending Approval:", margin + 1, y); write("Approved by:", margin + 93, y);
    write(voucherPrintConfig.recommending.name, margin + 43, y + 8, false, 9, "center");
    write(voucherPrintConfig.recommending.title, margin + 43, y + 12, false, 9, "center");
    write(voucherPrintConfig.approved.name, margin + 133, y + 8, false, 9, "center");
    write(voucherPrintConfig.approved.title, margin + 133, y + 12, false, 9, "center");
    write("Received By:", margin + width / 2, y + 27, false, 9, "center");
    write(voucherPrintConfig.receivedBy, margin + width / 2, y + 39, false, 10, "center");
    doc.setFont("helvetica", "italic"); doc.setFontSize(8);
    doc.text("(SIGNATURE OVER PRINTED NAME)", margin + width / 2, y + 44, { align: "center" });
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text("Sample data - for UI review only. Not an official payment voucher.", margin, 287);
    doc.text(`${page} / ${pages}`, margin + width, 287, { align: "right" });
  }
  doc.setProperties({ title: `${entry.reference} - Disbursement Voucher (Sample)`, subject: "Payment Entry UI preview", creator: "Frostpoint" });
  return doc;
}
