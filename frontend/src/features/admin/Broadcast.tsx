import { Broadcast as BroadcastIcon, PaperPlaneTilt, Trash } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useRef } from "react";
import { Button, Empty, ErrorState, Field, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDateTime } from "../../lib/format";
import { useAct } from "../../lib/hooks";
import { ask } from "../../store";

export default function Broadcast() {
  const q = useQuery({ queryKey: ["announcements"], queryFn: () => api<any[]>("/admin/announcements") });
  const form = useRef<HTMLFormElement>(null);
  const send = useAct((b: object) => api("/admin/announcements", { body: b }), { invalidate: ["announcements"], success: "Promotion sent to all customers" });
  const del = useAct(async (a: { id: number; title: string }) => {
    const ok = await ask({ title: `Delete “${a.title}”?`, confirm: "Delete", danger: true });
    if (!ok) throw new Error("Cancelled");
    return api(`/admin/announcements/${a.id}`, { method: "DELETE" });
  }, { invalidate: ["announcements"], success: "Promotion deleted" });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const iso = (k: string) => (f.get(k) ? new Date(String(f.get(k))).toISOString() : null);
    send.mutate({ title: f.get("title"), message: f.get("message"), starts_at: iso("start"), ends_at: iso("end") }, { onSuccess: () => form.current?.reset() });
  }

  return (
    <div className="admin-detail-page">
      <div className="page-title"><h1>Broadcast</h1></div>
      <div className="admin-broadcast-layout">
        <form className="card stack admin-edit-form" ref={form} onSubmit={submit}>
          <h2>New promotion</h2>
          <Field label="Title">{(p) => <input {...p} className="input" name="title" required maxLength={120} />}</Field>
          <Field label="Message">{(p) => <textarea {...p} className="input" name="message" required />}</Field>
          <div className="admin-form-grid">
            <Field label="Starts" help="Leave empty to start now.">{(p) => <input {...p} className="input" type="datetime-local" name="start" />}</Field>
            <Field label="Ends" help="Leave empty for no end.">{(p) => <input {...p} className="input" type="datetime-local" name="end" />}</Field>
          </div>
          <div className="admin-form-actions"><Button className="primary" type="submit" loading={send.isPending}><PaperPlaneTilt size={18} aria-hidden="true" /> Send to all customers</Button></div>
        </form>
        <section className="card stack admin-promotions" aria-labelledby="sp">
          <h2 id="sp">Sent promotions</h2>
          {q.isLoading ? <Skeleton h={100} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <Empty icon={<BroadcastIcon size={32} aria-hidden="true" />} title="Nothing sent yet" /> : q.data.map((a) => (
            <article key={a.id} className="admin-promotion">
              <div className="row spread"><strong className="wrap-any">{a.title}</strong><span className={`badge ${a.live ? "ok" : ""}`}>{a.live ? "Live" : "Ended / scheduled"}</span></div>
              <p className="wrap-any">{a.message}</p>
              <div className="admin-promotion-footer"><div className="admin-promotion-dates"><span><small className="muted">Starts</small>{a.starts_at ? fmtDateTime(a.starts_at) : "Immediately"}</span><span><small className="muted">Ends</small>{a.ends_at ? fmtDateTime(a.ends_at) : "No end date"}</span></div>
                <button type="button" className="btn sm danger" disabled={del.isPending} onClick={() => del.mutate(a)} aria-label={`Delete ${a.title}`}><Trash size={16} aria-hidden="true" /></button></div>
            </article>))}
        </section>
      </div>
    </div>
  );
}
