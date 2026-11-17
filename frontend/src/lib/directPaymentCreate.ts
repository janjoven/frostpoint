import { PaymentDraft } from "./directPaymentDraft";

/** Decimal multiplication with half-up rounding to cents, matching the backend. */
export function expenseAmount(quantity: string, rate: string): string | null {
  const parse = (value: string) => {
    const match = /^(\d*)(?:\.(\d*))?$/.exec(value.trim());
    if (!match || !(match[1] + (match[2] ?? ""))) return null;
    return { digits: BigInt((match[1] || "0") + (match[2] ?? "")), scale: (match[2] ?? "").length };
  };
  const q = parse(quantity), r = parse(rate);
  if (!q || !r) return null;
  const denominator = 10n ** BigInt(q.scale + r.scale);
  const cents = (q.digits * r.digits * 100n + denominator / 2n) / denominator;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

export function paymentCreateBody(draft: PaymentDraft, requestId: string) {
  const fields = { ...draft.fields };
  for (const key of ["discountPercentage", "discountAmount", "taxCharges", "refundAmount"] as const) fields[key] ||= "0";
  return { requestId, fields,
    expenses: draft.expenses.map(({ values: v }) => ({ expense: v.expense || "", particulars: v.particulars || "",
      qty: v.qty || null, uom: v.uom || "", unitCost: v.unitCost || null, amount: v.amount || "0" })),
    references: draft.references.map(({ values: v }) => ({ type: v.type || "", name: v.name || "", amount: v.amount || "0" })),
    cashAdvances: draft.cashAdvances.map(({ values: v }) => ({ type: v.type || "CA Repayment", payee: v.payee || "",
      bank: v.bank || "", checkNumber: v.checkNumber || "", date: v.date || null, amount: v.amount || "0" })),
  };
}
