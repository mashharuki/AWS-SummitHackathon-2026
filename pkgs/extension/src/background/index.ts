/**
 * SABOROU Chrome 拡張 Background Service Worker
 *
 * 役割:
 * - 拡張機能アイコンクリック時に Side Panel を開く
 * - chrome.sidePanel のデフォルトパス設定
 *
 * NOTE (U-V2-02): content script の message passing ハンドラはここに追加する
 * NOTE (U-V2-08): Cognito PKCE コールバック処理もここに追加する予定
 */

// Side Panel のデフォルトパスを設定
chrome.sidePanel.setOptions({ path: "panel.html", enabled: true });

// アイコンクリック時に Side Panel を開く
chrome.action.onClicked.addListener((tab) => {
  if (!tab.windowId) return;
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Service Worker インストール時のログ
self.addEventListener("install", () => {
  console.info("[SABOROU] Background service worker installed");
});

self.addEventListener("activate", () => {
  console.info("[SABOROU] Background service worker activated");
});
