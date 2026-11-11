import { Bell, Headset, House, Receipt, ShoppingCart, SignIn, SignOut } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Logo, Modal, Skeleton, ThemeToggle } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth, useCart } from "../../store";

const Home = lazy(() => import("./Home"));
const ProductPage = lazy(() => import("./ProductPage"));
const Cart = lazy(() => import("./Cart"));
const Checkout = lazy(() => import("./Checkout"));
const MyOrders = lazy(() => import("./MyOrders"));
const TrackOrder = lazy(() => import("./TrackOrder"));
const SupportChat = lazy(() => import("./SupportChat"));

export default function StoreApp() {
  const { user, logout } = useAuth();
  const count = useCart((s) => Object.values(s.lines).reduce((a, b) => a + b, 0));
  const [bell, setBell] = useState(false);
  const loc = useLocation();
  const promos = useQuery({ queryKey: ["promos"], queryFn: () => api<any[]>("/promotions") });
  const unread = useQuery({ queryKey: ["unread"], queryFn: () => api<{ unread: number }>("/support/mine/unread"), enabled: !!user, refetchInterval: 20_000 });
  useEffect(() => { document.getElementById("main")?.focus(); window.scrollTo(0, 0); }, [loc.pathname]);

  const tab = (to: string, label: string, icon: JSX.Element, badge = 0) => (
    <NavLink to={to} end={to === "/"} className="navlink">
      {icon}<span>{label}</span>{badge > 0 && <span className="dot" role="status" aria-label={`${badge} new`}>{badge}</span>}
    </NavLink>
  );

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand"><Logo /> FROSTPOINT</Link>
        <div className="row nowrap" style={{ gap: 4 }}>
          <button className="btn ghost icon" onClick={() => setBell(true)} aria-label={`Promotions${promos.data?.length ? `, ${promos.data.length} active` : ""}`} style={{ position: "relative" }}>
            <Bell size={22} aria-hidden="true" />{!!promos.data?.length && <span className="dot" style={{ top: 2, marginLeft: 8, minWidth: 16, height: 16 }}>{promos.data.length}</span>}
          </button>
          <ThemeToggle />
          {user ? <button className="btn ghost icon" onClick={() => logout()} aria-label="Sign out"><SignOut size={22} aria-hidden="true" /></button>
            : <Link to="/login" className="btn primary sm"><SignIn size={18} aria-hidden="true" /> Sign in</Link>}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="store-main" style={{ outline: "none" }}>
        <Suspense fallback={<div className="stack"><Skeleton h={120} /><Skeleton h={240} /></div>}>
          <Routes>
            <Route index element={<Home />} />
            <Route path="product/:id" element={<ProductPage />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="orders" element={<MyOrders />} />
            <Route path="orders/:id" element={<TrackOrder />} />
            <Route path="support" element={<SupportChat />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <nav className="bottomnav always" aria-label="Main">
        {tab("/", "Shop", <House size={22} aria-hidden="true" />)}
        {tab("/cart", "Cart", <ShoppingCart size={22} aria-hidden="true" />, count)}
        {tab("/orders", "Orders", <Receipt size={22} aria-hidden="true" />)}
        {tab("/support", "Support", <Headset size={22} aria-hidden="true" />, unread.data?.unread ?? 0)}
      </nav>
      {bell && (
        <Modal title="Promotions" onClose={() => setBell(false)}>
          {promos.data?.length ? promos.data.map((p) => (
            <article key={p.id} className="stack" style={{ gap: 4, marginBottom: 12 }}><strong>{p.title}</strong><p className="muted wrap-any">{p.message}</p></article>
          )) : <p className="muted">No promotions right now. Check back soon!</p>}
        </Modal>
      )}
    </>
  );
}
