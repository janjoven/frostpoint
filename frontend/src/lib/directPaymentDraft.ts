export type PaymentRow = { id: string; values: Record<string, string> };
export const paymentFields = {
  paymentType: "Direct Expense", company: "", department: "", transactionDate: "", requestorName: "", rsNumber: "",
  payeeType: "", payee: "", bankAccount: "", accountName: "", receivedBy: "", equipment: "",
  projectId: "", equipmentCode: "", costCenter: "", governmentProjectId: "", expenseType: "", deliveryPoint: "",
  discountPercentage: "", discountAmount: "", taxCategory: "", taxCharges: "", cashAdvanceReference: "", refundAmount: "", notes: "",
};
export type PaymentField = keyof typeof paymentFields;
export type PaymentDraft = {
  fields: typeof paymentFields;
  approvedSigned: boolean; audited: boolean; eGovPaid: boolean; summaryPayments: boolean;
  references: PaymentRow[]; expenses: PaymentRow[]; cashAdvances: PaymentRow[];
};
const KEY = "fp-aml-direct-payment-draft-v1";
export function emptyPaymentDraft(): PaymentDraft {
  return { fields: { ...paymentFields }, approvedSigned: false, audited: false, eGovPaid: false, summaryPayments: false, references: [], expenses: [], cashAdvances: [] };
}
export function loadPaymentDraft(): PaymentDraft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!draft?.fields || !Object.keys(paymentFields).every((key) => typeof draft.fields[key] === "string")) return null;
    if (!["approvedSigned", "audited", "eGovPaid", "summaryPayments"].every((key) => typeof draft[key] === "boolean")) return null;
    if (!["references", "expenses", "cashAdvances"].every((key) => Array.isArray(draft[key]) && draft[key].every((row: PaymentRow) => row && typeof row.id === "string" && row.values && typeof row.values === "object" && !Array.isArray(row.values) && Object.values(row.values).every((value) => typeof value === "string")))) return null;
    return draft as PaymentDraft;
  } catch { return null; }
}
export function savePaymentDraft(draft: PaymentDraft) { localStorage.setItem(KEY, JSON.stringify(draft)); }
export function paymentTotals(draft: PaymentDraft) {
  const cents = (value: string) => Math.round((Number(value) || 0) * 100);
  const expenses = draft.expenses.reduce((sum, row) => sum + cents(row.values.amount), 0);
  const discount = Math.round(expenses * (Number(draft.fields.discountPercentage) || 0) / 100) + cents(draft.fields.discountAmount);
  return { expenses: expenses / 100, total: Math.max(0, expenses - discount + cents(draft.fields.taxCharges)) / 100 };
}
