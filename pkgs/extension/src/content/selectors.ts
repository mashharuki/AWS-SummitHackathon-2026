/**
 * selectors.ts — Slack DOM セレクター集約ファイル
 *
 * Slack の DOM 構造は随時変更される可能性があるため、
 * セレクター定数をこのファイルに集約し、変更時の修正範囲を最小化する。
 *
 * 優先度順:
 * 1. data-qa 属性（アクセシビリティ属性。Slack が公式に維持している可能性が高い）
 * 2. aria 属性
 * 3. class 名（最後の手段。変更頻度が高い）
 */

// ---------------------------------------------------------------------------
// メッセージ検知用セレクター
// ---------------------------------------------------------------------------

/** メッセージコンテナ（個々のメッセージ要素） */
export const MESSAGE_CONTAINER = '[data-qa="message_container"]';

/** メッセージアクションバー（メッセージに対するアクションの親） */
export const MESSAGE_ACTION_BAR = '[data-qa="message_action_bar"]';

/** メッセージのスレッド表示ボタン */
export const REPLY_BUTTON = '[data-qa="reply_in_thread_button"]';

// ---------------------------------------------------------------------------
// 自分宛て判定用セレクター
// ---------------------------------------------------------------------------

/**
 * @mention（自分宛てメンション）の表示要素
 * Slack は @mention を span で強調表示する。
 * Slack UI バージョンにより属性・クラス名が異なるため複数フォールバックを用意する。
 * - data-stringify-type="mention": 従来の属性ベース（最も安定）
 * - .c-mrkdwn__mention: 新しい Slack UI のクラスベース（data-stringify-type と併用）
 */
export const MENTION_SPAN =
  '[data-stringify-type="mention"], .c-mrkdwn__mention';

/**
 * メッセージ要素が持つチャンネル ID 属性（最も確実な channelId 取得元）
 * 実機確認: <div data-qa="message_container" data-msg-channel-id="C0B5TS01TMJ" ...>
 */
export const DATA_MSG_CHANNEL_ID_ATTR = "data-msg-channel-id";

/**
 * メッセージ要素が持つタイムスタンプ属性（最も確実な ts 取得元）
 * 実機確認: <div data-qa="message_container" data-msg-ts="1781155988.869619" ...>
 */
export const DATA_MSG_TS_ATTR = "data-msg-ts";

/**
 * DM チャンネルの URL パターン。
 * 実機の Slack URL は /client/<teamId>/<channelId> 形式。
 * DM は channelId が D で始まる（例: /client/T0B5HSJ85RR/D01ABCDEFGH）。
 */
export const DM_URL_PATTERN = /\/client\/[A-Z0-9]+\/D[A-Z0-9]+/;

/**
 * パブリック/プライベートチャンネルの URL パターン。
 * channelId が C（公開）/ G（プライベート）で始まる。
 */
export const CHANNEL_URL_PATTERN = /\/client\/[A-Z0-9]+\/[CG][A-Z0-9]+/;

/**
 * Slack の「自分宛て DM」を示すページ上の要素
 * DM 一覧ページや特定の DM チャンネル内の識別に使う
 */
export const DM_CHANNEL_INDICATOR = '[data-qa="slack_kit_list"]';

// ---------------------------------------------------------------------------
// 送信者情報取得用セレクター
// ---------------------------------------------------------------------------

/**
 * メッセージ送信者名。
 * 実機の Slack はハイフン版 data-qa を使うことが多いため、
 * ハイフン版を優先しつつ複数の候補をカンマ区切りでフォールバックする。
 */
export const SENDER_NAME =
  '[data-qa="message_sender_name"], [data-qa="message_sender"], .c-message__sender_link, .c-message_kit__sender';

/** メッセージのタイムスタンプ（ts 取得に使用） */
export const MESSAGE_TIMESTAMP =
  'a[data-stringify-type="paragraph"] time, .c-timestamp';

/** メッセージ要素の data-ts 属性（タイムスタンプ）のキー */
export const DATA_TS_ATTR = "data-ts";

/**
 * メッセージのテキスト本文。
 * 実機確認: 本文は data-qa="message-text"（ハイフン）。
 * 旧アンダースコア版とリッチテキスト section も保険でフォールバック。
 */
export const MESSAGE_TEXT =
  '[data-qa="message-text"], [data-qa="message_text"], .p-rich_text_section';

// ---------------------------------------------------------------------------
// 自動入力用セレクター
// ---------------------------------------------------------------------------

/**
 * Slack メッセージ入力フィールド（ContentEditable）
 * スレッド返信の場合は別の入力フィールドが使われることがある
 */
export const MESSAGE_INPUT = '[data-qa="message_input"]';

/** スレッド内返信用の入力フィールド */
export const THREAD_MESSAGE_INPUT = '[data-qa="texty_input"]';

/** 送信ボタン */
export const SEND_BUTTON = '[data-qa="texty_send_button"]';

/** スレッド内送信ボタン（フォールバック） */
export const THREAD_SEND_BUTTON = '[data-qa="send_in_thread_button"]';

// ---------------------------------------------------------------------------
// チャンネル情報取得用セレクター
// ---------------------------------------------------------------------------

/**
 * 現在開いているチャンネルの ID を URL から取得する正規表現。
 * 実機 URL: /client/<teamId>/<channelId> の channelId 部分を取る。
 */
export const CHANNEL_ID_FROM_URL_REGEX = /\/client\/[A-Z0-9]+\/([A-Z0-9]+)/;
