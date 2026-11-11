import { describe, expect, it } from "vitest";
import { NEXT, PH_MOBILE, availablePayments, canSendProof, cleanPhone, isOpen, peso } from "./format";

describe("format", () => {
  it("formats pesos", () => {
    expect(peso(10)).toBe("₱10");
    expect(peso("112.5")).toBe("₱112.50");
  });
  it("validates PH mobiles", () => {
    expect(PH_MOBILE.test(cleanPhone("+63 917-123-4567"))).toBe(true);
    expect(PH_MOBILE.test("0817123456")).toBe(false);
  });
  it("only allows forward status transitions", () => {
    expect(NEXT["Delivered Successfully"]).toEqual([]);
    expect(NEXT["Out for Delivery"]).not.toContain("Order Confirmed");
    expect(NEXT["Order Placed"]).toEqual(["Order Confirmed", "Cancelled"]);
    expect(NEXT["Order Confirmed"]).toContain("Preparing");
  });
  it("knows which orders are still open", () => {
    expect(isOpen("Preparing")).toBe(true);
    expect(isOpen("Delivered Successfully")).toBe(false);
    expect(isOpen("Cancelled")).toBe(false);
  });
  it("hides e-wallets until real numbers are set", () => {
    expect(availablePayments(undefined)).toEqual(["COD"]);
    expect(availablePayments({ gcash_number: "09XX-XXX-XXXX", maya_number: "09XX-XXX-XXXX", bank_details: "" })).toEqual(["COD"]);
    expect(availablePayments({ gcash_number: "0917 123 4567", maya_number: "", bank_details: "BDO 123" })).toEqual(["COD", "GCash", "Bank Transfer"]);
  });
  it("offers proof upload only for unpaid non-COD orders that are not yet being prepared", () => {
    const o = { payment_method: "GCash", payment_status: "unpaid", status: "Order Placed" };
    expect(canSendProof(o)).toBe(true);
    expect(canSendProof({ ...o, payment_method: "COD" })).toBe(false);
    expect(canSendProof({ ...o, payment_status: "proof_sent" })).toBe(false);
    expect(canSendProof({ ...o, status: "Preparing" })).toBe(false);
  });
});
