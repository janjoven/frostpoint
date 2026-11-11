import { isOpen } from "./format";

export const ADMIN_ORDER_FILTERS = ["All", "Pending", "Completed", "Cancelled"] as const;
export type OrderFilter = typeof ADMIN_ORDER_FILTERS[number];
export type OrderSort = "newest" | "oldest";
type ListOrder = { id: number; status: string; receiver_name: string; phone: string; created_at: string };

export function orderCounts(orders: ListOrder[]): Record<OrderFilter, number> {
  return { All: orders.length, Pending: orders.filter((o) => isOpen(o.status)).length, Completed: orders.filter((o) => o.status === "Delivered Successfully").length, Cancelled: orders.filter((o) => o.status === "Cancelled").length };
}

export function filterAdminOrders<T extends ListOrder>(orders: T[], filter: OrderFilter, term: string, sort: OrderSort): T[] {
  const text = term.trim().toLowerCase();
  const number = text.replace(/^#\s*/, "");
  const phone = text.replace(/[\s()-]/g, "");
  return orders.filter((o) => {
    if (filter === "Pending" && !isOpen(o.status)) return false;
    if (filter === "Completed" && o.status !== "Delivered Successfully") return false;
    if (filter === "Cancelled" && o.status !== "Cancelled") return false;
    return !text || (number !== "" && String(o.id).includes(number)) || o.receiver_name.toLowerCase().includes(text) || (phone !== "" && o.phone.replace(/[\s()-]/g, "").includes(phone));
  }).sort((a, b) => {
    const difference = (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0) || a.id - b.id;
    return sort === "oldest" ? difference : -difference;
  });
}
