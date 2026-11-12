import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

it("keeps mock mode disabled in production even if built with --mode mock", async () => {
  vi.stubEnv("MODE", "mock");
  vi.stubEnv("DEV", false);
  vi.resetModules();
  expect((await import("./mockMode")).MOCK_MODE).toBe(false);
});

it.each(["mock", "editor", "production"])("excludes the editor from production in %s mode", async (mode) => {
  vi.stubEnv("MODE", mode);
  vi.stubEnv("DEV", false);
  vi.resetModules();
  const flags = await import("./mockMode");
  expect(flags.MOCK_MODE).toBe(false);
  expect(flags.UI_EDITOR_MODE).toBe(false);
});

it.each(["development", "mock", "editor"])("makes the editor available in %s development without changing the data mode", async (mode) => {
  vi.stubEnv("DEV", true);
  vi.stubEnv("MODE", mode);
  vi.resetModules();
  const flags = await import("./mockMode");
  expect(flags.UI_EDITOR_MODE).toBe(true);
  expect(flags.MOCK_MODE).toBe(mode === "mock" || mode === "editor");
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
