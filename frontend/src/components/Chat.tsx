import { PaperPlaneTilt, Trash } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { fmtDateTime } from "../lib/format";
import { useAct } from "../lib/hooks";
import { Button, ErrorState, Skeleton } from "./ui";

type Msg = { id: number; sender: "customer" | "admin"; body: string; created_at: string };

/** Shared chat panel. `me` is which sender renders on the right. */
export function Chat({ path, me, canDelete }: { path: string; me: "customer" | "admin"; canDelete?: boolean }) {
  const q = useQuery({ queryKey: ["chat", path], queryFn: () => api<Msg[]>(path), refetchInterval: 8000 });
  const send = useAct((body: string) => api(path, { body: { body } }), { invalidate: ["chat", "threads", "stats", "unread"] });
  const del = useAct((id: number) => api(`/support/messages/${id}`, { method: "DELETE" }), { invalidate: ["chat"] });
  const log = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => { if (log.current && follow.current) log.current.scrollTop = log.current.scrollHeight; }, [q.data?.length]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const v = String(new FormData(f).get("m")).trim();
    if (v) send.mutate(v, { onSuccess: () => { follow.current = true; f.reset(); } });
  }
  return (
    <div className="stack chat-panel" style={{ gap: 12 }}>
      <div ref={log} className="chat" role="log" aria-live="polite" aria-label="Messages" tabIndex={0} onScroll={(e) => { const el = e.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {q.isLoading && <Skeleton h={100} />}
        {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
        {q.data?.length === 0 && <p className="muted" style={{ textAlign: "center", padding: 24 }}>No messages yet. Say hello!</p>}
        {q.data?.map((m) => (
          <div key={m.id} className={`bubble ${m.sender === me ? "me" : ""}`} style={{ alignSelf: m.sender === me ? "flex-end" : "flex-start" }}>
            {m.body}
            <div className="row spread nowrap chat-message-meta">
              <span>{fmtDateTime(m.created_at)}</span>
              {canDelete && <button className="btn ghost sm" style={{ minHeight: 28, padding: "0 6px", color: "inherit" }} aria-label="Delete message" onClick={() => del.mutate(m.id)}><Trash size={14} aria-hidden="true" /></button>}
            </div>
          </div>
        ))}
      </div>
      <form className="row nowrap" onSubmit={submit}>
        <label className="grow"><span className="sr-only">Message</span><input name="m" className="input" placeholder="Type a message…" maxLength={2000} autoComplete="off" /></label>
        <Button className="primary" type="submit" loading={send.isPending} aria-label="Send message"><PaperPlaneTilt size={20} aria-hidden="true" /></Button>
      </form>
    </div>
  );
}
