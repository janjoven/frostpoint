// Mock data is opt-in and unavailable in production builds.
export const UI_EDITOR_MODE = import.meta.env.DEV;
export const MOCK_MODE = import.meta.env.DEV && (import.meta.env.MODE === "mock" || import.meta.env.MODE === "editor");
