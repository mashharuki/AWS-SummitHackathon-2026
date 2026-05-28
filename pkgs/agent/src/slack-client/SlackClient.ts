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

/** Bot が参加しているチャンネル（必要フィールドのみ） */
export interface SlackChannel {
  id: string;
  name: string;
  is_channel?: boolean;
  is_private?: boolean;
}

export interface PostMessageParams {
  channel: string;
  text: string;
  /** スレッド返信にする場合は親メッセージの ts を指定 */
  thread_ts?: string;
}

/**
 * users.info が返すユーザープロフィール（表示名解決に必要なフィールドのみ）。
 * Slack はフィールドが欠ける／空文字になることがあるため全て optional 扱い。
 */
export interface SlackUserProfile {
  id: string;
  /** ワークスペースのハンドル名（@... のもとになる） */
  name?: string;
  /** 本名（フルネーム） */
  real_name?: string;
  profile?: {
    /** ユーザーが設定した表示名（最優先で使いたい） */
    display_name?: string;
    real_name?: string;
  };
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
   * Bot が参加しているチャンネル一覧を取得する（users.conversations）。
   * 必要スコープ: channels:read 等（history 系で概ねカバー）。
   * UI のチャンネル選択ドロップダウン用。
   */
  async conversationsList(): Promise<SlackChannel[]> {
    const body = new URLSearchParams({
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
    });
    const data = await this.call<{ channels?: SlackChannel[] }>(
      "users.conversations",
      body,
    );
    return data.channels ?? [];
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

  /**
   * Slack ユーザー ID を表示名に解決する（users.info）。
   * 必要スコープ: users:read
   *
   * 優先順位: profile.display_name → real_name → profile.real_name → name。
   * いずれも空なら null を返す（呼び出し側で ID フォールバックする想定）。
   * API 失敗時は SlackApiError を投げるため、呼び出し側で catch して
   * タスク抽出自体は止めないこと。
   *
   * @param userId Slack の user ID（例: U12345678）
   */
  async usersInfo(userId: string): Promise<string | null> {
    const body = new URLSearchParams({ user: userId });
    const data = await this.call<{ user?: SlackUserProfile }>(
      "users.info",
      body,
    );

    const profile = data.user;
    if (!profile) {
      return null;
    }

    const displayName =
      profile.profile?.display_name?.trim() ||
      profile.real_name?.trim() ||
      profile.profile?.real_name?.trim() ||
      profile.name?.trim() ||
      "";

    return displayName.length > 0 ? displayName : null;
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
