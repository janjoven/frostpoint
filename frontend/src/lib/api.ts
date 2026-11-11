import { MOCK_MODE } from "./mockMode";

let accessToken = "";
let refreshing: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const setToken = (t: string) => {
  accessToken = t;
};

function messageFrom(body: any, status: number): string {
  const d = body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => String(e.msg).replace(/^Value error, /, "")).join(". ");
  return `Request failed (${status})`;
}

async function refreshToken(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
    .then(async (r) => {
      if (!r.ok) return false;
      accessToken = (await r.json()).access_token;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}, retry = true): Promise<T> {
  if (MOCK_MODE) {
    const { mockRequest } = await import("../mocks/api");
    try { return await mockRequest(path, opts) as T; }
    catch (e) { throw new ApiError((e as { status?: number }).status ?? 400, (e as Error).message); }
  }
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch("/api" + path, {
      method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
      headers,
      credentials: "same-origin",
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "You appear to be offline. Check your connection and try again.");
  }
  if (res.status === 401 && retry && !path.startsWith("/auth/") && (await refreshToken())) return api<T>(path, opts, false);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await res.json() : await res.blob();
  if (!res.ok) throw new ApiError(res.status, messageFrom(data, res.status));
  return data as T;
}

const FLAG = MOCK_MODE ? "fp-mock-has-session" : "fp-has-session";
export const markSession = (on: boolean) => {
  try { on ? localStorage.setItem(FLAG, "1") : localStorage.removeItem(FLAG); } catch { /* storage unavailable */ }
};
// Skip the refresh call (and its 401) for visitors who never signed in on this device.
export async function restoreSession() {
  if (MOCK_MODE) return (await import("../mocks/api")).mockUser();
  let hinted = true;
  try { hinted = !!localStorage.getItem(FLAG); } catch { /* assume yes */ }
  if (!hinted) return null;
  if (await refreshToken()) return api("/auth/me");
  markSession(false);
  return null;
}

export async function download(path: string, filename: string) {
  const blob = await api<Blob>(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
