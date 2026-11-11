import { ArrowClockwise, CaretLeft, CaretRight, MagnifyingGlass, Receipt, Storefront, Truck } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Empty, ErrorState, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { ADMIN_ORDER_FILTERS, filterAdminOrders, type OrderFilter, type OrderSort } from "../../lib/adminOrderList";
import { fmtDateTime, PAY_LABEL, PAY_TONE, peso } from "../../lib/format";
import { Order, OrderDetail, StatusSelect } from "./OrderParts";

const PAGE_SIZE = 10;
function OrderItems({ order }: { order: Order }) {
  return <ul className="admin-order-items">{order.items.map((item, i) => <li key={i}><span className="num">{item.qty}×</span><span>{item.name}</span></li>)}</ul>;
}
function Fulfilment({ order }: { order: Order }) {
  return <div className="admin-order-fulfilment"><span>{order.mode === "pickup" ? <Storefront size={15} aria-hidden="true" /> : <Truck size={15} aria-hidden="true" />}{order.mode === "pickup" ? "Pickup" : "Delivery"}</span>{order.mode === "delivery" && <small className="muted">{order.rider_name || "Rider not assigned"}</small>}</div>;
}
function Payment({ order }: { order: Order }) {
  return <div className="admin-order-payment"><span>{order.payment_method}</span>{order.status === "Cancelled" ? <small className="muted">Order cancelled</small> : <span className={`badge ${PAY_TONE[order.payment_status] ?? ""}`}>{PAY_LABEL[order.payment_status] ?? order.payment_status}</span>}</div>;
}

export default function Orders() {
  const q = useQuery({ queryKey: ["orders", "all"], queryFn: () => api<Order[]>("/orders") });
  const [filter, setFilter] = useState<OrderFilter>("All");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<OrderSort>("newest");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Order | null>(null);
  const orders = q.data ?? [];
  const rows = filterAdminOrders(orders, filter, term, sort);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages), start = (currentPage - 1) * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);
  const clear = () => { setFilter("All"); setTerm(""); setPage(1); };
  const view = (order: Order) => <button type="button" className="btn sm admin-order-view" onClick={() => setOpen(order)} aria-label={`View order ${order.id}`}>View <CaretRight size={14} aria-hidden="true" /></button>;
  const number = (order: Order) => <button type="button" className="admin-order-number num" onClick={() => setOpen(order)} aria-label={`View order ${order.id}`}>#{order.id}</button>;

  return (
    <div className="admin-orders-page">
      <header className="admin-orders-heading">
        <div><h1>Orders</h1><p className="muted">Review purchases, manage deliveries, and update progress.</p></div>
        <button type="button" className="btn admin-orders-refresh" onClick={() => void q.refetch()} disabled={q.isFetching} aria-busy={q.isFetching}><ArrowClockwise size={17} aria-hidden="true" /> Refresh</button>
      </header>
      <section className="card flush admin-orders-surface" aria-label="Manage orders">
        <div className="admin-orders-toolbar">
          <div className="admin-orders-filters" role="group" aria-label="Filter orders">
            {ADMIN_ORDER_FILTERS.map((value) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }}>{value}</button>)}
          </div>
          <label className="catalog-search admin-orders-search"><MagnifyingGlass size={19} aria-hidden="true" /><span className="sr-only">Search order number, customer name or phone</span><input className="input" placeholder="Search order #, customer or phone" value={term} onChange={(e) => { setTerm(e.target.value); setPage(1); }} type="search" /></label>
        </div>
        <div className="admin-orders-results">
          <span className="muted" role="status">{q.isLoading ? "Loading orders…" : q.isError ? "Unable to load orders" : rows.length ? <><strong>{rows.length}</strong> {filter === "All" ? "order" : filter.toLowerCase() + " order"}{rows.length === 1 ? "" : "s"}{term.trim() ? ` matching “${term.trim()}”` : ""}</> : "No matching orders"}</span>
          <label className="admin-orders-sort"><span className="sr-only">Sort orders</span><select className="input" value={sort} onChange={(e) => { setSort(e.target.value as OrderSort); setPage(1); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
        </div>
        {q.isLoading ? <div className="admin-orders-loading"><Skeleton h={200} /></div> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !rows.length ? (
          <Empty icon={<Receipt size={32} aria-hidden="true" />} title={orders.length ? "No orders match your search" : "No orders yet"} hint={orders.length ? "Try an order number, customer name, or a different filter." : "New customer orders will appear here."} action={(term || filter !== "All") ? <button type="button" className="btn" onClick={clear}>Clear filters</button> : undefined} />
        ) : <>
          <div className="table-wrap admin-orders-table"><table>
            <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Items</th><th scope="col">Fulfilment</th><th scope="col">Payment</th><th scope="col" className="r">Total</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
            <tbody>{visible.map((order) => <tr key={order.id}>
              <td>{number(order)}<small className="muted admin-order-date">{fmtDateTime(order.created_at)}</small></td>
              <td><strong className="admin-order-customer">{order.receiver_name}</strong><small className="muted admin-order-phone">{order.phone}</small></td>
              <td><OrderItems order={order} /></td><td><Fulfilment order={order} /></td><td><Payment order={order} /></td>
              <td className="r num admin-order-total">{peso(order.total)}</td><td className="admin-order-status"><StatusSelect o={order} /></td><td>{view(order)}</td>
            </tr>)}</tbody>
          </table></div>
          <div className="admin-orders-cards">{visible.map((order) => <article className="admin-order-mobile" key={order.id} aria-label={`Order ${order.id}`}>
            <div className="row spread">{number(order)}<strong className="num">{peso(order.total)}</strong></div>
            <small className="muted">{fmtDateTime(order.created_at)}</small>
            <div><strong className="admin-order-customer">{order.receiver_name}</strong><small className="muted admin-order-phone">{order.phone}</small></div>
            <OrderItems order={order} />
            <div className="admin-order-mobile-meta"><Fulfilment order={order} /><Payment order={order} /></div>
            <div className="admin-order-mobile-actions"><StatusSelect o={order} />{view(order)}</div>
          </article>)}</div>
          <footer className="admin-orders-pagination"><span className="muted">Showing <strong>{start + 1}–{Math.min(start + PAGE_SIZE, rows.length)}</strong> of {rows.length}</span><div><button type="button" className="btn icon" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><CaretLeft size={18} aria-hidden="true" /></button><span className="num">{currentPage} / {pages}</span><button type="button" className="btn icon" aria-label="Next page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><CaretRight size={18} aria-hidden="true" /></button></div></footer>
        </>}
      </section>
      {open && <OrderDetail o={orders.find((order) => order.id === open.id) ?? open} onClose={() => setOpen(null)} />}
    </div>
  );
}
