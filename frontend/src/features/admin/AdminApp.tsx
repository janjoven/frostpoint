import { CaretDoubleLeft, CaretDoubleRight, ChartLine, ClockCounterClockwise, Package, Receipt, Megaphone, Gear, Headset, House, List, SignOut, Users as UsersIcon, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { ReactNode, Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Logo, LogoName, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../store";

const Dashboard = lazy(() => import("./Dashboard"));
const Products = lazy(() => import("./Products"));
const Orders = lazy(() => import("./Orders"));
const Reports = lazy(() => import("./Reports"));
const UsersPage = lazy(() => import("./Users"));
const Broadcast = lazy(() => import("./Broadcast"));
const SettingsPage = lazy(() => import("./Settings"));
const Support = lazy(() => import("./Support"));
const Activity = lazy(() => import("./Activity"));

type Item = { to: string; label: string; icon: ReactNode; owner?: boolean };
const ITEMS: Item[] = [
  { to: "", label: "Dashboard", icon: <House size={22} aria-hidden="true" /> },
  { to: "orders", label: "Orders", icon: <Receipt size={22} aria-hidden="true" /> },
  { to: "products", label: "Products", icon: <Package size={22} aria-hidden="true" /> },
  { to: "support", label: "Support", icon: <Headset size={22} aria-hidden="true" /> },
  { to: "reports", label: "Reports", icon: <ChartLine size={22} aria-hidden="true" /> },
  { to: "users", label: "Users", icon: <UsersIcon size={22} aria-hidden="true" />, owner: true },
  { to: "broadcast", label: "Broadcast", icon: <Megaphone size={22} aria-hidden="true" /> },
  { to: "settings", label: "Settings", icon: <Gear size={22} aria-hidden="true" /> },
  { to: "activity", label: "Activity Log", icon: <ClockCounterClockwise size={22} aria-hidden="true" />, owner: true },
];
const DESKTOP = "(min-width: 1024px)";

export default function AdminApp() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("fp-admin-sidebar-collapsed") === "1"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches);
  const sidebar = useRef<HTMLElement>(null);
  const loc = useLocation();
  const items = ITEMS.filter((i) => !i.owner || user!.role !== "staff");
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api("/admin/stats"), refetchInterval: 30_000 });
  const unread = stats.data?.unread_support ?? 0;
  useLayoutEffect(() => {
    setMobileOpen(false);
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    try { localStorage.setItem("fp-admin-sidebar-collapsed", collapsed ? "1" : "0"); } catch { /* storage unavailable */ }
  }, [collapsed]);
  useEffect(() => {
    const media = window.matchMedia(DESKTOP);
    const change = () => { setDesktop(media.matches); setMobileOpen(false); };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (desktop || !mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = sidebar.current!;
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'));
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== "Tab") return;
      const nodes = focusable(), first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [desktop, mobileOpen]);

  const link = (i: Item) => (
    <NavLink key={i.to} to={`/admin/${i.to}`} end={i.to === ""} className="navlink admin-navlink" onClick={() => { if (!desktop) setMobileOpen(false); }} title={desktop && collapsed ? i.label : undefined} aria-label={`${i.label}${i.to === "support" && unread > 0 ? `, ${unread} unread messages` : ""}`}>
      {i.icon}<span className="sidebar-nav-label">{i.label}</span>
      {i.to === "support" && unread > 0 && <span className="sidebar-notification" aria-hidden="true" />}
    </NavLink>
  );

  return (
    <div className={`shell admin-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      {!desktop && mobileOpen && <button className="admin-sidebar-scrim" tabIndex={-1} type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      {(desktop || mobileOpen) && <aside ref={sidebar} className={`sidebar admin-sidebar${mobileOpen ? " is-open" : ""}`} role={desktop ? undefined : "dialog"} aria-modal={desktop ? undefined : true} aria-label="Business navigation">
        <div className="sidebar-header">
          <span className="brand"><Logo size={36} /><LogoName /></span>
          {!desktop && <button type="button" className="btn ghost icon sidebar-toggle" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20} aria-hidden="true" /></button>}
        </div>
        <div className="sidebar-caption">Business panel</div>
        <nav id="admin-navigation" className="sidebar-navigation" aria-label="Business panel sections">{items.map(link)}</nav>
        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <span className="sidebar-avatar" aria-hidden="true">{user!.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("")}</span>
            <div className="sidebar-account"><strong title={user!.name}>{user!.name}</strong><small>{user!.role}</small></div>
            {desktop && <div className="sidebar-footer-controls">
              <button type="button" className="btn ghost icon sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="admin-navigation" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <CaretDoubleRight size={18} aria-hidden="true" /> : <CaretDoubleLeft size={18} aria-hidden="true" />}</button>
            </div>}
          </div>
          <button type="button" className="btn ghost sidebar-signout" onClick={() => logout()} aria-label="Sign out" title={collapsed && desktop ? "Sign out" : undefined}><SignOut size={20} aria-hidden="true" /><span className="sidebar-nav-label">Sign out</span></button>
        </div>
      </aside>}
      <div className="admin-workspace" aria-hidden={!desktop && mobileOpen ? true : undefined}>
        <header className="topbar mobile-only">
          <button type="button" className="btn ghost icon" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls={mobileOpen ? "admin-navigation" : undefined} onClick={() => setMobileOpen(true)}><List size={22} aria-hidden="true" /></button>
          <span className="brand"><Logo /><LogoName /></span>
        </header>
        <main id="main" tabIndex={-1} className="main" style={{ outline: "none" }}>
          <Suspense fallback={<div className="stack"><Skeleton h={40} w="40%" /><Skeleton h={120} /><Skeleton h={240} /></div>}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="products" element={<Products />} />
              <Route path="reports" element={<Reports />} />
              <Route path="users" element={user!.role === "staff" ? <Navigate to="/admin" replace /> : <UsersPage />} />
              <Route path="broadcast" element={<Broadcast />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="support" element={<Support />} />
              <Route path="activity" element={user!.role === "staff" ? <Navigate to="/admin" replace /> : <Activity />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
