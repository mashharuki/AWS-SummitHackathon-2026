import { registerSW } from "virtual:pwa-register";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./i18n";
import "./index.css";

async function loadRuntimeConfig(): Promise<void> {
  try {
    const res = await fetch("/env-config.json");
    if (!res.ok) {
      console.warn(`[runtimeConfig] env-config.json: HTTP ${res.status}`);
      return;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      console.warn(
        `[runtimeConfig] env-config.json returned non-JSON (${contentType}). ConfigDeployStack が未デプロイの可能性があります。`,
      );
      return;
    }
    window.__SABOROU_ENV__ = (await res.json()) as Record<string, string>;
  } catch (err) {
    // ローカル開発: env-config.json 未配置のため import.meta.env にフォールバック
    console.warn("[runtimeConfig] env-config.json の取得に失敗しました:", err);
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
