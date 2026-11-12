import { create } from "zustand";

const ENABLED_KEY = "fp-layout-editor-enabled";
function savedEnabled() {
  try { return localStorage.getItem(ENABLED_KEY) === "1"; } catch { return false; }
}

export const useEditorState = create<{ enabled: boolean; setEnabled: (enabled: boolean) => void }>((set) => ({
  enabled: savedEnabled(),
  setEnabled: (enabled) => {
    try { localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0"); } catch { /* session-only preference */ }
    set({ enabled });
  },
}));
