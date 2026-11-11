import { FileImage } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

/** Payment proof or delivery photo for an order. Files are only served to the customer and staff, so fetch with auth. */
export function ProofImage({ id, kind = "proof" }: { id: number; kind?: "proof" | "delivery-proof" }) {
  const [url, setUrl] = useState("");
  const q = useQuery({ queryKey: ["proof", kind, id], queryFn: () => api<Blob>(`/orders/${id}/${kind}`), staleTime: Infinity });
  useEffect(() => {
    if (!q.data) return;
    const u = URL.createObjectURL(q.data);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [q.data]);
  if (q.isLoading) return <p className="muted">Loading photo…</p>;
  if (!q.data) return <p className="muted">Not available.</p>;
  return q.data.type === "application/pdf"
    ? <a className="btn" href={url} target="_blank" rel="noreferrer"><FileImage size={18} aria-hidden="true" /> Open PDF</a>
    : <img src={url} alt={kind === "proof" ? `Proof of payment for order ${id}` : `Delivery photo for order ${id}`} style={{ maxWidth: "100%", borderRadius: 12 }} />;
}
