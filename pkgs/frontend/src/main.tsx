import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";

/**
 * CDK BucketDeployment が S3 に配置した /env-config.json を取得し
 * window.__SABOROU_ENV__ にセットする。
 * ローカル開発時はファイルが存在しないため無視して import.meta.env を使う。
 */
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

/**
 * VITE_USE_MOCK=true のとき MSW ブラウザワーカーを起動してから描画する。
 * ローカル開発でバックエンド未接続のまま UI を検証するためのモード.
 */
async function enableMocking(): Promise<void> {
  if (import.meta.env["VITE_USE_MOCK"] !== "true") {
    return;
  }
  const { worker } = await import("./mocks/browser.ts");
  await worker.start({ onUnhandledRequest: "bypass" });
}

Promise.all([loadRuntimeConfig(), enableMocking()]).then(() => {
  registerSW({ immediate: true });
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
