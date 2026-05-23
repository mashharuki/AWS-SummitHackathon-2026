/**
 * SlackClient — Slack Web API の薄いラッパー
 *
 * Bot Token (xoxb-) を受け取り、必要最小限の Slack API を呼び出す。
 * - conversationsHistory: チャンネルの過去メッセージを取得（遡及タスク化）
 * - postMessage: チャンネル/スレッドにメッセージを投稿（インタラクティブ返信）
 *
 * 設計:
 * - fetch + AbortController で 5 秒タイムアウト（Lambda タイムアウトとの整合）
 * - Slack API は HTTP 200 でも body の `ok:false` でエラーを返すため両方を検査
 * - レート制限 (429) はそのままエラーとして伝播（呼び出し側で必要なら扱う）
 */

const SLACK_API_BASE = "https://slack.com/api";
const DEFAULT_TIMEOUT_MS = 5000;

/** Slack のメッセージ要素（必要なフィールドのみ） */
export interface SlackHistoryMessage {
  type: string;
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  subtype?: string;
  bot_id?: string;
}

export interface ConversationsHistoryParams {
  channel: string;
  /** Unix epoch（秒）。これより新しいメッセージのみ取得 */
  oldest?: string;
  /** 取得件数の上限（Slack 既定 100、最大 1000） */
  limit?: number;
}

export interface PostMessageParams {
  channel: string;
  text: string;
  /** スレッド返信にする場合は親メッセージの ts を指定 */
  thread_ts?: string;
}

export class SlackApiError extends Error {
  constructor(
    public readonly slackError: string,
    public readonly method: string,
  ) {
    super(`Slack API ${method} failed: ${slackError}`);
    this.name = "SlackApiError";
  }
}

export class SlackClient {
  constructor(
    private readonly botToken: string,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  /**
   * チャンネルの過去メッセージを取得する。
   * 必要スコープ: channels:history / groups:history / im:history / mpim:history
   */
  async conversationsHistory(
    params: ConversationsHistoryParams,
  ): Promise<SlackHistoryMessage[]> {
    const body = new URLSearchParams({
      channel: params.channel,
      ...(params.oldest ? { oldest: params.oldest } : {}),
      limit: String(params.limit ?? 100),
    });

    const data = await this.call<{ messages?: SlackHistoryMessage[] }>(
      "conversations.history",
      body,
    );
    return data.messages ?? [];
  }

  /**
   * チャンネル/スレッドにメッセージを投稿する。
   * 必要スコープ: chat:write
   */
  async postMessage(params: PostMessageParams): Promise<{ ts: string }> {
    const body = new URLSearchParams({
      channel: params.channel,
      text: params.text,
      ...(params.thread_ts ? { thread_ts: params.thread_ts } : {}),
    });

    const data = await this.call<{ ts: string }>("chat.postMessage", body);
    return { ts: data.ts };
  }

  /** Slack Web API を呼び出し、ok:false / タイムアウトをエラー化する */
  private async call<T>(
    method: string,
    body: URLSearchParams,
  ): Promise<T & { ok: boolean }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${SLACK_API_BASE}/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new SlackApiError(`http_${res.status}`, method);
      }

      const data = (await res.json()) as T & { ok: boolean; error?: string };
      if (!data.ok) {
        throw new SlackApiError(data.error ?? "unknown_error", method);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }
}
