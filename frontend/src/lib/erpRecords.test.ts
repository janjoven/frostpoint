import { describe, expect, it } from "vitest";
import { ERPRecordSummary, erpSummaryCount, formatERPAmount } from "./erpRecords";

describe("ERP record summaries", () => {
  const summary: ERPRecordSummary = { section: "purchases", doctype: "Purchase Order", total: 8, buckets: [
    { status: "To Receive", workflowState: "For Purchase", count: 3 },
    { status: "To Bill", workflowState: "For Purchase", count: 2 },
    { status: "Draft", workflowState: "Pending in GM", count: 3 },
  ] };
  it("keeps workflow groups separate from fulfillment totals", () => {
    expect(erpSummaryCount(summary)).toBe(8);
    expect(erpSummaryCount(summary, "For Purchase", undefined, "workflowState")).toBe(5);
    expect(erpSummaryCount(summary, "To Receive")).toBe(3);
    expect(erpSummaryCount(summary, undefined, ["Pending in GM"], "workflowState")).toBe(3);
  });
  it("uses the ERP currency and retains zero values", () => {
    expect(formatERPAmount("17.5", "USD")).toBe("USD 17.50");
    expect(formatERPAmount(0)).toBe("0.00");
    expect(formatERPAmount(null)).toBe("—");
    expect(formatERPAmount("not an amount")).toBe("not an amount");
  });
});
