import { PaperPlaneTilt, Trash } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { fmtDateTime } from "../lib/format";
import { useAct } from "../lib/hooks";
import { Button } from "./ui";

type Msg = { id: number; sender: "customer" | "admin"; body: string; created_at: string };

/** Shared chat panel. `me` is which sender renders on the right. */
export function Chat({ path, me, canDelete }: { path: string; me: "customer" | "admin"; canDelete?: boolean }) {
  const q = useQuery({ queryKey: ["chat", path], queryFn: () => api<Msg[]>(path), refetchInterval: 8000 });
  const send = useAct((body: string) => api(path, { body: { body } }), { invalidate: ["chat", "threads", "stats", "unread"] });
  const del = useAct((id: number) => api(`/support/messages/${id}`, { method: "DELETE" }), { invalidate: ["chat"] });
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [q.data?.length]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const v = String(new FormData(f).get("m")).trim();
    if (v) send.mutate(v, { onSuccess: () => f.reset() });
  }
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="chat" role="log" aria-live="polite" aria-label="Messages" tabIndex={0}>
        {q.data?.length === 0 && <p className="muted" style={{ textAlign: "center", padding: 24 }}>No messages yet. Say hello!</p>}
        {q.data?.map((m) => (
          <div key={m.id} className={`bubble ${m.sender === me ? "me" : ""}`} style={{ alignSelf: m.sender === me ? "flex-end" : "flex-start" }}>
            {m.body}
            <div style={{ fontSize: 11, opacity: 0.75 }} className="row spread nowrap">
              <span>{fmtDateTime(m.created_at)}</span>
              {canDelete && <button className="btn ghost sm" style={{ minHeight: 28, padding: "0 6px", color: "inherit" }} aria-label="Delete message" onClick={() => del.mutate(m.id)}><Trash size={14} aria-hidden="true" /></button>}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="row nowrap" onSubmit={submit}>
        <label className="grow"><span className="sr-only">Message</span><input name="m" className="input" placeholder="Type a message…" maxLength={2000} autoComplete="off" /></label>
        <Button className="primary" type="submit" loading={send.isPending} aria-label="Send message"><PaperPlaneTilt size={20} aria-hidden="true" /></Button>
      </form>
    </div>
  );
}
