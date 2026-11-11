import { describe, expect, it } from "vitest";
import type { Product } from "../store";
import { usualLines } from "./usual";

const prod = (id: number, over: Partial<Product> = {}): Product => ({
  id, name: `P${id}`, category: "Ice Tube", price: "10", uom: "kg", stock: 100, description: "", badge: "", min_order_qty: 5, low_stock_at: 20, is_active: true, ...over,
});

describe("usualLines", () => {
  const products = [prod(1), prod(2, { stock: 3 }), prod(3, { is_active: false })];
  it("uses the latest order that was not cancelled", () => {
    const orders = [
      { status: "Cancelled", items: [{ product_id: 2, qty: 5 }] },
      { status: "Delivered Successfully", items: [{ product_id: 1, qty: 10 }] },
    ];
    expect(usualLines(orders, products)).toEqual([{ p: products[0], qty: 10 }]);
  });
  it("drops inactive products and lines that no longer meet the minimum", () => {
    const orders = [{ status: "Delivered Successfully", items: [{ product_id: 2, qty: 5 }, { product_id: 3, qty: 5 }, { product_id: null, qty: 5 }] }];
    expect(usualLines(orders, products)).toEqual([]); // product 2 has only 3 left, below its minimum of 5
  });
  it("clamps to current stock", () => {
    expect(usualLines([{ status: "Order Placed", items: [{ product_id: 1, qty: 500 }] }], products)).toEqual([{ p: products[0], qty: 100 }]);
  });
  it("returns nothing while data is loading", () => {
    expect(usualLines(undefined, products)).toEqual([]);
    expect(usualLines([], undefined)).toEqual([]);
  });
});
