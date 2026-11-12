import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockRequest, mockUser, resetMocks, switchMockRole } from "./api";

const stored = new Map<string, string>();
beforeEach(() => {
  stored.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => stored.set(k, v) });
  resetMocks();
});

describe("frontend mock workflow", () => {
  it("starts as a customer and keeps API response copies separate", async () => {
    expect(mockUser()?.role).toBe("customer");
    const products = await mockRequest("/products");
    products[0].stock = 0;
    expect((await mockRequest("/products"))[0].stock).toBe(500);
  });

  it("quotes, places and tracks an order, with edits visible to other demo roles", async () => {
    const body = { items: [{ product_id: 1, qty: 5 }], mode: "delivery", location: "MASBATE CITY", receiver_name: "Maria Santos", payment_method: "COD" };
    const quote = await mockRequest("/quote", { body });
    expect(quote).toMatchObject({ subtotal: "50.00", delivery_fee: "12.00", total: "62.00" });
    const order = await mockRequest("/orders", { body });
    expect((await mockRequest("/orders/mine"))[0].id).toBe(order.id);
    expect((await mockRequest("/products"))[0].stock).toBe(495);
    switchMockRole("admin");
    await mockRequest(`/orders/${order.id}/rider`, { method: "PATCH", body: { rider_id: 4 } });
    switchMockRole("rider");
    expect((await mockRequest("/rider/orders")).some((o: any) => o.id === order.id)).toBe(true);
    await mockRequest(`/rider/orders/${order.id}/start`, { method: "POST" });
    switchMockRole("customer");
    expect(await mockRequest(`/orders/${order.id}/track`)).toMatchObject({ status: "Out for Delivery", eta_minutes: 8 });
  });

  it("validates quantities and applies the free delivery threshold", async () => {
    await expect(mockRequest("/quote", { body: { items: [{ product_id: 1, qty: 1 }] } })).rejects.toThrow("quantity");
    const q = await mockRequest("/quote", { body: { items: [{ product_id: 1, qty: 50 }], mode: "delivery" } });
    expect(q.delivery_fee).toBe("0.00");
  });

  it("persists changes after reload and resets the demo", async () => {
    switchMockRole("admin");
    await mockRequest("/products/1/stock", { method: "PATCH", body: { stock: 22 } });
    vi.resetModules();
    const reloaded = await import("./api");
    expect(reloaded.mockUser()?.role).toBe("admin");
    expect((await reloaded.mockRequest("/products"))[0].stock).toBe(22);
    reloaded.resetMocks();
    expect((await reloaded.mockRequest("/products"))[0].stock).toBe(500);
  });

  it("provides dashboard, report and support shapes used by the pages", async () => {
    switchMockRole("admin");
    const stats = await mockRequest("/admin/stats");
    expect(stats.spark).toHaveLength(30);
    expect(stats.low_stock_items[0].name).toBe("Ice Block");
    expect((await mockRequest("/admin/reports/weekly")).series).toHaveLength(7);
    await mockRequest("/support/threads/1", { body: { body: "Your delivery is scheduled." } });
    switchMockRole("customer");
    expect((await mockRequest("/support/mine")).at(-1).body).toBe("Your delivery is scheduled.");
  });

  it("supports guests and rejects unknown routes without a network fallback", async () => {
    switchMockRole("guest");
    expect(mockUser()).toBeNull();
    expect(await mockRequest("/products")).toHaveLength(4);
    await expect(mockRequest("/orders/mine")).rejects.toMatchObject({ status: 401 });
    switchMockRole("admin");
    await expect(mockRequest("/unimplemented")).rejects.toMatchObject({ status: 501 });
    await expect(mockRequest("/admin/reports/weekly/export.xlsx")).rejects.toThrow("real API");
  });
});
