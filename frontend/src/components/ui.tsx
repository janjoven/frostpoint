import { CheckCircle, Info, Warning, X, XCircle } from "@phosphor-icons/react";
import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { useUI } from "../store";

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <img className="brand-logo" src="/branding/frost-point-logo-128.webp" srcSet="/branding/frost-point-logo-128.webp 128w, /branding/frost-point-logo-384.webp 384w" sizes={`${size}px`} width={size} height={size} alt="" aria-hidden="true" decoding="async" />
  );
}

export function LogoName() {
  return <img className="brand-wordmark" src="/branding/frost-point-name-256.webp" srcSet="/branding/frost-point-name-256.webp 256w, /branding/frost-point-name-512.webp 512w" sizes="(max-width: 392px) calc(100vw - 232px), 160px" width={160} height={53} alt="Frostpoint" decoding="async" />;
}

export function Button({ loading, children, className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button {...p} className={`btn ${className}`} disabled={p.disabled || loading} aria-busy={loading || undefined}>
      {loading && <span className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Field({ label, error, help, children }: { label: string; error?: string; help?: string; children: (p: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode }) {
  const id = useId();
  const desc = error ? id + "-e" : help ? id + "-h" : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-describedby": desc, "aria-invalid": error ? true : undefined })}
      {error ? (
        <div className="err" id={id + "-e"} role="alert">
          <XCircle size={14} aria-hidden="true" /> {error}
        </div>
      ) : help ? (
        <div className="help" id={id + "-h"}>{help}</div>
      ) : null}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const focusable = () => Array.from(el.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter((x) => !x.hasAttribute("disabled"));
    (el.querySelector<HTMLElement>("[data-autofocus]") ?? focusable()[1] ?? focusable()[0])?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const f = focusable();
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="row spread nowrap" style={{ marginBottom: 12 }}>
          <h2 id={titleId}>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close dialog"><X size={20} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function GlobalHosts() {
  const { toasts, dismiss, confirmReq, needsUpdate } = useUI();
  const [val, setVal] = useState("");
  useEffect(() => setVal(confirmReq?.input?.initial ?? ""), [confirmReq]);
  const close = (v: string | boolean | null) => {
    confirmReq?.resolve(v);
    useUI.setState({ confirmReq: null });
  };
  const offline = useOnline();
  return (
    <>
      {!offline && (
        <div className="banner" role="status" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 2500, borderRadius: 0, justifyContent: "center" }}>
          <Warning size={18} aria-hidden="true" /> You're offline. Showing saved data where available.
        </div>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <Info size={18} aria-hidden="true" /> <span>{t.text}</span>
            {t.action && <button onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
          </div>
        ))}
        {needsUpdate && (
          <div className="toast">
            <span>A new version is ready.</span>
            <button onClick={needsUpdate}>Update</button>
          </div>
        )}
      </div>
      {confirmReq && (
        <Modal title={confirmReq.title} onClose={() => close(confirmReq.input ? null : false)}>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (confirmReq.input?.required && !val.trim()) return;
              close(confirmReq.input ? val : true);
            }}
          >
            {confirmReq.body && <p className="muted">{confirmReq.body}</p>}
            {confirmReq.input && (
              <Field label={confirmReq.input.label}>
                {(p) => <input {...p} className="input" value={val} onChange={(e) => setVal(e.target.value)} data-autofocus required={confirmReq.input!.required} />}
              </Field>
            )}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => close(confirmReq.input ? null : false)}>Cancel</button>
              <button type="submit" className={`btn ${confirmReq.danger ? "danger" : "primary"}`}>{confirmReq.confirm}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function useOnline() {
  const [on, set] = useState(navigator.onLine);
  useEffect(() => {
    const u = () => set(true), d = () => set(false);
    addEventListener("online", u); addEventListener("offline", d);
    return () => { removeEventListener("online", u); removeEventListener("offline", d); };
  }, []);
  return on;
}

const STATUS_UI: Record<string, { cls: string; icon: ReactNode }> = {
  "Order Placed": { cls: "", icon: <Info size={14} weight="fill" aria-hidden="true" /> },
  "Order Confirmed": { cls: "", icon: <Info size={14} weight="fill" aria-hidden="true" /> },
  Preparing: { cls: "warn", icon: <Warning size={14} weight="fill" aria-hidden="true" /> },
  "Out for Delivery": { cls: "warn", icon: <Warning size={14} weight="fill" aria-hidden="true" /> },
  "Delivered Successfully": { cls: "ok", icon: <CheckCircle size={14} weight="fill" aria-hidden="true" /> },
  Cancelled: { cls: "bad", icon: <XCircle size={14} weight="fill" aria-hidden="true" /> },
};
export const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_UI[status] ?? STATUS_UI["Order Placed"];
  return <span className={`badge ${s.cls}`}>{s.icon}{status}</span>;
};

export const Skeleton = ({ h = 20, w = "100%" }: { h?: number; w?: string }) => <div className="skeleton" style={{ height: h, width: w }} aria-hidden="true" />;

export function Empty({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <strong style={{ color: "var(--text)" }}>{title}</strong>
      {hint && <span>{hint}</span>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="empty" role="alert">
      <XCircle size={32} aria-hidden="true" />
      <strong style={{ color: "var(--text)" }}>Couldn't load this</strong>
      <span>{(error as Error)?.message ?? "Something went wrong."}</span>
      {retry && <button className="btn" onClick={retry}>Try again</button>}
    </div>
  );
}
