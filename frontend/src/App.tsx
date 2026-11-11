import { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { GlobalHosts, Logo, Skeleton } from "./components/ui";
import AuthPage from "./features/auth/AuthPage";
import { restoreSession } from "./lib/api";
import { homePath, isRider, isStaff, useAuth, useUI } from "./store";

const AdminApp = lazy(() => import("./features/admin/AdminApp"));
const RiderApp = lazy(() => import("./features/rider/RiderApp"));
const StoreApp = lazy(() => import("./features/store/StoreApp"));

function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="splash" role="dialog" aria-label="FROSTPOINT is loading">
      <div className="stack" style={{ alignItems: "center" }}>
        <Logo size={96} />
        <h1 style={{ letterSpacing: "0.18em" }}>FROSTPOINT</h1>
        <p className="muted">Ice &amp; water delivery · Masbate</p>
        <button className="btn" onClick={onDone}>Skip</button>
      </div>
    </div>
  );
}

function Guard({ children, area }: { children: JSX.Element; area: "staff" | "rider" }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div style={{ padding: 24 }}><Skeleton h={120} /></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (!(area === "staff" ? isStaff(user) : isRider(user))) return <Navigate to={homePath(user)} replace />;
  return children;
}

export default function App() {
  const { user, ready, setUser } = useAuth();
  const theme = useUI((s) => s.theme);
  const [splash, setSplash] = useState(() => {
    try { return !sessionStorage.getItem("fp-splash"); } catch { return false; }
  });

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { restoreSession().then((u) => setUser(u)).catch(() => setUser(null)); }, [setUser]);
  const endSplash = () => {
    try { sessionStorage.setItem("fp-splash", "1"); } catch { /* ignore */ }
    setSplash(false);
  };

  return (
    <>
      <a className="skip" href="#main">Skip to main content</a>
      {splash && <Splash onDone={endSplash} />}
      <Suspense fallback={<div style={{ padding: 24 }}><Skeleton h={160} /></div>}>
        <Routes>
          <Route path="/login" element={ready && user ? <Navigate to={homePath(user)} replace /> : <AuthPage />} />
          <Route path="/admin/*" element={<Guard area="staff"><AdminApp /></Guard>} />
          <Route path="/rider/*" element={<Guard area="rider"><RiderApp /></Guard>} />
          <Route path="/*" element={ready && homePath(user) !== "/" ? <Navigate to={homePath(user)} replace /> : <StoreApp />} />
        </Routes>
      </Suspense>
      <GlobalHosts />
    </>
  );
}
