import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./styles/app.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { useUI } from "./store";

document.documentElement.dataset.theme = "light";
try { localStorage.removeItem("fp-theme"); } catch { /* storage unavailable */ }

// Routes manage their own scroll position, including after a full reload.
if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } } });

const updateSW = registerSW({
  onNeedRefresh() {
    useUI.getState().setNeedsUpdate(() => updateSW(true));
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
);
