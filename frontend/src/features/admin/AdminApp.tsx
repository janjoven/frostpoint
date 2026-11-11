import { ChartLine, ClockCounterClockwise, Package, Receipt, Megaphone, Gear, Headset, House, List, SignOut, Users as UsersIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { ReactNode, Suspense, lazy, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Logo, Modal, Skeleton, ThemeToggle } from "../../components/ui";
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
const PRIMARY = ["", "orders", "products", "support"];

export default function AdminApp() {
  const { user, logout } = useAuth();
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const items = ITEMS.filter((i) => !i.owner || user!.role !== "staff");
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api("/admin/stats"), refetchInterval: 30_000 });
  const unread = stats.data?.unread_support ?? 0;
  useEffect(() => { setMore(false); document.getElementById("main")?.focus(); }, [loc.pathname]);

  const link = (i: Item) => (
    <NavLink key={i.to} to={`/admin/${i.to}`} end={i.to === ""} className="navlink">
      {i.icon}<span>{i.label}</span>
      {i.to === "support" && unread > 0 && <span className="dot" role="status" aria-label={`${unread} unread messages`}>{unread}</span>}
    </NavLink>
  );

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Business Panel">
        <span className="brand" style={{ padding: "4px 14px 16px" }}><Logo /> FROSTPOINT</span>
        <nav className="stack" style={{ gap: 4 }}>{items.map(link)}</nav>
        <div style={{ marginTop: "auto" }} className="stack">
          <div className="row spread"><span className="muted wrap-any">{user!.name}<br /><small>{user!.role}</small></span><ThemeToggle /></div>
          <button className="btn" onClick={() => logout()}><SignOut size={18} aria-hidden="true" /> Sign out</button>
        </div>
      </aside>
      <div>
        <header className="topbar mobile-only">
          <span className="brand"><Logo /> FROSTPOINT</span>
          <ThemeToggle />
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
      <nav className="bottomnav" aria-label="Business Panel">
        {items.filter((i) => PRIMARY.includes(i.to)).map(link)}
        <button className="navlink" onClick={() => setMore(true)} aria-haspopup="dialog"><List size={22} aria-hidden="true" /><span>More</span></button>
      </nav>
      {more && (
        <Modal title="More" onClose={() => setMore(false)}>
          <div className="stack" style={{ gap: 4 }}>
            {items.filter((i) => !PRIMARY.includes(i.to)).map((i) => (
              <NavLink key={i.to} to={`/admin/${i.to}`} className="btn ghost" style={{ justifyContent: "flex-start" }}>{i.icon}{i.label}</NavLink>
            ))}
            <button className="btn danger" onClick={() => logout()}><SignOut size={20} aria-hidden="true" /> Sign out</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
