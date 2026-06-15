/**
 * content/index.ts — SABOROU Content Script
 *
 * Slack ページで動作する content script。
 * - MutationObserver で DOM を監視し、自分宛てメッセージを検知
 * - 検知したメッセージを chrome.runtime.sendMessage で Side Panel に送信
 * - Side Panel からの送信指示を chrome.runtime.onMessage で受信し、
 *   Slack ContentEditable に自動入力・送信する
 *
 * セキュリティ:
 * - manifest.json で matches: ["https://app.slack.com/*"] に限定
 * - DOM 書き込み（入力・送信）は Side Panel からの承認後指示でのみ実行
 * - 読み取り（監視）は常時実行
 */

import type {
  NewSlackMessage,
  NewSlackMessagePayload,
  SendSlackReplyMessage,
} from "@/messages";
import { MESSAGE_CONTAINER } from "./selectors";
import {
  clickSendButton,
  extractMessageData,
  isMentionedToMe,
  typeIntoSlackInput,
} from "./slackDom";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * 処理済みメッセージのタイムスタンプ Set
 * 重複通知を防ぐ（リロード時にクリアされるため永続化は不要）
 */
const processedTs = new Set<string>();

// ---------------------------------------------------------------------------
// Debounce utility
// ---------------------------------------------------------------------------

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }) as T;
}

// ---------------------------------------------------------------------------
// Message detection
// ---------------------------------------------------------------------------

/**
 * DOM から自分宛てメッセージを検知して Side Panel に送信する
 */
function scanForNewMessages(): void {
  const pathname = window.location.pathname;
  const containers = document.querySelectorAll(MESSAGE_CONTAINER);

  for (const container of containers) {
    // 自分宛てかどうかチェック（Slack User ID は未取得のため DM URL のみで判定）
    if (!isMentionedToMe(container, pathname)) {
      continue;
    }

    const data = extractMessageData(container, pathname);
    if (!data) continue;

    // threadTs がない場合はコンテナの要素位置をキーにする
    const dedupeKey =
      data.threadTs || `${data.channelId}-${data.text.slice(0, 40)}`;

    // 重複チェック
    if (processedTs.has(dedupeKey)) continue;
    processedTs.add(dedupeKey);

    const payload: NewSlackMessagePayload = {
      ...data,
      detectedAt: new Date().toISOString(),
    };

    // Side Panel へ通知
    sendMessageToSidePanel({ type: "NEW_SLACK_MESSAGE", payload });
  }
}

/**
 * chrome.runtime.sendMessage のラッパー（エラーを握り潰す）
 * Side Panel が開いていない場合にエラーが発生するため
 */
function sendMessageToSidePanel(message: NewSlackMessage): void {
  chrome.runtime.sendMessage(message).catch((err: unknown) => {
    // Side Panel が開いていない場合: Could not establish connection.
    // この場合は無視する（次回の監視で再試行される）
    if (
      err instanceof Error &&
      err.message.includes("Could not establish connection")
    ) {
      return;
    }
    console.warn("[SABOROU] sendMessage error:", err);
  });
}

// ---------------------------------------------------------------------------
// MutationObserver setup
// ---------------------------------------------------------------------------

const debouncedScan = debounce(
  scanForNewMessages as (...args: unknown[]) => void,
  300,
);

const observer = new MutationObserver(() => {
  debouncedScan();
});

/**
 * 起動直後の初回スキャン。
 * 既存メッセージを通知の洪水にしないため、最新 1 件のみ通知し、
 * それ以外は「既読」として processedTs に登録する。
 * 以降は MutationObserver が新規メッセージのみ検知する。
 */
function initialScan(): void {
  const pathname = window.location.pathname;
  const containers = Array.from(
    document.querySelectorAll(MESSAGE_CONTAINER),
  ).filter((c) => isMentionedToMe(c, pathname));

  if (containers.length === 0) return;

  // 最新のメッセージ（DOM 末尾）以外を既読扱いにする
  const latest = containers[containers.length - 1];
  for (const container of containers) {
    const data = extractMessageData(container, pathname);
    if (!data) continue;
    const dedupeKey =
      data.threadTs || `${data.channelId}-${data.text.slice(0, 40)}`;

    if (container === latest) {
      if (processedTs.has(dedupeKey)) continue;
      processedTs.add(dedupeKey);
      sendMessageToSidePanel({
        type: "NEW_SLACK_MESSAGE",
        payload: { ...data, detectedAt: new Date().toISOString() },
      });
    } else {
      processedTs.add(dedupeKey);
    }
  }
  console.info(
    `[SABOROU] Initial scan: ${containers.length} mentioned messages, notified latest`,
  );
}

// DOM が読み込まれてから監視開始
function startObserving(): void {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  // 起動直後に一度だけ初回スキャン（Slack は遅延描画するため少し待つ）
  setTimeout(initialScan, 1500);
  console.info("[SABOROU] Content script: DOM observation started");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startObserving);
} else {
  startObserving();
}

// ---------------------------------------------------------------------------
// Message listener (Side Panel → content script)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: SendSlackReplyMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { ok: boolean; error?: string }) => void,
  ) => {
    if (message.type === "SEND_SLACK_REPLY") {
      handleSendReply(message.text)
        .then(() => sendResponse({ ok: true }))
        .catch((err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error("[SABOROU] Failed to send Slack reply:", errorMessage);
          sendResponse({ ok: false, error: errorMessage });
        });
      // true を返すことで非同期 sendResponse を有効にする
      return true;
    }
  },
);

/**
 * Slack への自動入力・送信処理（承認後のみ呼ばれる）
 */
async function handleSendReply(text: string): Promise<void> {
  // 入力フィールドに入力
  typeIntoSlackInput(text);

  // 送信ボタンが有効になるまで少し待つ（React の状態更新を待つ）
  await new Promise<void>((resolve) => setTimeout(resolve, 100));

  // 送信ボタンをクリック
  clickSendButton();
}
