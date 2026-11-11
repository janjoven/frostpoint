import { ChatCircleText, MagnifyingGlass } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Chat } from "../../components/Chat";
import { Empty, ErrorState, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDateTime } from "../../lib/format";

export default function Support() {
  const [term, setTerm] = useState("");
  const [sel, setSel] = useState<{ id: number; name: string } | null>(null);
  const qc = useQueryClient();
  const conversation = useRef<HTMLElement>(null);
  const q = useQuery({ queryKey: ["threads", term], queryFn: () => api<any[]>(`/support/threads?q=${encodeURIComponent(term)}`), refetchInterval: 10_000 });
  return (
    <div className="admin-detail-page support-page">
      <div className="page-title"><h1>Support</h1></div>
      <div className="support-layout">
        <section className="card support-inbox" aria-label="Conversations">
          <label className="catalog-search"><MagnifyingGlass size={20} aria-hidden="true" /><span className="sr-only">Search conversations</span>
            <input className="input" type="search" placeholder="Search customers" value={term} onChange={(e) => setTerm(e.target.value)} /></label>
          {q.isLoading ? <Skeleton h={120} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <Empty icon={<ChatCircleText size={32} aria-hidden="true" />} title="No conversations" /> : (
            <ul className="support-thread-list">
              {q.data.map((t) => (
                <li key={t.id}>
                  <button type="button" className="support-thread" aria-pressed={sel?.id === t.id}
                    onClick={() => { setSel({ id: t.id, name: t.customer_name }); setTimeout(() => qc.invalidateQueries({ queryKey: ["stats"] }), 600); if (window.innerWidth < 800) requestAnimationFrame(() => conversation.current?.scrollIntoView({ block: "start" })); }}>
                    <span className="support-thread-top"><strong>{t.customer_name}</strong>{t.unread > 0 && <span className="badge" aria-label={`${t.unread} unread`}>{t.unread} new</span>}</span>
                    <span className="support-thread-preview muted">{t.last_message}</span>
                    <time className="muted" dateTime={t.updated_at}>{fmtDateTime(t.updated_at)}</time>
                  </button>
                </li>))}
            </ul>)}
        </section>
        <section ref={conversation} className="card support-chat-panel" aria-label="Conversation">
          {sel ? (<><h2 className="support-chat-heading">{sel.name}</h2><Chat key={sel.id} path={`/support/threads/${sel.id}`} me="admin" canDelete /></>) :
            <Empty icon={<ChatCircleText size={32} aria-hidden="true" />} title="Select a conversation" />}
        </section>
      </div>
    </div>
  );
}
