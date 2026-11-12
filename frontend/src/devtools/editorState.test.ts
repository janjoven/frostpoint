import { afterEach, beforeEach, expect, it, vi } from "vitest";

const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.resetModules();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

it("starts disabled and remembers enabling across reloads", async () => {
  const { useEditorState } = await import("./editorState");
  expect(useEditorState.getState().enabled).toBe(false);
  useEditorState.getState().setEnabled(true);
  vi.resetModules();
  expect((await import("./editorState")).useEditorState.getState().enabled).toBe(true);
});

it("disables the editor without deleting saved layout changes", async () => {
  values.set("fp-layout-editor-v1", "saved layout");
  const { useEditorState } = await import("./editorState");
  useEditorState.getState().setEnabled(true);
  useEditorState.getState().setEnabled(false);
  expect(useEditorState.getState().enabled).toBe(false);
  expect(values.get("fp-layout-editor-v1")).toBe("saved layout");
  vi.resetModules();
  expect((await import("./editorState")).useEditorState.getState().enabled).toBe(false);
});
