import { Broadcast as BroadcastIcon, PaperPlaneTilt, Trash } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useRef } from "react";
import { Button, Empty, Field, Skeleton } from "../../components/ui";
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
    <div className="stack">
      <div className="page-title"><h1>Broadcast</h1></div>
      <div className="grid two">
        <form className="card stack" ref={form} onSubmit={submit}>
          <h2>New promotion</h2>
          <Field label="Title">{(p) => <input {...p} className="input" name="title" required maxLength={120} />}</Field>
          <Field label="Message">{(p) => <textarea {...p} className="input" name="message" required />}</Field>
          <div className="row">
            <div className="grow"><Field label="Starts" help="Leave empty to start now.">{(p) => <input {...p} className="input" type="datetime-local" name="start" />}</Field></div>
            <div className="grow"><Field label="Ends" help="Leave empty for no end.">{(p) => <input {...p} className="input" type="datetime-local" name="end" />}</Field></div>
          </div>
          <Button className="primary" type="submit" loading={send.isPending}><PaperPlaneTilt size={20} aria-hidden="true" /> Send to all customers</Button>
        </form>
        <section className="card stack" aria-labelledby="sp">
          <h2 id="sp">Sent promotions</h2>
          {q.isLoading ? <Skeleton h={100} /> : !q.data?.length ? <Empty icon={<BroadcastIcon size={32} aria-hidden="true" />} title="Nothing sent yet" /> : q.data.map((a) => (
            <article key={a.id} className="stack" style={{ gap: 6, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <div className="row spread nowrap"><strong className="wrap-any">{a.title}</strong><span className={`badge ${a.live ? "ok" : ""}`}>{a.live ? "LIVE" : "ENDED / SCHEDULED"}</span></div>
              <p className="muted wrap-any">{a.message}</p>
              <div className="row spread"><small className="muted">{fmtDateTime(a.starts_at)} → {a.ends_at ? fmtDateTime(a.ends_at) : "no end"}</small>
                <button className="btn sm danger" onClick={() => del.mutate(a)} aria-label={`Delete ${a.title}`}><Trash size={16} aria-hidden="true" /></button></div>
            </article>))}
        </section>
      </div>
    </div>
  );
}
