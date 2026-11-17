import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { MOCK_MODE } from "./mockMode";
import { useAuth } from "../store";

export const requisitionApi = "/admin/erp/requisitions";
export type ERPRequisition = {
  reference: string; status: string; projectName: string; withMR: boolean;
  requestedBy: string; costCenter: string; date: string; modified: string;
};
export type ERPRequisitionItem = {
  id: string; name: string; uom: string; quantity: string; amount: number | null;
  particulars: string; forDocument: string; itemType: string; itemOrExpense: string; attachment: boolean;
};
export type ERPRequisitionDetail = ERPRequisition & {
  requesterContact: string; requiredDate: string; equipment: string; notes: string;
  projectLocation: string; approvedBy: string; approvedContact: string;
  items: ERPRequisitionItem[]; canEdit: boolean; readOnlyReason: string; erpUrl: string;
};
export type ERPRequisitionSummary = { prefix: string; byStatus: Record<string, number> };
export type ERPRequisitionPage = { records: ERPRequisition[]; total: number; page: number; pageSize: number; prefix: string };

export function useERPRequisitionSummary() {
  const user = useAuth((s) => s.user);
  return useQuery({
    queryKey: ["erp-requisitions", user?.id, "summary"],
    queryFn: () => api<ERPRequisitionSummary>(`${requisitionApi}/summary`),
    enabled: !MOCK_MODE && user?.role === "admin",
    staleTime: 0, gcTime: 0, retry: false,
  });
}

export function summaryCount(summary: ERPRequisitionSummary, status?: string, statuses?: string[]) {
  return Object.entries(summary.byStatus).reduce((sum, [state, count]) =>
    sum + ((!status && !statuses || state === status || statuses?.includes(state)) ? count : 0), 0);
}
