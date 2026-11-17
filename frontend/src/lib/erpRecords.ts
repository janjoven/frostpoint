import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { MOCK_MODE } from "./mockMode";
import { useAuth } from "../store";

export const erpSections = ["payments", "purchases", "vouchers", "employees"] as const;
export type ERPSection = typeof erpSections[number];
export const erpRecordsApi = "/admin/erp/records";
export const sectionLabels: Record<ERPSection, string> = {
  payments: "Direct Payment Order", purchases: "Purchase Order", vouchers: "Disbursement Voucher / Payment Entry", employees: "Employee",
};
export const sectionSlugs: Record<ERPSection, string> = {
  payments: "direct-payment-orders", purchases: "purchase-orders", vouchers: "disbursement-vouchers", employees: "employees",
};
export type ERPRecord = {
  reference: string; name: string; company: string; status: string; workflowState: string; date: string;
  amount: string | null; currency: string; modified: string; department: string; designation: string; companyEmail: string;
};
export type ERPRecordSummary = { section: ERPSection; doctype: string; total: number; buckets: { status: string; workflowState: string; count: number }[] };
export type ERPRecordPage = { section: ERPSection; doctype: string; records: ERPRecord[]; total: number; page: number; pageSize: number };
export type ERPRecordDetail = ERPRecord & {
  section: ERPSection; doctype: string; canEdit: false; erpUrl: string;
  fields: { label: string; value: string; type: string; currency: string }[];
  tables: { label: string; columns: { field: string; label: string; type: string }[]; rows: Record<string, string>[] }[];
};

export function erpSummaryCount(summary: ERPRecordSummary, status?: string, statuses?: string[], field: "status" | "workflowState" = "status") {
  return summary.buckets.reduce((total, bucket) => {
    const value = bucket[field];
    return total + ((!status && !statuses || value === status || statuses?.includes(value)) ? bucket.count : 0);
  }, 0);
}

export function formatERPAmount(value: string | number | null | undefined, currency = "") {
  if (value == null || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  const number = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return currency ? `${currency} ${number}` : number;
}

function summaryQuery(section: ERPSection, user?: { id: number; role: string } | null) {
  return { queryKey: ["erp-records", user?.id, section, "summary"],
    queryFn: () => api<ERPRecordSummary>(`${erpRecordsApi}/${section}/summary`),
    enabled: !MOCK_MODE && user?.role === "admin", staleTime: 0, gcTime: 0, retry: false as const };
}

export function useERPSectionSummaries() {
  const user = useAuth((s) => s.user);
  const queries = useQueries({ queries: erpSections.map((section) => summaryQuery(section, user)) });
  return { payments: queries[0], purchases: queries[1], vouchers: queries[2], employees: queries[3] };
}

export function useERPRecordSummary(section: ERPSection) {
  const user = useAuth((s) => s.user);
  return useQuery(summaryQuery(section, user));
}
