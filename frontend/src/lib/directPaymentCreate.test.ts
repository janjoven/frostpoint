import { describe, expect, it } from "vitest";
import { expenseAmount, paymentCreateBody } from "./directPaymentCreate";
import { emptyPaymentDraft } from "./directPaymentDraft";

describe("Direct Payment Order creation", () => {
  it("rounds fractional unit prices exactly to match backend decimals", () => {
    expect(expenseAmount("1", "1.005")).toBe("1.01");
    expect(expenseAmount("3", "33.3366")).toBe("100.01");
    expect(expenseAmount("0.001", "5")).toBe("0.01");
    expect(expenseAmount("0", "1")).toBe("0.00");
    expect(expenseAmount("", "1")).toBeNull();
  });
  it("does not transmit local approval, audit, paid or cleared flags", () => {
    const draft = emptyPaymentDraft();
    draft.approvedSigned = draft.audited = draft.eGovPaid = true;
    draft.cashAdvances = [{ id: "row", values: { clear: "1", amount: "2" } }];
    const result = paymentCreateBody(draft, "request-id");
    expect(result).not.toHaveProperty("approvedSigned");
    expect(result).not.toHaveProperty("audited");
    expect(result).not.toHaveProperty("eGovPaid");
    expect(result.cashAdvances[0]).not.toHaveProperty("clear");
    expect(result.fields.discountAmount).toBe("0");
  });
});
