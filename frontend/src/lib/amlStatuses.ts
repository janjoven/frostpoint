// Inventory supplied by the user. Group membership is a UI proposal, pending ERP review.
export const requisitionStates = [
  "Pending", "Forward to PLD Head", "Forward to ABD Head", "Forward to TFD Head", "Forward to EID Head",
  "Forward to BCD Head", "Forward to PRD Head", "Forward to QAD Head", "Forward to EOD Head", "Forward to HRD Head",
  "Forward to QMD", "Pending in QMD", "Pending in PLD Head", "pending in ABD Head", "Pending in TFD Head",
  "Pending in EID Head", "Pending in BCD Head", "Pending in PRD Head", "Pending in QAD Head", "Pending in EOD Head",
  "Pending in HRD Head", "Returned to Requestor", "Forward to Project Manager", "Forward to Project Engineer",
  "For MR/DPO", "Pending in Project Engineer", "Pending in Project Manager", "Pending in RS Support",
];
export const paymentStates = [
  "Pending", "Pending in ABD", "Pending in EID Head", "Pending in EOD Head", "Pending in HRD Head", "Pending in PLD Head",
  "Pending in PRD Head", "Pending in QAD Head", "Pending in BCD Head", "Pending in ICT Head", "Pending in BCD", "Pending in TFD Head",
  "ABD returned for review in EID Head", "ABD returned for review in EOD Head", "ABD returned for review in HRD Head",
  "ABD returned for review in PLD Head", "ABD returned for review in PRD Head", "ABD returned for review in QAD Head",
  "ABD returned for review in ICT Head", "Pending in GM", "GM returned for review in ABD", "GM returned for review in EID",
  "GM returned for review in EOD", "GM returned for review in HRD", "GM returned for review in PLD", "GM returned for review in PRD",
  "GM returned for review in ICT", "Approved", "Received", "Cancel", "Cancelled", "GM returned for review in QAD", "Rejected",
  "ABD returned for review in PLD", "Pending in PLD", "Draft", "Draft", "Received", "Approved", "Received", "Returned to Requestor",
  "Pending in TFD Head", "Completed", "Approved", "Received",
];
export const purchaseStatuses = ["Draft", "On Hold", "To Receive and Bill", "To Bill", "To Receive", "Completed", "Cancelled", "Closed", "Delivered"];
export const purchaseWorkflowStates = [
  "Pending", "Pending", "Pending in PLD Head", "Pending in EID Head", "Pending in EOD Head", "Pending in AGM", "Pending in GM",
  "Returned for review in PLD Head", "Returned for review in EID Head", "Returned for review in EOD Head", "Old PO for approval by GM",
  "For Purchase", "To Postpaid Bill", "To Prepaid Bill", "Rejected by GM", "Rejected by AGM", "PLD returned for review",
  "EID returned for review in PLD", "EOD returned for review in PLD", "AGM returned for review in EID", "AGM returned for review in EOD",
  "AGM returned for review in PLD", "GM returned for review in PLD", "GM returned for review in EID", "GM returned for review in EOD",
  "Cancelled", "PLD returned for review in Purchasing Officer", "Approved and Signed", "For Purchase", "Completed", "Completed", "Completed", "Approved and Signed",
];
export const employeeStatuses = ["Active", "Inactive", "Suspended", "Left"];
export const voucherStatuses = ["Draft", "Submitted", "Cancelled"];
export const uniqueStates = (states: string[]) => [...new Set(states)];
export const requisitionPending = requisitionStates.filter((state) => /^pending\b/i.test(state) || state.startsWith("Forward to "));
export const paymentPending = uniqueStates(paymentStates).filter((state) => state.startsWith("Pending"));
export const paymentReturned = uniqueStates(paymentStates).filter((state) => state.includes("returned for review") || state === "Returned to Requestor");
export const purchasePending = uniqueStates(purchaseWorkflowStates).filter((state) => state.startsWith("Pending") || state === "Old PO for approval by GM");
export function matchesCard(value: string, status?: string, statuses?: string[]) {
  return statuses ? statuses.includes(value) : !status || value === status;
}
