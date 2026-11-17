import { describe, expect, it } from "vitest";
import { summaryCount } from "./erpRequisitions";

describe("ERP requisition counts", () => {
  const summary = { prefix: "ACS-RS-", byStatus: { Pending: 15, "Pending in PLD Head": 1, "For MR/DPO": 2 } };
  it("counts the full scope and each workflow group", () => {
    expect(summaryCount(summary)).toBe(18);
    expect(summaryCount(summary, "For MR/DPO")).toBe(2);
    expect(summaryCount(summary, undefined, ["Pending", "Pending in PLD Head"])).toBe(16);
    expect(summaryCount(summary, "Returned to Requestor")).toBe(0);
  });
});
