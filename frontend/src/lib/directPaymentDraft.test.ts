import { describe, expect, it, vi, afterEach } from "vitest";
import { emptyPaymentDraft, loadPaymentDraft, paymentTotals, savePaymentDraft } from "./directPaymentDraft";

afterEach(() => vi.unstubAllGlobals());
describe("payment draft preview totals", () => {
  it("adds decimal expenses in cents and applies discounts before entered tax", () => {
    const draft = emptyPaymentDraft();
    draft.expenses = [{ id: "1", values: { amount: "100.10" } }, { id: "2", values: { amount: "200.20" } }];
    draft.fields.discountPercentage = "10";
    draft.fields.discountAmount = "5";
    draft.fields.taxCharges = "12.50";
    expect(paymentTotals(draft)).toEqual({ expenses: 300.3, total: 277.77 });
  });
  it("handles empty drafts and prevents a negative preview total", () => {
    const draft = emptyPaymentDraft();
    expect(paymentTotals(draft)).toEqual({ expenses: 0, total: 0 });
    draft.fields.discountAmount = "500";
    expect(paymentTotals(draft).total).toBe(0);
  });
});
describe("payment draft storage", () => {
  it("round trips the form and table rows", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const draft = emptyPaymentDraft();
    draft.fields.payee = "Example supplier";
    draft.expenses = [{ id: "1", values: { expense: "Supplies", amount: "50" } }];
    savePaymentDraft(draft);
    expect(loadPaymentDraft()).toEqual(draft);
  });
  it("rejects damaged drafts and handles unavailable storage", () => {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ fields: { payee: "Broken" } }) });
    expect(loadPaymentDraft()).toBeNull();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("Storage blocked"); } });
    expect(loadPaymentDraft()).toBeNull();
  });
});
