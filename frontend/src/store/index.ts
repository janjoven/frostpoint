import { create } from "zustand";
import { api, markSession, setToken } from "../lib/api";

export type User = { id: number; email: string; name: string; role: "customer" | "staff" | "owner" | "admin" | "rider"; phone: string; address: string };
export const isStaff = (u?: User | null) => !!u && ["staff", "owner", "admin"].includes(u.role);
export const isRider = (u?: User | null) => u?.role === "rider";
/** Where each kind of account lands after signing in. */
export const homePath = (u?: User | null) => (isStaff(u) ? "/admin" : isRider(u) ? "/rider" : "/");

type AuthState = {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  login: (email: string, password: string) => Promise<User>;
  register: (b: Record<string, string>) => Promise<User>;
  logout: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user, ready: true }),
  login: async (email, password) => {
    const r = await api("/auth/login", { body: { email, password } });
    setToken(r.access_token);
    markSession(true);
    set({ user: r.user, ready: true });
    return r.user;
  },
  register: async (body) => {
    const r = await api("/auth/register", { body });
    setToken(r.access_token);
    markSession(true);
    set({ user: r.user, ready: true });
    return r.user;
  },
  logout: async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setToken("");
    markSession(false);
    useCart.getState().clear();
    set({ user: null });
  },
}));

export type Product = { id: number; name: string; category: string; price: string; uom: string; stock: number; description: string; badge: string; min_order_qty: number; low_stock_at: number; is_active: boolean };

type CartState = { lines: Record<number, number>; set: (id: number, qty: number) => void; add: (id: number, qty: number) => void; clear: () => void };
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem("fp-cart") ?? "{}");
  } catch {
    return {};
  }
})();
export const useCart = create<CartState>((set, get) => {
  const save = (lines: Record<number, number>) => {
    try {
      localStorage.setItem("fp-cart", JSON.stringify(lines));
    } catch {
      /* storage unavailable */
    }
    set({ lines });
  };
  return {
    lines: saved,
    set: (id, qty) => {
      const lines = { ...get().lines };
      if (qty <= 0) delete lines[id];
      else lines[id] = qty;
      save(lines);
    },
    add: (id, qty) => get().set(id, (get().lines[id] ?? 0) + qty),
    clear: () => save({}),
  };
});

type Toast = { id: number; text: string; action?: { label: string; run: () => void } };
type ConfirmReq = { title: string; body?: string; confirm: string; danger?: boolean; input?: { label: string; required?: boolean; initial?: string }; resolve: (v: string | boolean | null) => void };
type UIState = {
  theme: "light" | "dark";
  toggleTheme: () => void;
  toasts: Toast[];
  toast: (text: string, action?: Toast["action"]) => void;
  dismiss: (id: number) => void;
  confirmReq: ConfirmReq | null;
  needsUpdate: (() => void) | null;
  setNeedsUpdate: (fn: (() => void) | null) => void;
};

const initialTheme = (): "light" | "dark" => {
  try {
    const s = localStorage.getItem("fp-theme");
    if (s === "light" || s === "dark") return s;
  } catch {
    /* ignore */
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};
let tid = 0;
export const useUI = create<UIState>((set, get) => ({
  theme: initialTheme(),
  toggleTheme: () => {
    const theme = get().theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("fp-theme", theme);
    } catch {
      /* ignore */
    }
    set({ theme });
  },
  toasts: [],
  toast: (text, action) => {
    const id = ++tid;
    set({ toasts: [...get().toasts, { id, text, action }] });
    setTimeout(() => get().dismiss(id), action ? 6000 : 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  confirmReq: null,
  needsUpdate: null,
  setNeedsUpdate: (needsUpdate) => set({ needsUpdate }),
}));

/** Replaces window.confirm / window.prompt with an accessible modal. */
export function ask(req: Omit<ConfirmReq, "resolve">): Promise<string | boolean | null> {
  return new Promise((resolve) => useUI.setState({ confirmReq: { ...req, resolve } }));
}
export const toast = (text: string, action?: Toast["action"]) => useUI.getState().toast(text, action);
