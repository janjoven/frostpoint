import { Trash } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import type { LngLat } from "../../components/Map";
import { PinPicker } from "../../components/PinPicker";
import { Stepper } from "../../components/Stepper";
import { Button, Field, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { PAY_NAME, PH_MOBILE, availablePayments, cleanPhone, peso, toLocalInput } from "../../lib/format";
import { ask, toast, useAuth, useCart } from "../../store";
import { useCartLines } from "./Cart";

type Address = { id: number; label: string; location: string; address: string; lat: number | null; lng: number | null; is_default: boolean };
type When = "asap" | "tomorrow" | "custom";

function tomorrow8() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}

export default function Checkout() {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const { items, loading, subtotal } = useCartLines();
  const { clear, set } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const locs = useQuery({ queryKey: ["locations"], queryFn: () => api<string[]>("/locations") });
  const cfg = useQuery({ queryKey: ["settings"], queryFn: () => api<Record<string, string>>("/settings"), enabled: !!user });
  const addrs = useQuery({ queryKey: ["addresses"], queryFn: () => api<Address[]>("/addresses"), enabled: !!user });

  const saved = (() => { try { return JSON.parse(localStorage.getItem("fp-receiver") ?? "{}"); } catch { return {}; } })();
  const [mode, setMode] = useState<"delivery" | "pickup">("delivery");
  const [addrId, setAddrId] = useState<number | "new">("new");
  const [location, setLocation] = useState("MASBATE CITY");
  const [address, setAddress] = useState<string>(saved.address ?? user?.address ?? "");
  const [pin, setPin] = useState<LngLat | null>(null);
  const [saveIt, setSaveIt] = useState(true);
  const [label, setLabel] = useState("Home");
  const [when, setWhen] = useState<When>("asap");
  const [custom, setCustom] = useState("");
  const [pay, setPay] = useState("COD");
  const [quote, setQuote] = useState<any>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<File | null>(null);

  // Start on the default saved address once the list arrives (only once, so later edits are not overwritten).
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current || !addrs.data) return;
    picked.current = true;
    const d = addrs.data.find((a) => a.is_default) ?? addrs.data[0];
    if (d) { setAddrId(d.id); setLocation(d.location); setAddress(d.address); setPin(d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null); }
  }, [addrs.data]);

  const lines = items.map((i) => ({ product_id: i.p.id, qty: i.qty }));
  const key = JSON.stringify([lines, mode, location]);
  useEffect(() => {
    if (!lines.length) return;
    const t = setTimeout(() => api("/quote", { body: { items: lines, mode, location } }).then(setQuote).catch((e) => { setQuote(null); toast(e.message); }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!ready) return <Skeleton h={300} />;
  if (!user) return <Navigate to="/login" state={{ from: "/checkout" }} replace />;
  if (loading) return <Skeleton h={300} />;
  if (!items.length) return <div className="empty"><strong>Your cart is empty</strong><Link className="btn primary" to="/">Browse products</Link></div>;

  const methods = availablePayments(cfg.data);
  const wallet = pay === "GCash" ? ["gcash_number", "gcash_name"] : pay === "Maya" ? ["maya_number", "maya_name"] : null;
  const free = Number(cfg.data?.free_delivery_threshold ?? 0);
  const chosen = typeof addrId === "number" ? addrs.data?.find((a) => a.id === addrId) : undefined;

  const pickAddress = (a: Address | "new") => {
    if (a === "new") { setAddrId("new"); setAddress(""); setPin(null); return; }
    setAddrId(a.id); setLocation(a.location); setAddress(a.address); setPin(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null);
  };
  async function removeAddress(a: Address) {
    if (!(await ask({ title: `Remove "${a.label}"?`, body: "You can add it again at any time.", confirm: "Remove", danger: true }))) return;
    await api(`/addresses/${a.id}`, { method: "DELETE" }).catch((x) => toast(x.message));
    await qc.invalidateQueries({ queryKey: ["addresses"] });
    setAddrId("new"); setAddress(""); setPin(null);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const errors: Record<string, string> = {};
    if (f.receiver_name.trim().length < 2) errors.receiver_name = "Enter the receiver's name.";
    if (!PH_MOBILE.test(cleanPhone(f.phone))) errors.phone = "Enter a PH mobile number like 0917 123 4567.";
    if (mode === "delivery" && !address.trim()) errors.address = "Enter the delivery address.";
    if (mode === "delivery" && !location) errors.location = "Choose your location.";
    if (when === "custom" && (!custom || new Date(custom) < new Date(Date.now() - 60_000))) errors.schedule = "Pick a time that hasn't passed.";
    if (proof && proof.size > 5 * 1024 * 1024) errors.proof = "File is larger than 5 MB.";
    setErrs(errors);
    if (Object.keys(errors).length) return;
    const schedule = when === "tomorrow" ? tomorrow8() : when === "custom" ? new Date(custom) : null;
    setBusy(true);
    try {
      try { localStorage.setItem("fp-receiver", JSON.stringify({ receiver_name: f.receiver_name, phone: f.phone, address })); } catch { /* ignore */ }
      if (mode === "delivery" && addrId === "new" && saveIt) {
        await api("/addresses", { body: { label: label.trim() || "Home", location, address: address.trim(), lat: pin?.lat ?? null, lng: pin?.lng ?? null, is_default: !addrs.data?.length } })
          .then(() => qc.invalidateQueries({ queryKey: ["addresses"] }))
          .catch((x) => toast(`Address not saved: ${x.message}`));
      }
      const o = await api("/orders", { body: {
        items: lines, mode, location, receiver_name: f.receiver_name, phone: cleanPhone(f.phone), address,
        dest_lat: mode === "delivery" ? pin?.lat ?? null : null, dest_lng: mode === "delivery" ? pin?.lng ?? null : null,
        schedule_at: schedule ? schedule.toISOString() : null, payment_method: pay, payment_ref: f.payment_ref ?? "", notes: f.notes,
      } });
      if (proof) {
        const form = new FormData(); form.append("file", proof);
        await api(`/orders/${o.id}/proof`, { form }).catch((x) => toast(`Order placed, but proof upload failed: ${x.message}. You can retry from Orders.`));
      }
      clear();
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast(`Order #${o.id} placed!`);
      nav("/orders", { replace: true });
    } catch (x) {
      toast((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 72 }} onSubmit={submit} noValidate>
      <h1>Checkout</h1>

      <section className="card stack" aria-labelledby="it">
        <h2 id="it">Your order</h2>
        {items.map(({ p, qty }) => (
          <div className="row spread nowrap" key={p.id}>
            <div className="grow"><strong>{p.name}</strong><div className="muted num">{peso(p.price)}/{p.uom} · {peso(Number(p.price) * qty)}</div></div>
            <Stepper value={qty} min={p.min_order_qty} max={p.stock} label={p.name} onChange={(v) => set(p.id, v)} />
            <button type="button" className="btn ghost icon" aria-label={`Remove ${p.name}`} onClick={() => set(p.id, 0)}><Trash size={18} aria-hidden="true" /></button>
          </div>))}
        {free > 0 && mode === "delivery" && (
          <div className="stack" style={{ gap: 6 }}>
            <small>{subtotal >= free ? "You've unlocked free delivery!" : `Add ${peso(free - subtotal)} more for free delivery`}</small>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={free} aria-valuenow={Math.min(subtotal, free)} aria-label="Progress to free delivery"><i style={{ width: `${Math.min(100, (subtotal / free) * 100)}%` }} /></div>
          </div>
        )}
        <Link to="/" className="help">Add more items</Link>
      </section>

      <section className="card stack" aria-labelledby="dl">
        <h2 id="dl">Delivery</h2>
        <div className="seg" role="group" aria-label="Delivery method">
          <button type="button" aria-pressed={mode === "delivery"} onClick={() => setMode("delivery")}>Delivery</button>
          <button type="button" aria-pressed={mode === "pickup"} onClick={() => setMode("pickup")}>Pickup</button>
        </div>
        {mode === "delivery" && (
          <>
            <div className="pill-filters" role="group" aria-label="Saved addresses">
              {addrs.data?.map((a) => <button type="button" key={a.id} className="pill" aria-pressed={addrId === a.id} onClick={() => pickAddress(a)}>{a.label}</button>)}
              <button type="button" className="pill" aria-pressed={addrId === "new"} onClick={() => pickAddress("new")}>{addrs.data?.length ? "+ New address" : "Address"}</button>
            </div>
            {chosen ? (
              <div className="row spread nowrap">
                <div className="grow wrap-any"><strong>{chosen.location}</strong><div className="muted">{chosen.address}</div></div>
                <button type="button" className="btn ghost icon" aria-label={`Remove saved address ${chosen.label}`} onClick={() => removeAddress(chosen)}><Trash size={18} aria-hidden="true" /></button>
              </div>
            ) : (
              <>
                <Field label="Location" error={errs.location} help="Your delivery fee is based on this.">{(p) => (
                  <select {...p} className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
                    {locs.data?.map((l) => <option key={l}>{l}</option>)}
                  </select>)}
                </Field>
                <Field label="Street / barangay / landmark" error={errs.address}>{(p) => <textarea {...p} className="input" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />}</Field>
                <div className="row nowrap" style={{ gap: 12 }}>
                  <label className="row nowrap" style={{ gap: 8 }}><input type="checkbox" checked={saveIt} onChange={(e) => setSaveIt(e.target.checked)} /> Save for next time as</label>
                  <input className="input" style={{ maxWidth: 140 }} aria-label="Address name" value={label} maxLength={40} disabled={!saveIt} onChange={(e) => setLabel(e.target.value)} />
                </div>
              </>
            )}
          </>
        )}
        {mode === "delivery" && <PinPicker value={pin} onChange={setPin} />}
        <Field label="Receiver name" error={errs.receiver_name}>{(p) => <input {...p} className="input" name="receiver_name" defaultValue={saved.receiver_name ?? user.name} autoComplete="name" />}</Field>
        <Field label="Mobile number" error={errs.phone}>{(p) => <input {...p} className="input" name="phone" type="tel" inputMode="tel" defaultValue={saved.phone ?? user.phone} autoComplete="tel" />}</Field>
        <Field label="Notes (optional)">{(p) => <input {...p} className="input" name="notes" maxLength={300} />}</Field>
      </section>

      <section className="card stack" aria-labelledby="wn">
        <h2 id="wn">{mode === "pickup" ? "Pickup time" : "Delivery time"}</h2>
        <div className="pill-filters" role="group" aria-label="When">
          <button type="button" className="pill" aria-pressed={when === "asap"} onClick={() => setWhen("asap")}>As soon as possible</button>
          <button type="button" className="pill" aria-pressed={when === "tomorrow"} onClick={() => setWhen("tomorrow")}>Tomorrow 8 AM</button>
          <button type="button" className="pill" aria-pressed={when === "custom"} onClick={() => setWhen("custom")}>Pick a time</button>
        </div>
        {when === "custom" && <Field label="Date and time" error={errs.schedule}>{(p) => <input {...p} className="input" type="datetime-local" min={toLocalInput()} value={custom} onChange={(e) => setCustom(e.target.value)} />}</Field>}
      </section>

      <section className="card stack" aria-labelledby="py">
        <h2 id="py">Payment</h2>
        <div role="radiogroup" aria-label="Payment method" className="stack" style={{ gap: 8 }}>
          {methods.map((m) => (
            <button type="button" key={m} role="radio" aria-checked={pay === m} className="opt" onClick={() => { setPay(m); setProof(null); }}>
              <span className="radio" /><span><strong>{PAY_NAME[m] ?? m}</strong>{m === "COD" && <><br /><small className="muted">Pay the rider when it arrives</small></>}</span>
            </button>))}
        </div>
        {wallet && cfg.data && (
          <div className="stack" style={{ background: "var(--primary-soft)", borderRadius: 12, padding: 12 }}>
            <span>Send <strong className="num">{quote ? peso(quote.total) : "…"}</strong> to <strong className="num">{cfg.data[wallet[0]]}</strong> {cfg.data[wallet[1]] && `(${cfg.data[wallet[1]]})`}</span>
            <Field label="Your reference number (optional)">{(p) => <input {...p} className="input num" name="payment_ref" maxLength={60} />}</Field>
            <Field label="Payment screenshot (optional)" error={errs.proof} help="Send it now or later from Orders. JPG, PNG, WebP or PDF, up to 5 MB.">
              {(p) => <input {...p} className="input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />}
            </Field>
          </div>
        )}
        {pay === "Bank Transfer" && cfg.data?.bank_details && <p className="wrap-any" style={{ whiteSpace: "pre-wrap" }}>{cfg.data.bank_details}</p>}
      </section>

      <section className="card stack" aria-labelledby="sm" aria-live="polite">
        <h2 id="sm">Summary</h2>
        <div className="row spread"><span className="muted">Items</span><span className="num">{peso(subtotal)}</span></div>
        <div className="row spread"><span className="muted">{mode === "pickup" ? "Pickup" : `Delivery${location ? ` (${location})` : ""}`}</span><span className="num">{quote ? peso(quote.delivery_fee) : "…"}</span></div>
        {quote?.notes.map((n: string) => <small className="muted" key={n}>{n}</small>)}
        <div className="row spread"><strong>Total</strong><strong className="num" style={{ fontSize: 20 }}>{quote ? peso(quote.total) : "…"}</strong></div>
        <small className="muted">The final amount is confirmed by the server when you place the order.</small>
      </section>

      <div className="ordbar">
        <Button className="primary" type="submit" loading={busy} disabled={!quote} style={{ width: "100%", justifyContent: "space-between" }}>
          <span>Place order</span><span className="num">{quote ? peso(quote.total) : "…"}</span>
        </Button>
      </div>
    </form>
  );
}
