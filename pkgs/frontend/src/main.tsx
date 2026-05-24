import { registerSW } from "virtual:pwa-register";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./i18n";
import "./index.css";

async function loadRuntimeConfig(): Promise<void> {
  try {
    const res = await fetch("/env-config.json");
    if (res.ok) {
      window.__SABOROU_ENV__ = (await res.json()) as Record<string, string>;
    }
  } catch {
    // ローカル開発: env-config.json 未配置のため import.meta.env にフォールバック
  }
}

loadRuntimeConfig().then(() => {
  registerSW({ immediate: true });
  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
