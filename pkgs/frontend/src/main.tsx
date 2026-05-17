import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

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

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
