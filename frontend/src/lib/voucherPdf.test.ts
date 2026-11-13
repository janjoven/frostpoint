import { describe, expect, it } from "vitest";
import { paymentEntries, voucherAmountWords, voucherNetAmount } from "./paymentEntries";
import { createVoucherPdf } from "./voucherPdf";

describe("voucher PDF", () => {
  it("exports each selected voucher on A4 with the matching ID, status and total", async () => {
    for (const entry of paymentEntries) {
      const pdf = await createVoucherPdf(entry, { notes: true, signatures: true });
      const content = pdf.output();
      expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
      expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(297, 0);
      expect(pdf.getNumberOfPages()).toBe(1);
      expect(content).toContain(entry.reference);
      expect(content).toContain(entry.status.toUpperCase());
      expect(content).toContain("SAMPLE - UI PREVIEW");
      expect(content).toContain(voucherNetAmount(entry).toLocaleString("en-PH", { minimumFractionDigits: 2 }));
      for (const other of paymentEntries.filter((item) => item !== entry)) expect(content).not.toContain(other.reference);
    }
  });
  it("omits notes and signature lines when those print options are off", async () => {
    const entry = { ...paymentEntries[0], notes: "PRIVATE-NOTES-UNIQUE-TOKEN" };
    const pdf = await createVoucherPdf(entry, { notes: false, signatures: false });
    expect(pdf.output()).not.toContain(entry.notes);
    expect(pdf.output()).not.toContain("Recommending Approval");
  });
  it("continues long table cells and notes onto additional pages without losing the ending", async () => {
    const entry = {
      ...paymentEntries[0],
      particulars: [{ description: Array.from({ length: 500 }, (_, i) => `Materials detail ${i + 1}.`).join(" ") + " FINAL-ITEM-TOKEN", amount: 12500 }],
      notes: Array.from({ length: 100 }, (_, i) => `Review note ${i + 1}.`).join("\n") + " FINAL-NOTE-TOKEN",
    };
    const pdf = await createVoucherPdf(entry, { notes: true, signatures: true });
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    expect(pdf.output()).toContain("FINAL-ITEM-TOKEN");
    expect(pdf.output()).toContain("FINAL-NOTE-TOKEN");
    expect(pdf.output()).toContain("Received By");
  });
});

describe("voucher amount in words", () => {
  it("matches whole-peso receipt wording and represents centavos without loss", () => {
    expect(voucherAmountWords(2300)).toBe("PHP TWO THOUSAND, THREE HUNDRED ONLY.");
    expect(voucherAmountWords(12500.55)).toBe("PHP TWELVE THOUSAND, FIVE HUNDRED AND 55/100 ONLY.");
    expect(voucherAmountWords(0)).toBe("PHP ZERO ONLY.");
    expect(voucherAmountWords(999.999)).toBe("PHP ONE THOUSAND ONLY.");
    expect(() => voucherAmountWords(-1)).toThrow();
  });
});
