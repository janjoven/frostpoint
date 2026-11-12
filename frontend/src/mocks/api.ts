import type { Product, User } from "../store";
import type { Order } from "../features/admin/OrderParts";

type Row = Record<string, any>;
type MockOrder = Order & { customer_id: number };
const KEY = "fp-mock-v1";
const iso = (days = 0) => new Date(Date.now() - days * 86400000).toISOString();
const statuses = ["Order Placed", "Order Confirmed", "Preparing", "Out for Delivery", "Delivered Successfully", "Cancelled"];
const money = (n: number) => n.toFixed(2);
const sum = (rows: Row[], key: string) => rows.reduce((n, r) => n + Number(r[key]), 0);
export const mockRoles = ["guest", "customer", "admin", "owner", "staff", "rider"] as const;
export type MockRole = typeof mockRoles[number];

function demoPromotions() {
  return [
    { id: 1, title: "Cool days, fresh deliveries", message: "Free delivery on orders over PHP 500. Stock up for your next gathering!" },
    { id: 2, title: "Keep every gathering cool", message: "From family celebrations to busy weekends, find crushed ice, ice blocks and ice tubes for your plans." },
    { id: 3, title: "Fresh water, delivered to your door", message: "Running low on drinking water? Add purified water to your order and choose a delivery time that works for you." },
  ].map((promotion) => ({ ...promotion, starts_at: null, ends_at: null, created_at: iso() }));
}

function seed() {
  const users: (User & Row)[] = [
    [1, "customer", "Maria Santos", "customer1@example.com"],
    [2, "admin", "Alex Admin", "admin@frostpoint.ph"],
    [3, "staff", "Rico Staff", "staff@frostpoint.ph"],
    [4, "rider", "Ramil Rider", "rider@frostpoint.ph"],
    [5, "owner", "Andrea Owner", "owner@frostpoint.ph"],
    [6, "customer", "Juan Dela Cruz", "customer2@example.com"],
  ].map(([id, role, name, email]) => ({ id, role, name, email, phone: "09171234567", address: "Zone 3, Masbate City", is_active: true, created_at: iso(30) })) as (User & Row)[];
  const products: Product[] = [
    { id: 1, name: "Crushed Ice", category: "Crushed Ice", price: "10.00", uom: "kg", stock: 500, description: "Fine crushed ice for drinks, coolers and fish.", badge: "Best Seller", min_order_qty: 5, low_stock_at: 50, is_active: true },
    { id: 2, name: "Ice Block", category: "Ice Block", price: "350.00", uom: "pc", stock: 8, description: "Full-size ice block for events and fish preservation.", badge: "", min_order_qty: 1, low_stock_at: 10, is_active: true },
    { id: 3, name: "Ice Tube", category: "Ice Tube", price: "10.00", uom: "kg", stock: 800, description: "Clear ice tubes for restaurants, stores and gatherings.", badge: "Popular", min_order_qty: 5, low_stock_at: 50, is_active: true },
    { id: 4, name: "Purified H2O", category: "Purified Water", price: "35.00", uom: "gal", stock: 120, description: "Fresh purified drinking water in 5-gallon containers.", badge: "", min_order_qty: 1, low_stock_at: 20, is_active: true },
  ];
  const orders: MockOrder[] = Array.from({ length: 36 }, (_, i) => {
    const p = products[i % 4], qty = p.min_order_qty + i % 3;
    const status = statuses[i % 6], when = iso(i / 2), customer = users[i % 3 === 0 ? 5 : 0];
    const subtotal = Number(p.price) * qty, fee = i % 5 === 0 ? 0 : 12;
    return {
      id: 1036 - i, customer_id: customer.id, customer_name: customer.name, receiver_name: customer.name,
      phone: customer.phone, address: customer.address, location: "MASBATE CITY", mode: fee ? "delivery" : "pickup",
      schedule_at: i % 4 === 0 ? iso(-1) : null, payment_method: i % 2 ? "GCash" : "COD", payment_ref: "",
      payment_status: status === statuses[4] ? "paid" : i % 2 ? "unpaid" : "cod_due",
      has_proof: false, has_delivery_proof: false, notes: i % 3 ? "" : "Please ring the doorbell.",
      subtotal: money(subtotal), delivery_fee: money(fee), total: money(subtotal + fee), status,
      cancel_reason: status === "Cancelled" ? "Customer changed delivery date" : "", created_at: when,
      items: [{ product_id: p.id, name: p.name, qty, price: p.price }],
      events: statuses.slice(0, status === "Cancelled" ? 1 : i % 6 + 1).map((s) => ({ status: s, at: when })),
      dest_lat: 12.371, dest_lng: 123.624, rider_id: 4, rider_name: "Ramil Rider", rider_accepted_at: null,
    };
  });
  return {
    session: 1 as number | null, users, products, orders,
    settings: { default_delivery_fee: "12", free_delivery_threshold: "500", gcash_number: "09170000000", gcash_name: "Frostpoint Demo", maya_number: "09170000000", maya_name: "Frostpoint Demo", bank_details: "Demo bank details — no real payments" } as Record<string, string>,
    addresses: [{ id: 1, customer_id: 1, label: "Home", location: "MASBATE CITY", address: "Zone 3, Masbate City", lat: 12.371, lng: 123.624, is_default: true }] as Row[],
    iceRates: [{ id: 1, location: "MASBATE CITY", per_piece_rate: "50", flat_fee: null }, { id: 2, location: "MOBO", per_piece_rate: null, flat_fee: "150" }] as Row[],
    fixedRates: ["Crushed Ice", "Ice Tube", "Purified Water"].map((category, i) => ({ id: i + 1, category, location: "MASBATE CITY", fee: "12" })) as Row[],
    promotionSeedVersion: 1,
    announcements: demoPromotions() as Row[],
    messages: [{ id: 1, customer_id: 1, sender: "customer", body: "Hi! Can I schedule a water delivery for tomorrow?", created_at: iso() }, { id: 2, customer_id: 1, sender: "admin", body: "Of course! Choose your preferred time at checkout.", created_at: iso() }] as Row[],
    activity: [{ id: 1, action: "Added", description: "Demo catalog and orders loaded", user_name: "Alex Admin", user_email: "admin@frostpoint.ph", created_at: iso(), meta: {} }] as Row[],
  };
}

type Database = ReturnType<typeof seed>;
function read(): Database {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const data: Database = JSON.parse(saved);
      // Add carousel examples to existing demos once, preserving user-created data.
      if (!data.promotionSeedVersion) {
        for (const promotion of demoPromotions()) {
          if (!data.announcements.some((item) => item.title === promotion.title)) {
            data.announcements.push({ ...promotion, id: Math.max(0, ...data.announcements.map((item) => Number(item.id))) + 1 });
          }
        }
        data.promotionSeedVersion = 1;
      }
      return data;
    }
  } catch { /* private browsing */ }
  return seed();
}
let db = read();
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* keep in memory */ } }
export function mockUser() { return db.users.find((u) => u.id === db.session) ?? null; }
export function switchMockRole(role: MockRole) { db.session = db.users.find((u) => u.role === role)?.id ?? null; save(); return mockUser(); }
export function resetMocks() { db = seed(); save(); }
function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
const nextId = (rows: Row[]) => Math.max(0, ...rows.map((r) => Number(r.id))) + 1;
function live(a: Row) { return (!a.starts_at || a.starts_at <= iso()) && (!a.ends_at || a.ends_at >= iso()); }

function quote(body: Row) {
  const items = (body.items ?? []).map((line: Row) => {
    const p = db.products.find((p) => p.id === line.product_id);
    if (!p || !p.is_active) fail("Product is unavailable");
    if (!Number.isInteger(line.qty) || line.qty < p.min_order_qty || line.qty > p.stock) fail(`Check the quantity for ${p.name}`);
    return { product_id: p.id, name: p.name, category: p.category, qty: line.qty, price: p.price };
  });
  if (!items.length) fail("Add an item to your cart");
  const subtotal = items.reduce((n: number, i: Row) => n + i.qty * Number(i.price), 0);
  const threshold = Number(db.settings.free_delivery_threshold);
  const free = threshold > 0 && subtotal >= threshold;
  const fees = items.map((i: Row) => {
    if (i.category === "Ice Block") { const r = db.iceRates.find((r) => r.location === body.location); return r ? r.per_piece_rate != null ? Number(r.per_piece_rate) * i.qty : Number(r.flat_fee) : Number(db.settings.default_delivery_fee); }
    return Number(db.fixedRates.find((r) => r.location === body.location && r.category === i.category)?.fee ?? db.settings.default_delivery_fee);
  });
  const fee = body.mode === "pickup" || free ? 0 : fees.reduce((n: number, f: number) => n + f, 0);
  return { items, subtotal: money(subtotal), delivery_fee: money(fee), total: money(subtotal + fee), notes: free ? ["Free delivery applied (demo pricing)"] : ["Sample delivery pricing for UI preview"] };
}

function report(period = "monthly") {
  const days = ({ daily: 1, weekly: 7, monthly: 30, yearly: 365 } as Row)[period] ?? 30;
  const orders = db.orders.filter((o) => o.status !== "Cancelled" && o.created_at >= iso(days));
  const products = db.products.map((p) => {
    const qty = orders.flatMap((o) => o.items).filter((i) => i.name === p.name).reduce((n, i) => n + i.qty, 0);
    return { name: p.name, price: Number(p.price), qty, total: qty * Number(p.price) };
  });
  const series = Array.from({ length: Math.min(days, 30) }, (_, i) => {
    const date = iso(Math.min(days, 30) - i - 1).slice(0, 10), rows = orders.filter((o) => o.created_at.startsWith(date));
    return { date, label: date, revenue: sum(rows, "total"), orders: rows.length };
  });
  const revenue = sum(orders, "total");
  return { revenue, orders: orders.length, average: orders.length ? revenue / orders.length : 0, delivery_fees: sum(orders, "delivery_fee"), products, series };
}

// All requests terminate here in mock mode; unknown routes never reach the real API.
export async function mockRequest(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<any> {
  const result = handle(path, opts);
  save();
  // Clone like a JSON response so editing a fixture cannot silently mutate query caches.
  return result === undefined || result instanceof Blob ? result : structuredClone(result);
}

function handle(path: string, opts: { method?: string; body?: unknown; form?: FormData }): any {
  const url = new URL(path, "http://mock.local"), p = url.pathname, q = url.searchParams;
  const method = opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET");
  const b = (opts.body ?? {}) as Row, user = mockUser();
  if (p === "/auth/logout") { db.session = null; return; }
  if (p === "/auth/me") return user ?? fail("Choose a demo role", 401);
  if (p === "/auth/login" || p === "/auth/register") {
    let account = db.users.find((u) => u.email.toLowerCase() === String(b.email).toLowerCase());
    if (p.endsWith("register")) {
      if (account) fail("This email is already registered in the demo");
      account = { id: nextId(db.users), email: b.email, name: b.name, role: "customer", phone: b.phone, address: b.address, is_active: true, created_at: iso() };
      db.users.push(account);
    }
    if (!account) fail("Use a demo email or the role switcher. Any password works in mock mode.", 401);
    db.session = account.id;
    return { access_token: "mock-token", user: account };
  }
  if (p === "/promotions") return db.announcements.filter(live);
  if (p === "/locations") return [...new Set([...db.iceRates, ...db.fixedRates].map((r) => r.location))];
  if (p === "/products" && method === "GET") return db.products.filter((p) => q.get("all") === "true" || p.is_active);
  if (!user) fail("Choose a demo role or sign in", 401);
  if (p === "/settings") { if (method === "PUT") Object.assign(db.settings, b); return db.settings; }
  if (p === "/quote") return quote(b);
  if (p === "/orders" && method === "POST") {
    const priced = quote(b);
    const order: MockOrder = { ...db.orders[0], ...b, ...priced, notes: b.notes ?? "", id: nextId(db.orders), customer_id: user.id, customer_name: user.name, status: statuses[0], created_at: iso(), payment_status: b.payment_method === "COD" ? "cod_due" : "unpaid", has_proof: false, has_delivery_proof: false, rider_id: null, rider_name: "", rider_accepted_at: null, cancel_reason: "", events: [{ status: statuses[0], at: iso() }] };
    priced.items.forEach((i: Row) => { db.products.find((p) => p.id === i.product_id)!.stock -= i.qty; });
    db.orders.unshift(order); return order;
  }
  if (p === "/orders") return db.orders;
  if (p === "/orders/mine") return db.orders.filter((o) => o.customer_id === user.id);
  if (p === "/riders") return db.users.filter((u) => u.role === "rider");
  if (p === "/rider/location") return { ok: true };
  if (p === "/rider/orders") return db.orders.filter((o) => o.rider_id === user.id && o.status !== "Cancelled").map((o) => ({ ...o, accepted_at: o.rider_accepted_at, cash_to_collect: o.payment_method === "COD" && o.payment_status !== "paid" ? o.total : "0" }));
  const orderMatch = p.match(/^\/(?:rider\/)?orders\/(\d+)(?:\/(.+))?$/);
  if (orderMatch) {
    const o = db.orders.find((o) => o.id === Number(orderMatch[1])) ?? fail("Demo order not found", 404), action = orderMatch[2];
    if (action === "track") return { status: o.status, dest: o.dest_lat == null ? null : { lat: o.dest_lat, lng: o.dest_lng }, eta_minutes: 8, rider: o.rider_id ? { name: o.rider_name, lat: 12.368, lng: 123.618, accuracy: 15, updated_at: iso(), stale: false } : null, route: { coords: [[123.618, 12.368], [123.621, 12.369], [123.624, 12.371]], distance_m: 850, source: "straight" } };
    if (action === "proof" || action === "delivery-proof") {
      if (method === "GET") return new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#e0f2fe"/><text x="35" y="160" font-size="24">Demo upload preview</text></svg>'], { type: "image/svg+xml" });
      o.has_proof = true; if (o.payment_method !== "COD") o.payment_status = "proof_sent"; return o;
    }
    if (method === "DELETE") { db.orders = db.orders.filter((x) => x.id !== o.id); return; }
    if (action === "status" || action === "start" || action === "delivered") {
      o.status = action === "start" ? statuses[3] : action === "delivered" ? statuses[4] : b.status;
      o.cancel_reason = b.reason ?? ""; o.events.push({ status: o.status, at: iso() });
      if (action === "delivered") { o.has_delivery_proof = !!opts.form?.get("file"); if (opts.form?.get("cash_collected") === "true") o.payment_status = "paid"; }
    } else if (action === "rider") { o.rider_id = b.rider_id; o.rider_name = db.users.find((u) => u.id === b.rider_id)?.name ?? ""; o.rider_accepted_at = null; }
    else if (action === "accept") o.rider_accepted_at = iso();
    else if (action === "payment" || action === "schedule") Object.assign(o, b);
    else if (action) fail(`Mock action not implemented: ${action}`, 501);
    return o;
  }
  if (p === "/admin/stats") {
    const r = report(), low = db.products.filter((p) => p.stock <= p.low_stock_at);
    const count = (s: string) => db.orders.filter((o) => o.status === s).length;
    return { revenue_today: r.series.at(-1)?.revenue ?? 0, revenue_yesterday: r.series.at(-2)?.revenue ?? 0, orders_today: r.series.at(-1)?.orders ?? 0, revenue_week_change: 12, orders_week_change: 8, orders_total: db.orders.length, orders_pending: db.orders.filter((o) => !statuses.slice(4).includes(o.status)).length, placed: count(statuses[0]), out_for_delivery: count(statuses[3]), low_stock: low.length, customers: db.users.filter((u) => u.role === "customer").length, unread_support: 1, spark: r.series, by_status: Object.fromEntries(statuses.map((s) => [s, count(s)])), top_products: r.products, low_stock_items: low.map((p) => ({ ...p, alert: p.low_stock_at })) };
  }
  if (p.startsWith("/admin/reports/")) {
    if (p.endsWith("export.xlsx")) fail("Excel export needs the real API. Use PDF or Print in mock mode.", 501);
    return report(p.split("/")[3]);
  }
  if (p === "/admin/customers") return db.users.filter((u) => u.role === "customer").map((u) => { const orders = db.orders.filter((o) => o.customer_id === u.id); return { ...u, orders: orders.length, spent: sum(orders, "total") }; });
  if (p === "/admin/team" && method === "GET") return db.users.filter((u) => u.role !== "customer");
  if (p === "/admin/activity") return db.activity.filter((a) => (!q.get("action") || a.action === q.get("action")) && (!q.get("q") || `${a.description} ${a.user_name}`.toLowerCase().includes(q.get("q")!.toLowerCase())) && (!q.get("since") || a.created_at >= q.get("since")!) && (!q.get("until") || a.created_at <= q.get("until")!));
  if (p === "/support/mine/unread") return { unread: 1 };
  if (p === "/support/threads") return db.users.filter((u) => u.role === "customer" && u.name.toLowerCase().includes((q.get("q") ?? "").toLowerCase())).map((u) => { const messages = db.messages.filter((m) => m.customer_id === u.id); return { id: u.id, customer_name: u.name, last_message: messages.at(-1)?.body ?? "", updated_at: messages.at(-1)?.created_at ?? iso(), unread: messages.filter((m) => m.sender === "customer").length }; });
  if (p === "/support/mine" || /^\/support\/threads\/\d+$/.test(p)) {
    const id = p === "/support/mine" ? user.id : Number(p.split("/").at(-1));
    if (method === "POST") { const msg = { id: nextId(db.messages), customer_id: id, sender: user.role === "customer" ? "customer" : "admin", body: b.body, created_at: iso() }; db.messages.push(msg); return msg; }
    return db.messages.filter((m) => m.customer_id === id);
  }
  if (p.startsWith("/support/messages/") && method === "DELETE") { db.messages = db.messages.filter((m) => m.id !== Number(p.split("/").at(-1))); return; }
  const collections: [string, Row[]][] = [["/products", db.products], ["/addresses", db.addresses], ["/rates/ice-block", db.iceRates], ["/rates/fixed", db.fixedRates], ["/admin/announcements", db.announcements], ["/admin/team", db.users], ["/admin/users", db.users]];
  for (const [base, rows] of collections) {
    if (p !== base && !p.startsWith(base + "/")) continue;
    const id = Number(p.slice(base.length + 1).split("/")[0]);
    if (method === "GET" && p === base) return base === "/addresses" ? rows.filter((r) => r.customer_id === user.id) : base === "/admin/announcements" ? rows.map((r) => ({ ...r, live: live(r) })) : rows;
    if (method === "POST" && p === base) { const row: Row = { id: nextId(rows), is_active: true, low_stock_at: 10, created_at: iso(), starts_at: iso(), customer_id: user.id, ...b }; delete row.password; rows.push(row); return row; }
    const index = rows.findIndex((r) => r.id === id);
    if (index < 0) fail("Demo record not found", 404);
    if (method === "DELETE") { rows.splice(index, 1); return; }
    if (method === "PUT" || method === "PATCH") { Object.assign(rows[index], b); return rows[index]; }
  }
  fail(`Mock route not implemented: ${method} ${p}`, 501);
}
