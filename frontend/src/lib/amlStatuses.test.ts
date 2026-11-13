import { describe, expect, it } from "vitest";
import { matchesCard, paymentPending, paymentReturned, paymentStates, purchasePending, purchaseStatuses, purchaseWorkflowStates, requisitionPending, requisitionStates, uniqueStates } from "./amlStatuses";

describe("proposed AML card groups", () => {
  it("keeps the supplied spelling and case while grouping requisition approval stages", () => {
    expect(requisitionStates).toHaveLength(28);
    expect(requisitionPending).toContain("pending in ABD Head");
    expect(requisitionPending).toContain("Forward to Project Manager");
    expect(requisitionPending).toContain("Pending in RS Support");
    expect(matchesCard("Pending in ABD Head", undefined, requisitionPending)).toBe(false);
    expect(requisitionPending).not.toContain("Returned to Requestor");
    expect(requisitionPending).not.toContain("For MR/DPO");
  });
  it("separates payment approvals and returns without merging Cancel and Cancelled", () => {
    expect(paymentStates).toHaveLength(45);
    expect(paymentPending).toContain("Pending in GM");
    expect(paymentReturned).toContain("GM returned for review in ABD");
    expect(paymentReturned).toContain("Returned to Requestor");
    expect(paymentPending.some((state) => paymentReturned.includes(state))).toBe(false);
    expect(uniqueStates(paymentStates)).toEqual(expect.arrayContaining(["Cancel", "Cancelled"]));
    expect(matchesCard("Cancelled", "Cancel")).toBe(false);
  });
  it("keeps purchase fulfillment statuses separate from workflow stages", () => {
    expect(purchaseStatuses).toHaveLength(9);
    expect(purchaseWorkflowStates).toHaveLength(33);
    expect(purchasePending).toContain("Old PO for approval by GM");
    expect(purchasePending).not.toContain("For Purchase");
    expect(purchaseStatuses).not.toContain("For Purchase");
    const order = { status: "To Receive", workflow: "For Purchase" };
    expect(matchesCard(order.status, "To Receive")).toBe(true);
    expect(matchesCard(order.workflow, "For Purchase")).toBe(true);
    expect(matchesCard(order.status, "For Purchase")).toBe(false);
  });
});
