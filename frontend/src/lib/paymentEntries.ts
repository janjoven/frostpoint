export type PaymentEntry = {
  reference: string; status: "Draft" | "Submitted" | "Cancelled"; company: string; payee: string; costCenter: string;
  date: string; terms: string; invoice: string; purchaseOrder: string; purchaseRequest: string;
  particulars: { description: string; amount: number }[];
  payments: { type: string; bank: string; checkNumber: string; date: string; amount: number }[];
  bank: string; accountName: string; accountNumber: string; notes: string;
};
// Preview fixtures only. Future ERP mapping supplies the same document shape.
export const paymentEntries: PaymentEntry[] = [
  {
    reference: "PE-DEMO-001", status: "Draft", company: "ALGIMAR CONSTRUCTION CORPORATION", payee: "Masbate Ice Supplies",
    costCenter: "Masbate Main Office - AC", date: "2026-11-12", terms: "Payment upon delivery", invoice: "PINV-DEMO-001",
    purchaseOrder: "PO-DEMO-001", purchaseRequest: "PR-DEMO-001",
    particulars: [{ description: "Ice production materials and food-grade packaging supplies", amount: 10000 }, { description: "Delivery and handling", amount: 2500 }],
    payments: [{ type: "Bank Transfer", bank: "Sample Bank", checkNumber: "", date: "2026-11-12", amount: 12500 }],
    bank: "Sample Bank", accountName: "Sample supplier account", accountNumber: "DEMO-0001", notes: "Sample voucher for UI review. Supporting documents to be attached before submission.",
  },
  {
    reference: "PE-DEMO-002", status: "Submitted", company: "ALGIMAR CONSTRUCTION CORPORATION", payee: "Island Fuel Depot",
    costCenter: "Delivery Operations - AC", date: "2026-11-10", terms: "Cash", invoice: "PINV-DEMO-002", purchaseOrder: "PO-DEMO-002", purchaseRequest: "PR-DEMO-002",
    particulars: [{ description: "Delivery vehicle fuel reimbursement", amount: 3200 }],
    payments: [{ type: "Cash", bank: "", checkNumber: "", date: "2026-11-10", amount: 3200 }],
    bank: "", accountName: "", accountNumber: "", notes: "Sample submitted Payment Entry. No real payment has been processed.",
  },
  {
    reference: "PE-DEMO-003", status: "Cancelled", company: "ALGIMAR CONSTRUCTION CORPORATION", payee: "City Power Services",
    costCenter: "Masbate Main Office - AC", date: "2026-11-09", terms: "Bank transfer", invoice: "PINV-DEMO-003", purchaseOrder: "", purchaseRequest: "",
    particulars: [{ description: "November utilities payment", amount: 8400 }],
    payments: [{ type: "Bank Transfer", bank: "Sample Bank", checkNumber: "", date: "2026-11-09", amount: 8400 }],
    bank: "Sample Bank", accountName: "Sample utilities account", accountNumber: "DEMO-0003", notes: "Cancelled sample voucher retained for document preview.",
  },
];
export const voucherPrintConfig = {
  title: "Disbursement Voucher", formatCode: "TFD-QF001-00", currency: "PHP",
  revisionDate: "October 07, 2024",
  // Replace with the approved company logo asset during print-format configuration.
  logoUrl: "",
  recommending: { name: "SAMPLE RECOMMENDING OFFICER", title: "TFD Head" },
  approved: { name: "SAMPLE APPROVING OFFICER", title: "Vice President" },
  receivedBy: "SAMPLE RECIPIENT",
};
export type VoucherPrintOptions = { notes: boolean; signatures: boolean };
export const voucherNetAmount = (entry: PaymentEntry) => entry.particulars.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
export const voucherMoney = (amount: number) => `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function voucherAmountWords(amount: number) {
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("Voucher amount must be a non-negative, finite amount.");
  const small = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  const hundred = (value: number): string => {
    if (value < 20) return small[value];
    if (value < 100) return tens[Math.floor(value / 10)] + (value % 10 ? " " + small[value % 10] : "");
    return small[Math.floor(value / 100)] + " HUNDRED" + (value % 100 ? " " + hundred(value % 100) : "");
  };
  let whole = Math.floor(cents / 100), scale = 0;
  const parts: string[] = [], scales = ["", " THOUSAND", " MILLION", " BILLION", " TRILLION"];
  do { const group = whole % 1000; if (group) parts.unshift(hundred(group) + scales[scale]); whole = Math.floor(whole / 1000); scale++; } while (whole);
  return `${voucherPrintConfig.currency} ${parts.join(", ") || "ZERO"}${cents % 100 ? ` AND ${String(cents % 100).padStart(2, "0")}/100` : ""} ONLY.`;
}
