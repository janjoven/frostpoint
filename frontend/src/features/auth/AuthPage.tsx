import { Eye, EyeSlash } from "@phosphor-icons/react";
import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Field, Logo, LogoName } from "../../components/ui";
import { PH_MOBILE, cleanPhone } from "../../lib/format";
import { homePath, useAuth } from "../../store";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fe, setFe] = useState<Record<string, string>>({});
  const { login, register } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const errors: Record<string, string> = {};
    if (mode === "register") {
      if (f.name.trim().length < 2) errors.name = "Enter your full name.";
      if (!PH_MOBILE.test(cleanPhone(f.phone))) errors.phone = "Enter a PH mobile number like 0917 123 4567.";
      if (f.password.length < 8) errors.password = "Use at least 8 characters.";
    }
    setFe(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setErr("");
    try {
      const u = mode === "login" ? await login(f.email, f.password) : await register({ ...f, phone: cleanPhone(f.phone) });
      nav(homePath(u) !== "/" ? homePath(u) : from ?? "/", { replace: true });
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="stack" style={{ width: "100%", maxWidth: 420 }}>
        <div className="row spread nowrap">
          <span className="brand"><Logo /><LogoName /></span>
        </div>
        <form className="card stack" onSubmit={submit} noValidate>
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <div className="seg" role="group" aria-label="Sign in or register">
            <button type="button" aria-pressed={mode === "login"} onClick={() => { setMode("login"); setErr(""); setFe({}); }}>Sign in</button>
            <button type="button" aria-pressed={mode === "register"} onClick={() => { setMode("register"); setErr(""); setFe({}); }}>Register</button>
          </div>
          {mode === "register" && (
            <Field label="Full name" error={fe.name}>{(p) => <input {...p} className="input" name="name" autoComplete="name" required />}</Field>
          )}
          <Field label="Email">{(p) => <input {...p} className="input" name="email" type="email" autoComplete="email" required />}</Field>
          {mode === "register" && (
            <>
              <Field label="Mobile number" error={fe.phone}>{(p) => <input {...p} className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" required />}</Field>
              <Field label="Delivery address" help="You can change this at checkout.">{(p) => <input {...p} className="input" name="address" autoComplete="street-address" />}</Field>
            </>
          )}
          <Field label="Password" error={fe.password}>
            {(p) => (
              <div className="row nowrap">
                <input {...p} className="input" name="password" type={show ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
                <button type="button" className="btn icon" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
                  {show ? <EyeSlash size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </div>
            )}
          </Field>
          {err && <div className="err" role="alert">{err}</div>}
          <Button className="primary" type="submit" loading={busy}>{mode === "login" ? "Sign in" : "Create account"}</Button>
        </form>
      </div>
    </main>
  );
}
