# U-07: google-integration — コンポーネント設計

**バージョン**: 1.0.0
**作成日**: 2026-05-24

---

## 1. 新規ファイル一覧

### shared パッケージ（pkgs/shared/）

| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------|
| `src/types/enums.ts` | 変更 | `ServiceType` に `"google"` 追加、`SourceType` に `"gmail"` / `"calendar"` 追加 |
| `src/types/service-connection.ts` | 変更 | Google 専用フィールド 5つ追加 |
| `src/types/google-calendar-cache.ts` | 新規 | `GoogleCalendarCache` インタフェース定義 |
| `src/types/index.ts` | 変更 | `GoogleCalendarCache` を re-export |

### backend パッケージ（pkgs/backend/）

| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------|
| `src/utils/oauthState.ts` | 新規 | `signState` / `verifyState` を auth.ts から切り出して共有化 |
| `src/types/google.ts` | 新規 | Google API レスポンスの Zod スキーマ定義 |
| `src/services/GoogleTokenService.ts` | 新規 | アクセストークン取得・更新・in-memoryキャッシュ |
| `src/services/GoogleCalendarService.ts` | 新規 | Calendar API 呼び出し・busyScore 計算 |
| `src/services/GoogleGmailService.ts` | 新規 | Gmail API 呼び出し・メッセージ取得 |
| `src/repositories/DynamoGoogleCalendarCacheRepository.ts` | 新規 | GoogleCalendarCache の DynamoDB 実装 |
| `src/routes/auth.ts` | 変更 | `signState`/`verifyState` を oauthState.ts から import するよう修正 |
| `src/routes/google-auth.ts` | 新規 | `/api/auth/google` と `/api/auth/google/callback` |
| `src/routes/google.ts` | 新規 | `/api/google/calendar/*` と `/api/google/gmail/*` |
| `src/config/env.ts` | 変更 | `GOOGLE_CLIENT_SECRET_ARN` / `GOOGLE_CLIENT_ID` / `DYNAMODB_TABLE_GOOGLE_CALENDAR_CACHE` 追加 |
| `src/config/secrets.ts` | 変更 | `getGoogleClientSecret` / `getGoogleToken` 追加 |
| `src/index.ts` | 変更 | `google-auth.ts` と `google.ts` ルートをマウント |
| `src/routes/proposals.ts` | 変更 | GoogleCalendarCache を TaskContext に注入 |

### agent パッケージ（pkgs/agent/）

| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------|
| `src/sabori-proposer/types.ts` | 変更 | `CalendarContext` 追加、`TaskContext` に `calendarContext?` 追加 |
| `src/sabori-proposer/contextUtils.ts` | 変更 | `assembleContextNarrative()` に Calendar セクション追加、`derivePsychSignals()` に Calendar シグナル追加 |
| `src/sabori-proposer/saboriJudgmentTool.ts` | 変更 | Tool スキーマの `nearestMeetingMinutes` / `calendarBusyScore` フィールド追加 |

### cdk パッケージ（pkgs/cdk/）

| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------|
| `lib/stacks/data-stack.ts` | 変更 | GoogleCalendarCacheTable・GoogleClientSecret 追加 |
| `lib/stacks/api-stack.ts` | 変更 | 環境変数追加・IAM権限追加 |
| `test/data-stack.test.ts` | 変更 | GoogleCalendarCacheTable・GoogleClientSecret テスト追加 |
| `test/api-stack.test.ts` | 変更 | Google関連環境変数・IAM権限テスト追加 |

### frontend パッケージ（pkgs/frontend/）

| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------|
| `src/pages/SettingsPage.tsx` | 変更 | Google連携セクション追加（OAuthボタン・Calendar取り込みボタン・Gmail取り込みボタン） |
| `src/services/googleService.ts` | 新規 | `/api/auth/google` / `/api/google/calendar/fetch` / `/api/google/gmail/fetch` の fetch ラッパー |
| `src/pages/TaskDetailPage.tsx` | 変更 | `calendarContext` 表示（鮮度・多忙度スコア）追加 |

---

## 2. APIエンドポイント詳細設計

### GET /api/auth/google

**役割**: Google OAuth 認可URL を生成して返す

**認証**: JWT（Cognito）必須

**レスポンス**:
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&scope=...&state=..."
}
```

**フロントエンドの処理**:
```javascript
const { url } = await googleService.startOAuth();
window.location.href = url;
```

---

### GET /api/auth/google/callback

**役割**: Google からのコールバック処理・トークン交換・DynamoDB保存

**認証**: なし（Google からのリダイレクト）

**クエリパラメータ**: `code`, `state`, `error?`

**処理フロー**:
```
1. error パラメータ確認（OAuth 拒否の場合は FRONTEND_URL/settings?google=error にリダイレクト）
2. state の HMAC 検証（失敗時 400）
3. code → トークン交換（POST https://oauth2.googleapis.com/token）
4. Secrets Manager に { refreshToken, accessToken, expiresAt } を保存
5. ServiceConnections に CONN#google を upsert
6. FRONTEND_URL/settings?google=connected にリダイレクト
```

**DynamoDB 保存内容**:
```typescript
{
  PK: `USER#${userId}`,
  SK: "CONN#google",
  service: "google",
  status: "connected",
  secretArn: googleTokenSecretArn,  // saborou/google-token/<userId>
  googleScopes: "gmail.readonly,calendar.readonly",
  googleAccessTokenExpiresAt: expiresAt.toISOString(),
  connectedAt: toIsoString(new Date()),
  expiresAt: null,  // refreshToken に有効期限なし
}
```

---

### DELETE /api/auth/google

**役割**: Google 連携解除

**認証**: JWT 必須

**処理フロー**:
```
1. ServiceConnections の CONN#google を status=disconnected に更新
2. Secrets Manager の saborou/google-token/<userId> を ForceDeleteWithoutRecovery（dev のみ）
   prod は 30日後削除（コスト意識）
3. GoogleCalendarCache の USER#<userId> / CACHE#calendar を削除
4. 200 OK を返す
```

---

### POST /api/google/calendar/fetch

**役割**: Calendar 手動取り込み

**認証**: JWT 必須

**リクエストボディ**: なし

**レスポンス**:
```json
{
  "fetchedAt": "2026-05-24T10:00:00.000Z",
  "upcomingEventCount": 3,
  "nextEventStartsInMinutes": 45,
  "freeSlotMinutesToday": 180,
  "busyScore": 0.4
}
```

**エラーケース**:
```json
{ "error": { "code": "GOOGLE_NOT_CONNECTED", "message": "Google連携が必要です" } }
{ "error": { "code": "TOKEN_REFRESH_FAILED", "message": "Googleアカウントの再連携が必要です" } }
```

---

### GET /api/google/calendar/status

**役割**: Calendar キャッシュの現在状態確認

**認証**: JWT 必須

**レスポンス（キャッシュあり）**:
```json
{
  "connected": true,
  "cache": {
    "fetchedAt": "2026-05-24T08:00:00.000Z",
    "upcomingEventCount": 3,
    "busyScore": 0.4,
    "isStale": false
  }
}
```

**レスポンス（未連携）**:
```json
{ "connected": false, "cache": null }
```

---

### POST /api/google/gmail/fetch

**役割**: Gmail 手動取り込み → TaskCandidate 生成

**認証**: JWT 必須

**リクエストボディ（オプション）**:
```json
{ "daysBack": 7 }  // 省略時は 7
```

**レスポンス**:
```json
{
  "fetchedAt": "2026-05-24T10:00:00.000Z",
  "scannedCount": 23,
  "extractedCount": 4,
  "candidates": [
    {
      "id": "01HXXX...",
      "title": "○○の件について確認お願いします",
      "sourceType": "gmail"
    }
  ]
}
```

---

## 3. Tool Use スキーマ拡張（saboriJudgmentTool.ts）

Calendar コンテキストが注入された場合の判定精度向上のため、
`sabori_judgment` ツールスキーマに Calendar 関連フィールドを追加する。

```javascript
// saboriJudgmentTool.ts の properties に追加
calendarBusyScore: {
  type: "number",
  description: [
    "Googleカレンダーの多忙度（0.0–1.0）。",
    "0.7以上: 予定が詰まっており、サボれる時間的余裕が少ない",
    "0.3以下: 予定が少なく、サボりやすい状況",
    "null: カレンダー情報なし",
  ].join("\n"),
  nullable: true,
},
nearestMeetingMinutes: {
  type: "number",
  description: [
    "次の予定開始まで何分か。",
    "30分以内: 会議直前のため must_do 寄りに判定すべき",
    "null: 予定なし または カレンダー情報なし",
  ].join("\n"),
  nullable: true,
},
```

**注意**: これらは LLMJudgment の `reasoning` 生成に影響するが、
`verdict` の決定は依然として LLM が行う（ルールベース強制なし）。

---

## 4. フロントエンド UI 設計

### SettingsPage — Google 連携セクション

```
[ Google 連携 ]

┌────────────────────────────────────────────┐
│  Google アカウント                           │
│  mameta@gmail.com（連携済み）                │
│                                            │
│  [📅 カレンダーを取り込む]                    │
│  最終取得: 2時間前（予定3件・多忙度: 中）     │
│                                            │
│  [📧 Gmail を取り込む（直近7日）]            │
│  最終取得: 昨日 15:30（4件のタスクを検出）    │
│                                            │
│                        [連携を解除]        │
└────────────────────────────────────────────┘
```

未連携の場合:
```
┌────────────────────────────────────────────┐
│  Google 連携                                │
│  Gmail とカレンダーを連携して、              │
│  サボれるタイミングをより正確に判定します。  │
│                                            │
│         [Google アカウントを連携する]        │
└────────────────────────────────────────────┘
```

### TaskDetailPage — Calendar コンテキスト表示

既存の ContextSignals（psychSignals）表示エリアに Calendar 情報を追加する:

```
[ 判定の根拠 ]
  - Slack: 依頼者がオフライン（サボりやすい）
  - 締切: 明日 17:00（余裕あり）
  - 📅 カレンダー: 次の予定まで 2時間・多忙度 低（取得: 30分前）
```
