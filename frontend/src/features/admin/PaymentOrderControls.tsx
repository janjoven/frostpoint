import { ClipboardText, Plus, Trash } from "@phosphor-icons/react";
import { ReactNode, useState } from "react";
import { PaymentRow } from "../../lib/directPaymentDraft";

export type PaymentColumn = { key: string; label: string; type?: "number" | "date" | "checkbox"; required?: boolean };

export function PaymentTable({ label, columns, rows, onChange, renderCell, calculateAmount }: {
  label: string; columns: PaymentColumn[]; rows: PaymentRow[]; onChange: (rows: PaymentRow[]) => void;
  renderCell?: (column: PaymentColumn, row: PaymentRow, index: number, change: (value: string) => void) => ReactNode;
  calculateAmount?: (quantity: string, rate: string) => string | null;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const update = (id: string, key: string, value: string) => onChange(rows.map((row) => {
    if (row.id !== id) return row;
    const values = { ...row.values, [key]: value };
    if ((key === "qty" || key === "unitCost") && values.qty && values.unitCost) {
      const amount = calculateAmount ? calculateAmount(values.qty, values.unitCost) : (Math.round(Number(values.qty) * Number(values.unitCost) * 100) / 100).toFixed(2);
      if (amount !== null) values.amount = amount;
    }
    return { ...row, values };
  }));
  return <><p className="requisition-label">{label}</p><div className="table-wrap dpo-table"><table aria-label={label} style={{ minWidth: columns.length > 4 ? 1000 : 620 }}>
    <thead><tr><th className="dpo-check"><input type="checkbox" aria-label={`Select all ${label} rows`} disabled={!rows.length} checked={rows.length > 0 && rows.every((r) => selected.includes(r.id))} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} /></th><th>No.</th>{columns.map((c) => <th key={c.key}>{c.label}{c.required ? " *" : ""}</th>)}<th>Actions</th></tr></thead>
    <tbody>{!rows.length ? <tr><td colSpan={columns.length + 3}><div className="requisition-empty"><ClipboardText size={35} weight="thin" /><span>No Data</span></div></td></tr> : rows.map((row, i) => <tr key={row.id}>
      <td><input type="checkbox" aria-label={`Select ${label} row ${i + 1}`} checked={selected.includes(row.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></td><td>{i + 1}</td>
      {columns.map((c) => <td key={c.key}>{renderCell?.(c, row, i, (value) => update(row.id, c.key, value)) ?? (c.type === "checkbox" ? <input type="checkbox" aria-label={`${label} ${c.label} ${i + 1}`} checked={row.values[c.key] === "1"} onChange={(e) => update(row.id, c.key, e.target.checked ? "1" : "")} /> : <input className="input" aria-label={`${label} ${c.label} ${i + 1}`} type={c.type ?? "text"} min={c.type === "number" ? 0 : undefined} step={c.type === "number" ? "any" : undefined} required={c.required} value={row.values[c.key] ?? ""} onChange={(e) => update(row.id, c.key, e.target.value)} />)}</td>)}
      <td><button type="button" className="btn ghost icon" aria-label={`Remove ${label} row ${i + 1}`} onClick={() => { onChange(rows.filter((r) => r.id !== row.id)); setSelected(selected.filter((id) => id !== row.id)); }}><Trash size={17} /></button></td>
    </tr>)}</tbody>
  </table></div><div className="row requisition-row-actions"><button type="button" className="btn sm" onClick={() => onChange([...rows, { id: crypto.randomUUID(), values: Object.fromEntries(columns.map((c) => [c.key, ""])) }])}><Plus size={16} />Add Row</button>{selected.length > 0 && <button type="button" className="btn sm" onClick={() => { onChange(rows.filter((r) => !selected.includes(r.id))); setSelected([]); }}><Trash size={16} />Remove selected ({selected.length})</button>}</div></>;
}

export function FormSection({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="dpo-section" aria-label={title}>{title && <h2>{title}</h2>}{children}</section>;
}
