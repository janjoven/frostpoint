import { Bell, Headset, House, Receipt, ShoppingCart, SignIn, SignOut } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { Logo, LogoName, Modal, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { storeNavTarget } from "../../lib/storeNavigation";
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
  useEffect(() => { document.getElementById("main")?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [loc.pathname]);

  const tab = (to: string, label: string, icon: JSX.Element, badge = 0) => (
    <Link to={to} className="navlink" aria-current={storeNavTarget(loc.pathname) === to ? "page" : undefined} aria-label={`${label}${badge > 0 ? ", new activity" : ""}`} title={label}>
      <span className="store-nav-icon">{icon}{badge > 0 && <span className="customer-notification" aria-hidden="true" />}</span>
    </Link>
  );

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand"><Logo /><LogoName /></Link>
        <div className="row nowrap" style={{ gap: 4 }}>
          <button className="btn ghost icon" onClick={() => setBell(true)} aria-label={`Promotions${promos.data?.length ? ", new promotions" : ""}`} style={{ position: "relative" }}>
            <Bell size={22} aria-hidden="true" />{!!promos.data?.length && <span className="customer-notification topbar-notification" aria-hidden="true" />}
          </button>
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
      <nav className="bottomnav always store-nav" aria-label="Main">
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
