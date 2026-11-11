import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Button, Field, Modal, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { peso } from "../../lib/format";
import { useAct } from "../../lib/hooks";
import { ask } from "../../store";

type Kind = "ice-block" | "fixed";
const CATS = ["Ice Tube", "Crushed Ice", "Purified Water"];

function RateForm({ kind, row, onClose }: { kind: Kind; row?: any; onClose: () => void }) {
  const save = useAct((b: object) => {
    const base = kind === "ice-block" ? "/rates/ice-block" : "/rates/fixed";
    return row ? api(`${base}/${row.id}`, { method: "PUT", body: b }) : api(base, { body: b });
  }, { invalidate: ["rates", "locations"], success: "Rate saved" });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string) => (f.get(k) ? String(f.get(k)) : null);
    const body = kind === "ice-block"
      ? { location: f.get("location"), per_piece_rate: num("per"), flat_fee: num("flat") }
      : { location: f.get("location"), category: f.get("category"), fee: num("fee") };
    save.mutate(body, { onSuccess: onClose });
  }
  return (
    <Modal title={`${row ? "Edit" : "Add"} ${kind === "ice-block" ? "Ice Block" : "fixed"} rate`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Location">{(p) => <input {...p} className="input" name="location" defaultValue={row?.location} readOnly={!!row} required data-autofocus />}</Field>
        {kind === "ice-block" ? (
          <>
            <Field label="Per-piece rate (₱)" help="If set, fee = rate × number of blocks.">{(p) => <input {...p} className="input num" name="per" type="number" step="0.01" min="0" defaultValue={row?.per_piece_rate ?? ""} inputMode="decimal" />}</Field>
            <Field label="Flat fee (₱)" help="Used when there is no per-piece rate.">{(p) => <input {...p} className="input num" name="flat" type="number" step="0.01" min="0" defaultValue={row?.flat_fee ?? ""} inputMode="decimal" />}</Field>
          </>
        ) : (
          <>
            <Field label="Category">{(p) => <select {...p} className="input" name="category" defaultValue={row?.category} disabled={!!row}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
            <Field label="Fee (₱)">{(p) => <input {...p} className="input num" name="fee" type="number" step="0.01" min="0" defaultValue={row?.fee} required inputMode="decimal" />}</Field>
          </>
        )}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <Button className="primary" type="submit" loading={save.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function RateTable({ kind }: { kind: Kind }) {
  const q = useQuery({ queryKey: ["rates", kind], queryFn: () => api<any[]>(`/rates/${kind}`) });
  const [edit, setEdit] = useState<any | "new" | null>(null);
  const del = useAct(async (r: any) => {
    const ok = await ask({ title: `Delete rate for ${r.location}?`, confirm: "Delete", danger: true });
    if (!ok) throw new Error("Cancelled");
    return api(`/rates/${kind}/${r.id}`, { method: "DELETE" });
  }, { invalidate: ["rates", "locations"], success: "Rate deleted" });
  return (
    <section className="card flush" aria-labelledby={`h-${kind}`}>
      <div className="row spread" style={{ padding: 16 }}>
        <h2 id={`h-${kind}`}>{kind === "ice-block" ? "Ice Block delivery rates" : "Fixed delivery rates"}</h2>
        <button className="btn sm" onClick={() => setEdit("new")}><Plus size={16} aria-hidden="true" /> Add</button>
      </div>
      {q.isLoading ? <div style={{ padding: 16 }}><Skeleton h={100} /></div> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Location</th>{kind === "fixed" && <th>Category</th>}{kind === "ice-block" ? <><th className="r">Per piece</th><th className="r">Flat</th></> : <th className="r">Fee</th>}<th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{q.data!.map((r) => (
            <tr key={r.id}><td>{r.location}</td>{kind === "fixed" && <td>{r.category}</td>}
              {kind === "ice-block" ? <><td className="r num">{r.per_piece_rate ? peso(r.per_piece_rate) : "—"}</td><td className="r num">{r.flat_fee ? peso(r.flat_fee) : "—"}</td></> : <td className="r num">{peso(r.fee)}</td>}
              <td><div className="row nowrap"><button className="btn sm" aria-label={`Edit ${r.location}`} onClick={() => setEdit(r)}><PencilSimple size={16} aria-hidden="true" /></button>
                <button className="btn sm danger" aria-label={`Delete ${r.location}`} onClick={() => del.mutate(r)}><Trash size={16} aria-hidden="true" /></button></div></td></tr>))}</tbody></table></div>
      )}
      {edit && <RateForm kind={kind} row={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

export default function SettingsPage() {
  const q = useQuery({ queryKey: ["settings"], queryFn: () => api<Record<string, string>>("/settings") });
  const save = useAct((b: object) => api("/settings", { method: "PUT", body: b }), { invalidate: ["settings"], success: "Settings saved" });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save.mutate(Object.fromEntries(new FormData(e.currentTarget)));
  }
  const s = q.data;
  return (
    <div className="stack">
      <div className="page-title"><h1>Settings</h1></div>
      {!s ? <Skeleton h={240} /> : (
        <form className="card stack" onSubmit={submit} key={JSON.stringify(s)}>
          <h2>Delivery &amp; payment</h2>
          <div className="row">
            <div className="grow"><Field label="Default delivery fee (₱)" help="Used when a location has no rate.">{(p) => <input {...p} className="input num" name="default_delivery_fee" type="number" min="0" defaultValue={s.default_delivery_fee} inputMode="decimal" />}</Field></div>
            <div className="grow"><Field label="Free delivery threshold (₱)" help="0 turns this off.">{(p) => <input {...p} className="input num" name="free_delivery_threshold" type="number" min="0" defaultValue={s.free_delivery_threshold} inputMode="decimal" />}</Field></div>
          </div>
          <div className="row">
            <div className="grow"><Field label="GCash number">{(p) => <input {...p} className="input num" name="gcash_number" defaultValue={s.gcash_number} />}</Field></div>
            <div className="grow"><Field label="GCash account name">{(p) => <input {...p} className="input" name="gcash_name" defaultValue={s.gcash_name} />}</Field></div>
          </div>
          <div className="row">
            <div className="grow"><Field label="Maya number">{(p) => <input {...p} className="input num" name="maya_number" defaultValue={s.maya_number} />}</Field></div>
            <div className="grow"><Field label="Maya account name">{(p) => <input {...p} className="input" name="maya_name" defaultValue={s.maya_name} />}</Field></div>
          </div>
          <Field label="Bank transfer details">{(p) => <textarea {...p} className="input" name="bank_details" defaultValue={s.bank_details} />}</Field>
          <div><Button className="primary" type="submit" loading={save.isPending}>Save settings</Button></div>
        </form>
      )}
      <RateTable kind="ice-block" />
      <RateTable kind="fixed" />
    </div>
  );
}
