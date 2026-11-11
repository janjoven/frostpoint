import { describe, expect, it } from "vitest";
import { filterAdminOrders, orderCounts } from "./adminOrderList";

const orders = [
  { id: 1036, receiver_name: "Maria Santos", phone: "09171234567", status: "Order Placed", created_at: "2026-11-11T02:00:00Z" },
  { id: 1035, receiver_name: "Juan Dela Cruz", phone: "09170000000", status: "Delivered Successfully", created_at: "2026-11-10T02:00:00Z" },
  { id: 1034, receiver_name: "Maria Santos", phone: "09171234567", status: "Cancelled", created_at: "2026-11-09T02:00:00Z" },
  { id: 1033, receiver_name: "Ana Reyes", phone: "09173333333", status: "Out for Delivery", created_at: "2026-11-08T02:00:00Z" },
];
describe("admin order list", () => {
  it("counts and filters orders by their actual progress", () => {
    expect(orderCounts(orders)).toEqual({ All: 4, Pending: 2, Completed: 1, Cancelled: 1 });
    expect(filterAdminOrders(orders, "Pending", "", "newest").map((o) => o.id)).toEqual([1036, 1033]);
    expect(filterAdminOrders(orders, "Completed", "", "newest")[0].id).toBe(1035);
    expect(filterAdminOrders(orders, "Cancelled", "", "newest")[0].id).toBe(1034);
  });
  it("accepts order numbers prefixed with #", () => {
    expect(filterAdminOrders(orders, "All", " #1036 ", "newest").map((o) => o.id)).toEqual([1036]);
  });
  it("finds customers regardless of case and accepts formatted phone numbers", () => {
    expect(filterAdminOrders(orders, "All", "MARIA", "newest")).toHaveLength(2);
    expect(filterAdminOrders(orders, "All", "0917 123 4567", "newest")).toHaveLength(2);
  });
  it("combines searches with the selected filter", () => {
    expect(filterAdminOrders(orders, "Pending", "Maria", "newest").map((o) => o.id)).toEqual([1036]);
    expect(filterAdminOrders(orders, "Completed", "Maria", "newest")).toHaveLength(0);
  });
  it("sorts by date without modifying the source array", () => {
    expect(filterAdminOrders(orders, "All", "", "oldest").map((o) => o.id)).toEqual([1033, 1034, 1035, 1036]);
    expect(orders[0].id).toBe(1036);
  });
});
