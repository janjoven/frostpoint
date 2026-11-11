import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

it("keeps mock mode disabled in production even if built with --mode mock", async () => {
  vi.stubEnv("MODE", "mock");
  vi.stubEnv("DEV", false);
  vi.resetModules();
  expect((await import("./mockMode")).MOCK_MODE).toBe(false);
});

it("intercepts API calls and session restoration in mock mode without fetching", async () => {
  vi.stubEnv("MODE", "mock");
  vi.stubEnv("DEV", true);
  const fetch = vi.fn(() => { throw new Error("Unexpected network call"); });
  vi.stubGlobal("fetch", fetch);
  vi.resetModules();
  const { api, restoreSession } = await import("./api");
  expect(await api("/products")).toHaveLength(4);
  expect(await restoreSession()).toHaveProperty("role", "customer");
  await expect(api("/missing-mock-route")).rejects.toHaveProperty("status", 501);
  expect(fetch).not.toHaveBeenCalled();
});
