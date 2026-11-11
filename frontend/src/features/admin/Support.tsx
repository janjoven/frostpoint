import { ChatCircleText, MagnifyingGlass } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Chat } from "../../components/Chat";
import { Empty, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDateTime } from "../../lib/format";

export default function Support() {
  const [term, setTerm] = useState("");
  const [sel, setSel] = useState<{ id: number; name: string } | null>(null);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["threads", term], queryFn: () => api<any[]>(`/support/threads?q=${encodeURIComponent(term)}`), refetchInterval: 10_000 });
  return (
    <div className="stack">
      <div className="page-title"><h1>Support</h1></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <section className="card stack" aria-label="Conversations">
          <label className="row nowrap" style={{ gap: 6 }}><MagnifyingGlass size={20} aria-hidden="true" /><span className="sr-only">Search conversations</span>
            <input className="input" type="search" placeholder="Search customers" value={term} onChange={(e) => setTerm(e.target.value)} /></label>
          {q.isLoading ? <Skeleton h={120} /> : !q.data?.length ? <Empty icon={<ChatCircleText size={32} aria-hidden="true" />} title="No conversations" /> : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }} className="stack">
              {q.data.map((t) => (
                <li key={t.id}>
                  <button className="btn" style={{ width: "100%", justifyContent: "space-between", textAlign: "left", background: sel?.id === t.id ? "var(--primary-soft)" : undefined }}
                    onClick={() => { setSel({ id: t.id, name: t.customer_name }); setTimeout(() => qc.invalidateQueries({ queryKey: ["stats"] }), 600); }}>
                    <span className="grow wrap-any"><strong>{t.customer_name}</strong><br /><small className="muted">{t.last_message.slice(0, 40)}</small></span>
                    <span className="stack" style={{ gap: 2, alignItems: "flex-end" }}><small className="muted">{fmtDateTime(t.updated_at)}</small>
                      {t.unread > 0 && <span className="badge bad" aria-label={`${t.unread} unread`}>{t.unread} new</span>}</span>
                  </button>
                </li>))}
            </ul>)}
        </section>
        <section className="card stack" aria-label="Conversation">
          {sel ? (<><h2>{sel.name}</h2><Chat key={sel.id} path={`/support/threads/${sel.id}`} me="admin" canDelete /></>) :
            <Empty icon={<ChatCircleText size={32} aria-hidden="true" />} title="Select a conversation" />}
        </section>
      </div>
    </div>
  );
}
