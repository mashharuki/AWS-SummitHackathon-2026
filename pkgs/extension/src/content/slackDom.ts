/**
 * slackDom.ts — Slack DOM 操作ユーティリティ
 *
 * 純粋ロジック中心の設計でテスタビリティを確保する。
 * DOM 要素や属性は引数として受け取り、グローバル document への依存を最小化する。
 */

import {
  CHANNEL_ID_FROM_URL_REGEX,
  CHANNEL_URL_PATTERN,
  DATA_MSG_CHANNEL_ID_ATTR,
  DATA_MSG_TS_ATTR,
  DATA_TS_ATTR,
  DM_URL_PATTERN,
  MENTION_SPAN,
  MESSAGE_INPUT,
  MESSAGE_TEXT,
  SENDER_NAME,
  SEND_BUTTON,
  THREAD_MESSAGE_INPUT,
  THREAD_SEND_BUTTON,
} from "./selectors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackMessageData {
  /** メッセージ本文テキスト */
  text: string;
  /** 送信者の表示名 */
  sender: string;
  /** Slack チャンネル ID（DM も含む） */
  channelId: string;
  /** メッセージのタイムスタンプ（スレッド返信用） */
  threadTs: string;
}

// ---------------------------------------------------------------------------
// URL ベースの判定
// ---------------------------------------------------------------------------

/**
 * 現在の URL が DM チャンネルを指しているか判定する
 * /messages/U... 形式が DM
 */
export function isDmUrl(pathname: string): boolean {
  return DM_URL_PATTERN.test(pathname);
}

/**
 * 現在の URL がパブリック/プライベートチャンネルを指しているか判定する
 * /messages/C... 形式がチャンネル
 */
export function isChannelUrl(pathname: string): boolean {
  return CHANNEL_URL_PATTERN.test(pathname);
}

/**
 * URL パスからチャンネル ID を抽出する
 * @returns チャンネル ID（例: "U1234567890", "C1234567890"）または null
 */
export function extractChannelIdFromUrl(pathname: string): string | null {
  const match = CHANNEL_ID_FROM_URL_REGEX.exec(pathname);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// メッセージ要素ベースの判定
// ---------------------------------------------------------------------------

/**
 * メッセージ要素が自分のメッセージかどうか判定する
 *
 * Slack は自分のメッセージに "c-message--sent-by-me" や
 * data-qa 属性で区別をつける場合があるが、最も安定した判定は
 * ユーザーの Slack ID との照合であるため、ここでは
 * DM 判定と組み合わせて使う。
 *
 * @param element メッセージコンテナ要素
 * @param mySlackUserId 自分の Slack User ID（"U"で始まる）
 */
export function isSelfMessage(
  element: Element,
  mySlackUserId: string,
): boolean {
  // data-qa="message_sender_name" がある場合に送信者 ID と比較
  const senderEl = element.querySelector(SENDER_NAME);
  if (senderEl) {
    const senderId =
      senderEl.getAttribute("data-message-sender") ??
      senderEl.getAttribute("data-user-id");
    if (senderId) {
      return senderId === mySlackUserId;
    }
  }
  // class ベースのフォールバック（Slack が "c-message--sent-by-me" を付与する場合）
  return element.classList.contains("c-message--sent-by-me");
}

/**
 * メッセージが自分宛て（@mention または DM）かどうか判定する
 *
 * @param element メッセージコンテナ要素
 * @param mySlackUserId 自分の Slack User ID（省略時は DM URL のみで判定）
 * @param currentPathname 現在のページの pathname
 */
export function isMentionedToMe(
  element: Element,
  currentPathname: string,
  mySlackUserId?: string,
): boolean {
  // DM チャンネルの場合: 全メッセージが自分宛て（自分の送信を除く）
  if (isDmUrl(currentPathname)) {
    // 自分が送ったメッセージは除外
    if (mySlackUserId && isSelfMessage(element, mySlackUserId)) {
      return false;
    }
    return true;
  }

  // チャンネルの場合: @mention があるか確認
  if (isChannelUrl(currentPathname)) {
    const mentions = element.querySelectorAll(MENTION_SPAN);

    // mySlackUserId が分かっている場合は厳密判定（自分への mention のみ）
    if (mySlackUserId) {
      for (const mention of mentions) {
        const uid =
          mention.getAttribute("data-stringify-mention") ??
          mention.getAttribute("data-user-id");
        if (uid === mySlackUserId) {
          return true;
        }
      }
      return false;
    }

    // mySlackUserId 未取得時のフォールバック:
    // @mention を含むメッセージは「自分宛ての可能性がある候補」として拾う。
    // （誰かがメンションされている = 反応が必要なことが多い）
    return mentions.length > 0;
  }

  return false;
}

// ---------------------------------------------------------------------------
// メッセージデータ抽出
// ---------------------------------------------------------------------------

/**
 * メッセージコンテナ要素からメッセージデータを抽出する
 *
 * @param element メッセージコンテナ要素
 * @param currentPathname 現在のページの pathname（チャンネル ID 取得用）
 * @returns SlackMessageData または null（抽出失敗時）
 */
export function extractMessageData(
  element: Element,
  currentPathname: string,
): SlackMessageData | null {
  // テキスト本文
  const textEl = element.querySelector(MESSAGE_TEXT);
  const text = textEl?.textContent?.trim() ?? "";

  // 送信者名
  const senderEl = element.querySelector(SENDER_NAME);
  const sender = senderEl?.textContent?.trim() ?? "不明";

  // チャンネル ID: メッセージ要素の data-msg-channel-id 属性を最優先
  // （実機で最も確実）。なければ URL から取得（フォールバック）。
  const channelId =
    element.getAttribute(DATA_MSG_CHANNEL_ID_ATTR) ??
    extractChannelIdFromUrl(currentPathname) ??
    "";

  // タイムスタンプ（data-msg-ts 属性 → data-ts → archives リンク）
  const threadTs = extractThreadTs(element);

  if (!channelId) {
    return null;
  }

  return { text, sender, channelId, threadTs };
}

/**
 * メッセージ要素からスレッドタイムスタンプを抽出する
 * Slack は data-ts 属性や特定の属性でタイムスタンプを保持している
 */
export function extractThreadTs(element: Element): string {
  // data-msg-ts 属性（実機で最も確実。例: "1781155988.869619"）
  const msgTs = element.getAttribute(DATA_MSG_TS_ATTR);
  if (msgTs) return msgTs;

  // data-ts 属性（旧来のフォールバック）
  const ts = element.getAttribute(DATA_TS_ATTR);
  if (ts) return ts;

  // タイムスタンプリンクの href から抽出
  // 例: /archives/C123/p1234567890123456
  const tsLink = element.querySelector('a[href*="/archives/"]');
  if (tsLink) {
    const href = tsLink.getAttribute("href") ?? "";
    const match = /\/p(\d+)/.exec(href);
    if (match) {
      // Slack の ts 形式: "1234567890.123456"
      const raw = match[1];
      if (raw.length >= 10) {
        return `${raw.slice(0, 10)}.${raw.slice(10)}`;
      }
    }
  }

  return "";
}

// ---------------------------------------------------------------------------
// Slack ContentEditable 自動入力
// ---------------------------------------------------------------------------

/**
 * Slack のメッセージ入力フィールドにテキストを入力する
 *
 * Slack の入力フィールドは ContentEditable + React 合成イベントで構成されている。
 * execCommand('insertText') が最初の手段で、
 * InputEvent dispatch がフォールバック（二段構え）。
 *
 * @param text 入力するテキスト
 * @param doc document（テスト用に差し替え可能）
 * @throws 入力フィールドが見つからない場合
 */
export function typeIntoSlackInput(
  text: string,
  doc: Document = document,
): void {
  // スレッド内入力フィールドを優先、なければメインの入力フィールド
  const input =
    doc.querySelector<HTMLElement>(THREAD_MESSAGE_INPUT) ??
    doc.querySelector<HTMLElement>(MESSAGE_INPUT);

  if (!input) {
    throw new Error("[SABOROU] Slack input field not found");
  }

  input.focus();

  // Stage 1: execCommand（deprecated だが現時点で最も確実）
  // Document.execCommand は deprecated だが Chrome content script では動作する
  const docWithExecCommand = doc as Record<string, unknown>;
  const execCommandResult =
    typeof docWithExecCommand.execCommand === "function"
      ? (
          docWithExecCommand.execCommand as (
            cmd: string,
            ui: boolean,
            value: string,
          ) => boolean
        )("insertText", false, text)
      : false;

  if (!execCommandResult) {
    // Stage 2: InputEvent dispatch（execCommand が失敗した場合のフォールバック）
    // React の合成イベントシステムに対応するため nativeInputValueSetter を使う
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "innerText",
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, text);
    } else {
      input.innerText = text;
    }

    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        data: text,
        inputType: "insertText",
      }),
    );
  }
}

/**
 * Slack の送信ボタンをクリックして送信する
 *
 * @param doc document（テスト用に差し替え可能）
 */
export function clickSendButton(doc: Document = document): void {
  // スレッド内送信ボタンを優先
  const sendBtn =
    doc.querySelector<HTMLElement>(THREAD_SEND_BUTTON) ??
    doc.querySelector<HTMLElement>(SEND_BUTTON);

  if (!sendBtn) {
    throw new Error("[SABOROU] Slack send button not found");
  }

  sendBtn.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }),
  );
}
