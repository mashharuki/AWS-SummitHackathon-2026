# U-07: google-integration — NFR Design

**バージョン**: 1.0.0
**作成日**: 2026-05-24

---

## DP-G-01: Slack OAuth 踏襲パターン（整合性最優先）

**対応NFR**: NFR-G-S2

既存の `auth.ts` が実装する Slack OAuth フローと完全同一の構造で Google OAuth を実装する。
関数・フロー・エラーレスポンス形式を統一し、メンテナンス負荷を最小化する。

```typescript
// 既存: signState / verifyState は auth.ts からモジュールとして切り出し、
// GoogleAuth と SlackAuth の両方が import して再利用する。
// ファイル: backend/src/utils/oauthState.ts（新規）

export function signState(payload: string, secret: string): string { ... }
export function verifyState(stateParam: string, secret: string): { userId: string } | null { ... }
```

**Google 固有の追加パラメータ**:
```typescript
const params = new URLSearchParams({
  client_id: googleClientId,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: GOOGLE_OAUTH_SCOPES,
  state,
  access_type: "offline",   // refreshToken を取得するために必須
  prompt: "consent",        // 再連携でも必ず refreshToken を返させる
});
```

---

## DP-G-02: Google トークン Secrets Manager 保管スキーム

**対応NFR**: NFR-G-S1

Slack Bot Token（`saborou/slack-bot-token/<userId>`）と同一命名規則で Google トークンを保管する。

```
シークレット名: saborou/google-token/<userId>
内容 (JSON):
{
  "refreshToken": "<Google refresh token>",
  "accessToken": "<現在のアクセストークン>",
  "expiresAt": "<ISO 8601>"
}
```

**CDK IAM 権限（api-stack.ts に追加）**:
```typescript
// per-user Google Token の読み書き
honoFn.addToRolePolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    "secretsmanager:GetSecretValue",
    "secretsmanager:PutSecretValue",
    "secretsmanager:UpdateSecret",
    "secretsmanager:DescribeSecret",
  ],
  resources: [
    `arn:aws:secretsmanager:${this.region}:${this.account}:secret:saborou/google-token/*`,
  ],
}));
// 初回 CreateSecret（Slack と同様 * リソース）
honoFn.addToRolePolicy(new iam.PolicyStatement({
  actions: ["secretsmanager:CreateSecret"],
  resources: ["*"],
}));
```

---

## DP-G-03: アクセストークン予防的更新 + フォールバック

**対応NFR**: NFR-G-P1, NFR-G-R1

```typescript
// backend/src/services/GoogleTokenService.ts（新規）

class GoogleTokenService {
  // Lambda インスタンス内で accessToken を in-memory キャッシュ
  private static tokenCache = new Map<string, { accessToken: string; expiresAt: Date }>();

  async getValidAccessToken(userId: string): Promise<string> {
    const cached = GoogleTokenService.tokenCache.get(userId);
    const now = new Date();
    const BUFFER_MS = 5 * 60 * 1000; // 5分前に更新

    // キャッシュが有効ならそのまま使用
    if (cached && cached.expiresAt.getTime() - BUFFER_MS > now.getTime()) {
      return cached.accessToken;
    }

    // refreshToken でアクセストークンを更新
    return this.refreshAccessToken(userId);
  }

  async callGoogleApiWithRetry<T>(
    userId: string,
    apiFn: (accessToken: string) => Promise<T>
  ): Promise<T> {
    const accessToken = await this.getValidAccessToken(userId);
    try {
      return await apiFn(accessToken);
    } catch (err) {
      if (isAuthError(err)) {
        // フォールバック: トークンリフレッシュ → 1回リトライ
        const newToken = await this.refreshAccessToken(userId);
        return await apiFn(newToken);
      }
      throw err;
    }
  }
}
```

---

## DP-G-04: Zod バリデーション（Google API レスポンス）

**対応NFR**: NFR-G-R1

Google API レスポンスの型安全性を Zod で保証する（TaskExtractor の DP-03 パターン踏襲）。

```typescript
// backend/src/types/google.ts（新規）
import { z } from "zod";

export const GoogleTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(), // 初回のみ返る
  expires_in: z.number(),
  token_type: z.string(),
  scope: z.string(),
});

export const CalendarEventSchema = z.object({
  id: z.string(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
  }),
  // summary(タイトル)は取得するが永続化しない
});

export const GmailMessageHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});
```

---

## DP-G-05: raw データ破棄パターン（PII保護）

**対応NFR**: NFR-G-S3（スコープ最小化と連携）

TaskExtractor の「生データ即時破棄（DP-04）」を Google 連携でも適用する。

```
Gmail取り込みフロー:
  1. messages.get で { subject, from, date, snippet } を取得（本文全体は取得しない）
  2. TaskExtractorAgent に渡すテキストを組み立てる:
     "件名: <subject>\n送信者: <from>\n概要: <snippet>"
  3. TaskExtractorAgent から候補を受け取る
  4. snippet および組み立てたテキストを変数から解放（GCに委ねる）
  5. TaskCandidate として title/description(候補化テキスト)のみ保存

Calendar取り込みフロー:
  1. events.list で { start, end, summary, status } を取得
  2. busyScore 計算に使用（summary は使用しない）
  3. { upcomingEventCount, nextEventStartsInMinutes, freeSlotMinutesToday, busyScore } のみ保存
  4. 予定タイトル・説明は破棄
```

---

## DP-G-06: SecretsManager キャッシュ（既存パターン踏襲）

**対応NFR**: NFR-G-P1

既存 `secrets.ts`（`getSlackClientSecret`）の5分キャッシュパターンを Google トークンにも適用する。
refreshToken の取得は「初回のみ SM 呼び出し、以降はin-memoryキャッシュ」。

```typescript
// backend/src/config/secrets.ts に追加
let googleTokenCache: { value: GoogleTokenSecretValue; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getGoogleToken(userId: string): Promise<GoogleTokenSecretValue> {
  const now = Date.now();
  if (googleTokenCache && now - googleTokenCache.fetchedAt < CACHE_TTL_MS) {
    return googleTokenCache.value;
  }
  // SM から取得してキャッシュ
  ...
}
```

---

## DP-G-07: GoogleCalendarCache の upsert 設計

**対応NFR**: NFR-G-R2

Calendar データキャッシュは「ユーザーあたり1レコード・PutItem 上書き」で管理する。
複数の取り込みで履歴が蓄積せず、常に最新のキャッシュのみが存在する。

```typescript
// DynamoDB PutItem（条件なし・無条件上書き）
const item = {
  PK: `USER#${userId}`,
  SK: "CACHE#calendar",
  userId,
  fetchedAt: toIsoString(new Date()),
  upcomingEventCount,
  nextEventStartsInMinutes,
  freeSlotMinutesToday,
  busyScore,
  ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h後にTTL自動削除
};
```

---

## DP-G-08: 構造化ログ（PII非含有）

**対応NFR**: NFR-G-O1

既存 `utils/logger.ts` の `logInfo/logError` パターンを使用する。

```typescript
// Calendar 取り込み完了ログ
logInfo("calendar_fetch_completed", {
  userId: userId.slice(0, 8) + "...", // userId は pseudonymize
  eventCount: upcomingEventCount,
  busyScore,
  nextEventStartsInMinutes,
});

// Gmail 取り込み完了ログ
logInfo("gmail_fetch_completed", {
  userId: userId.slice(0, 8) + "...",
  scannedCount: messages.length,
  extractedCount: candidates.length,
  scanWindowDays: 7,
});
```

---

## DP-G-09: GOOGLE_CLIENT_ID/SECRET の Secrets Manager 管理

**対応NFR**: NFR-G-S1（シークレットハードコード禁止）

```
Slack 連携と同一パターン:

data-stack.ts に追加:
- googleClientSecret（Secret名: /saborou/google/client-secret-<env>）
  内容: { "clientId": "...", "clientSecret": "..." }

api-stack.ts に追加:
- 環境変数 GOOGLE_CLIENT_SECRET_ARN → googleClientSecret.secretArn
- GOOGLE_CLIENT_ID → SSM Parameter Store /saborou/google/client-id から取得
- googleClientSecret.grantRead(honoFn)
```

---

## DP-G-10: フロントエンド キャッシュ鮮度表示

**対応NFR**: NFR-G-R2（鮮度の透明化）

Google Calendar ステータス取得エンドポイント（GET /api/google/calendar/status）から
`calendarLastFetchedAt` を取得し、設定画面に表示する。

```
表示例:
「カレンダー情報: 2時間前に取得（再取り込みして最新化）」
「カレンダー情報: 未取得（取り込むボタンを押してください）」
「カレンダー情報: 25時間前（期限切れ・要再取り込み）」
```

判定画面（TaskDetail）でも、もし calendarContext が古い場合に
「カレンダー情報が古い可能性があります（設定 > Google連携から再取り込み）」を表示する。
