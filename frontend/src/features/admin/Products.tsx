import { Package, PencilSimple, Plus, Trash, Warehouse } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { ProductArt } from "../../components/ProductArt";
import { Button, Empty, ErrorState, Field, Modal, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { peso } from "../../lib/format";
import { useAct } from "../../lib/hooks";
import { Product, ask } from "../../store";

const CATS = ["Ice Tube", "Crushed Ice", "Ice Block", "Purified Water"];
const blank = { name: "", category: CATS[0], price: "10", uom: "kg", stock: 0, description: "", image_url: "", badge: "", min_order_qty: 1, low_stock_at: 20, is_active: true };

function ProductForm({ p, onClose }: { p?: Product; onClose: () => void }) {
  const save = useAct((b: object) => (p ? api(`/products/${p.id}`, { method: "PUT", body: b }) : api("/products", { body: b })), { invalidate: ["products"], success: p ? "Product saved" : "Product added" });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      name: f.get("name"), category: f.get("category"), price: String(f.get("price")), uom: f.get("uom"), stock: Number(f.get("stock")),
      description: f.get("description"), badge: f.get("badge"), min_order_qty: Number(f.get("min")), low_stock_at: Number(f.get("low")),
      image_url: "", is_active: f.get("active") === "on",
    }, { onSuccess: onClose });
  }
  const d = p ?? blank;
  return (
    <Modal title={p ? "Edit product" : "Add product"} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Name">{(x) => <input {...x} className="input" name="name" defaultValue={d.name} required data-autofocus />}</Field>
        <div className="row">
          <div className="grow"><Field label="Category">{(x) => <select {...x} className="input" name="category" defaultValue={d.category}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>}</Field></div>
          <div className="grow"><Field label="Unit">{(x) => <input {...x} className="input" name="uom" defaultValue={d.uom} required />}</Field></div>
        </div>
        <div className="row">
          <div className="grow"><Field label="Price (₱)">{(x) => <input {...x} className="input num" name="price" type="number" min="0" step="0.01" defaultValue={d.price} required inputMode="decimal" />}</Field></div>
          <div className="grow"><Field label="Stock">{(x) => <input {...x} className="input num" name="stock" type="number" min="0" defaultValue={d.stock} required inputMode="numeric" />}</Field></div>
        </div>
        <div className="row">
          <div className="grow"><Field label="Min order qty">{(x) => <input {...x} className="input num" name="min" type="number" min="1" defaultValue={d.min_order_qty} inputMode="numeric" />}</Field></div>
          <div className="grow"><Field label="Low-stock alert at">{(x) => <input {...x} className="input num" name="low" type="number" min="0" defaultValue={d.low_stock_at} inputMode="numeric" />}</Field></div>
        </div>
        <Field label="Badge (optional)">{(x) => <input {...x} className="input" name="badge" defaultValue={d.badge} maxLength={40} />}</Field>
        <Field label="Description">{(x) => <textarea {...x} className="input" name="description" defaultValue={d.description} />}</Field>
        <label className="row"><input type="checkbox" name="active" defaultChecked={d.is_active} style={{ width: 22, height: 22 }} /> Visible in the store</label>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <Button className="primary" type="submit" loading={save.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const q = useQuery({ queryKey: ["products", "all"], queryFn: () => api<Product[]>("/products?all=true") });
  const [edit, setEdit] = useState<Product | "new" | null>(null);
  const [lowOnly, setLowOnly] = useState(false);
  const [inv, setInv] = useState(false);

  const stock = useAct(async (p: Product) => {
    const v = await ask({ title: `Stock · ${p.name}`, confirm: "Save", input: { label: `New stock (${p.uom})`, required: true, initial: String(p.stock) } });
    if (v === null || v === false) throw new Error("Cancelled");
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) throw new Error("Enter a whole number, 0 or more.");
    return api(`/products/${p.id}/stock`, { method: "PATCH", body: { stock: n } });
  }, { invalidate: ["products", "stats"], success: "Stock updated" });

  const del = useAct(async (p: Product) => {
    const ok = await ask({ title: `Delete ${p.name}?`, body: "Past orders keep their line items.", confirm: "Delete", danger: true });
    if (!ok) throw new Error("Cancelled");
    return api(`/products/${p.id}`, { method: "DELETE" });
  }, { invalidate: ["products", "stats"], success: "Product deleted" });

  const list = (q.data ?? []).filter((p) => !lowOnly || p.stock <= p.low_stock_at);

  return (
    <div className="stack">
      <div className="page-title">
        <h1>Products</h1>
        <div className="row">
          <button className="btn" onClick={() => setInv(true)}><Warehouse size={20} aria-hidden="true" /> Inventory</button>
          <button className="btn primary" onClick={() => setEdit("new")}><Plus size={20} aria-hidden="true" /> Add product</button>
        </div>
      </div>
      {q.isLoading ? <div className="grid cards"><Skeleton h={260} /><Skeleton h={260} /></div> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !list.length ? (
        <Empty icon={<Package size={32} aria-hidden="true" />} title="No products" action={<button className="btn primary" onClick={() => setEdit("new")}>Add product</button>} />
      ) : (
        <div className="grid cards">
          {list.map((p) => (
            <article className="card stack" key={p.id} style={{ gap: 12, opacity: p.is_active ? 1 : 0.7 }}>
              <ProductArt category={p.category} badge={p.badge} />
              <div className="row spread nowrap">
                <h3>{p.name}</h3><span className="num">{peso(p.price)}/{p.uom}</span>
              </div>
              <div className="row spread">
                <span className={`badge ${p.stock <= p.low_stock_at ? "warn" : "ok"}`}>{p.stock <= p.low_stock_at ? "Low stock" : "In stock"} · <span className="num">{p.stock}</span></span>
                {!p.is_active && <span className="badge">Hidden</span>}
              </div>
              <div className="row">
                <button className="btn sm" onClick={() => stock.mutate(p)}>Stock</button>
                <button className="btn sm" onClick={() => setEdit(p)}><PencilSimple size={16} aria-hidden="true" /> Edit</button>
                <button className="btn sm danger" onClick={() => del.mutate(p)} aria-label={`Delete ${p.name}`}><Trash size={16} aria-hidden="true" /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      {edit && <ProductForm p={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
      {inv && (
        <Modal title="Inventory" onClose={() => setInv(false)}>
          <div className="pill-filters" role="group" aria-label="Inventory filter" style={{ marginBottom: 12 }}>
            <button className="pill" aria-pressed={!lowOnly} onClick={() => setLowOnly(false)}>All</button>
            <button className="pill" aria-pressed={lowOnly} onClick={() => setLowOnly(true)}>Low stock</button>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Product</th><th className="r">Stock</th><th className="r">Alert at</th></tr></thead>
            <tbody>{list.map((p) => <tr key={p.id}><td>{p.name}</td><td className="r num">{p.stock}</td><td className="r num">{p.low_stock_at}</td></tr>)}</tbody></table></div>
          {!list.length && <Empty icon={<Warehouse size={28} aria-hidden="true" />} title="Nothing is low on stock" />}
        </Modal>
      )}
    </div>
  );
}
