import { EnvelopeSimple, Eye, EyeSlash, LockKey, PencilSimple, SignIn, UserCircle } from "@phosphor-icons/react";
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
  const [resetNotice, setResetNotice] = useState(false);
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
    <main id="main" className="auth-page">
      <div className="auth-snowflake auth-snowflake-one" aria-hidden="true">❄</div>
      <div className="auth-snowflake auth-snowflake-two" aria-hidden="true">❄</div>
      <div className="auth-snowflake auth-snowflake-three" aria-hidden="true">❄</div>
      <div className="auth-shell">
        <header className="auth-brand">
          <Logo size={112} />
          <LogoName />
        </header>
        <form className="auth-card stack" onSubmit={submit} noValidate>
          <div className="auth-heading">
            <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p>{mode === "login" ? <>Sign in to your <strong>Frostpoint</strong> account</> : "Join Frostpoint for fast, reliable ice delivery."}</p>
          </div>
          <div className="auth-seg" role="group" aria-label="Sign in or register">
            <button type="button" aria-pressed={mode === "login"} onClick={() => { setMode("login"); setErr(""); setFe({}); setResetNotice(false); }}>
              <UserCircle size={23} weight="fill" aria-hidden="true" /> Sign in
            </button>
            <button type="button" aria-pressed={mode === "register"} onClick={() => { setMode("register"); setErr(""); setFe({}); setResetNotice(false); }}>
              <PencilSimple size={23} aria-hidden="true" /> Register
            </button>
          </div>
          {mode === "register" && (
            <Field label="Full name" error={fe.name}>{(p) => <div className="auth-control"><UserCircle size={22} aria-hidden="true" /><input {...p} className="input" name="name" placeholder="Enter your full name..." autoComplete="name" required /></div>}</Field>
          )}
          <Field label="Email">{(p) => <div className="auth-control"><EnvelopeSimple size={22} aria-hidden="true" /><input {...p} className="input" name="email" type="email" placeholder="Enter your email address..." autoComplete="email" required /></div>}</Field>
          {mode === "register" && (
            <>
              <Field label="Mobile number" error={fe.phone}>{(p) => <div className="auth-control"><input {...p} className="input" name="phone" type="tel" inputMode="tel" placeholder="0917 123 4567" autoComplete="tel" required /></div>}</Field>
              <Field label="Delivery address" help="You can change this at checkout.">{(p) => <div className="auth-control"><input {...p} className="input" name="address" placeholder="Enter your delivery address..." autoComplete="street-address" /></div>}</Field>
            </>
          )}
          <Field label="Password" error={fe.password}>
            {(p) => (
              <div className="auth-password-row">
                <div className="auth-control"><LockKey size={22} weight="fill" aria-hidden="true" /><input {...p} className="input" name="password" type={show ? "text" : "password"} placeholder="Enter your password..." autoComplete={mode === "login" ? "current-password" : "new-password"} required /></div>
                <button type="button" className="auth-eye" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
                  {show ? <EyeSlash size={23} aria-hidden="true" /> : <Eye size={23} aria-hidden="true" />}
                </button>
              </div>
            )}
          </Field>
          {err && <div className="err" role="alert">{err}</div>}
          <Button className="primary auth-submit" type="submit" loading={busy}><SignIn size={24} weight="bold" aria-hidden="true" />{mode === "login" ? "Sign in" : "Create account"}</Button>
          {mode === "login" && (
            <div className="auth-forgot-wrap">
              <span className="auth-forgot-rule" aria-hidden="true" />
              <button type="button" className="auth-forgot" onClick={() => setResetNotice(true)}><LockKey size={18} weight="fill" aria-hidden="true" />Forgot Password?</button>
              <span className="auth-forgot-rule" aria-hidden="true" />
              {resetNotice && <p className="help" role="status">Password reset isn’t set up yet. Please contact Frostpoint staff for help.</p>}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
