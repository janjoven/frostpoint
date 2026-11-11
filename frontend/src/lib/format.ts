export const peso = (n: number | string) =>
  "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });

const TZ = "Asia/Manila";
export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" }) : "—";
export const fmtDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-PH", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

export const toLocalInput = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  const p = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return p.toISOString().slice(0, 16);
};

export const fmtDayTime = (iso?: string | null) =>
  iso
    ? {
        day: new Date(iso).toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric" }),
        time: new Date(iso).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" }),
      }
    : null;

// Mirrors TRANSITIONS in backend/app/services/core.py. After confirmation steps may be skipped (pickup orders).
export const STATUS_FLOW = ["Order Placed", "Order Confirmed", "Preparing", "Out for Delivery", "Delivered Successfully"] as const;
export const STEP_LABEL: Record<string, string> = {
  "Order Placed": "Placed", "Order Confirmed": "Confirmed", Preparing: "Preparing",
  "Out for Delivery": "On the way", "Delivered Successfully": "Delivered",
};
export const NEXT: Record<string, string[]> = {
  "Order Placed": ["Order Confirmed", "Cancelled"],
  "Order Confirmed": ["Preparing", "Out for Delivery", "Delivered Successfully", "Cancelled"],
  Preparing: ["Out for Delivery", "Delivered Successfully", "Cancelled"],
  "Out for Delivery": ["Delivered Successfully", "Cancelled"],
  "Delivered Successfully": [],
  Cancelled: [],
};
export const isOpen = (status: string) => status !== "Delivered Successfully" && status !== "Cancelled";

export const PAY_LABEL: Record<string, string> = {
  unpaid: "Awaiting payment", proof_sent: "Proof sent, checking", paid: "Paid", cod_due: "Pay on delivery",
};
export const PAY_TONE: Record<string, string> = { unpaid: "bad", proof_sent: "warn", paid: "ok", cod_due: "" };
/** Customer can still send proof: e-wallet/bank order, nothing sent yet, order not yet being prepared. */
export const canSendProof = (o: { payment_method: string; payment_status: string; status: string }) =>
  o.payment_method !== "COD" && o.payment_status === "unpaid" && ["Order Placed", "Order Confirmed"].includes(o.status);

/**
 * Payment methods offered at checkout. There is no gateway yet, so cash on delivery is always available and
 * wallets/bank transfer only appear once the owner has entered real details (not the 09XX placeholder).
 */
export function availablePayments(cfg?: Record<string, string>): string[] {
  const real = (v?: string) => !!v?.trim() && !/x/i.test(v);
  const out = ["COD"];
  if (real(cfg?.gcash_number)) out.push("GCash");
  if (real(cfg?.maya_number)) out.push("Maya");
  if (cfg?.bank_details?.trim()) out.push("Bank Transfer");
  return out;
}
export const PAY_NAME: Record<string, string> = { COD: "Cash on delivery" };

export const PH_MOBILE = /^(\+63|63|0)9\d{9}$/;
export const cleanPhone = (v: string) => v.replace(/[\s-]/g, "");
