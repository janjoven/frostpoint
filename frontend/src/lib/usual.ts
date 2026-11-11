import type { Product } from "../store";

type PastOrder = { status: string; items: { product_id: number | null; qty: number }[] };

/**
 * "Your usual": the lines of the customer's latest non-cancelled order, limited to products that are
 * still on sale and clamped to current stock. `orders` is newest first, as returned by /orders/mine.
 */
export function usualLines(orders: PastOrder[] | undefined, products: Product[] | undefined) {
  const last = orders?.find((o) => o.status !== "Cancelled");
  if (!last || !products) return [];
  const lines: { p: Product; qty: number }[] = [];
  for (const it of last.items) {
    const p = products.find((x) => x.id === it.product_id && x.is_active);
    if (!p) continue;
    const qty = Math.min(it.qty, p.stock);
    if (qty >= p.min_order_qty) lines.push({ p, qty });
  }
  return lines;
}
