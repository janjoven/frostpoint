// Mock data is opt-in and unavailable in production builds.
export const MOCK_MODE = import.meta.env.DEV && import.meta.env.MODE === "mock";
