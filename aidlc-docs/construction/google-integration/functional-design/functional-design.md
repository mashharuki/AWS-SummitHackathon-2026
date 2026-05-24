# U-07: google-integration — Functional Design

**バージョン**: 1.1.0
**作成日**: 2026-05-24
**更新日**: 2026-05-24（整合性検証による差分反映）
**フェーズ**: CONSTRUCTION — Functional Design
**ユニット**: google-integration（U-07a: OAuth基盤 + U-07b: Calendar/Gmail/判定連携）

---

## 1. ユニット概要

Google OAuth 連携（Gmail + Google Calendar）をSABOROUに追加する。
既存の Slack OAuth フローを完全踏襲しつつ、Google 特有の要素
（refreshToken管理・トークン有効期限1h・Calendar/Gmailデータキャッシュ）を追加する。

**Unit 分割**:
- **U-07a（OAuth基盤）**: Google OAuth フロー・トークン管理・CDK基盤・フロントエンド連携ボタン
- **U-07b（Calendar/Gmail/判定連携）**: Calendar/Gmail取り込み・TaskExtractor汎用化・SaboriProposer Calendar注入

### 1.1 実装する機能

| 機能 | Unit | 説明 |
|------|------|------|
| Google OAuth 基盤 | U-07a | OAuth 2.0 フロー・トークン交換・Secrets Manager 保管（JSON形式） |
| Google連携ボタン（フロントエンド） | U-07a | 設定画面に連携・解除ボタン追加（Slack連携ボタンパターン踏襲） |
| CDK基盤 | U-07a | GoogleClientSecret・GoogleCalendarCacheTable・IAM権限・ForceDelete |
| Calendar 手動取り込み | U-07b | ユーザーが「取り込む」ボタン押下時に予定データを取得・キャッシュ |
| Gmail 手動取り込み | U-07b | ユーザーが「Gmailを取り込む」ボタン押下時に直近7日のメールをスキャン・タスク候補化 |
| TaskExtractor 汎用化 | U-07b | `extractTask` をSlack専用から汎用入力対応に変更（既存テスト非破壊） |
| SaboriProposer Calendar連携 | U-07b | キャッシュ済みCalendarデータを取り込みサボり判定の精度向上 |

### 1.2 整合性検証で判明した修正事項（v1.0.0からの変更点）

> **差分1（最重要）: TaskExtractor 汎用化が必要（U-07b に含める）**
>
> 旧設計「TaskExtractor は sourceType="gmail" でそのまま呼び出し可能（既存ロジック変更最小）」は**誤り**。
> 実装 `TaskExtractorAgent.extractTask(event: SlackEventPayload)` は Slack 専用:
> - 引数が `SlackEventPayload` 型固定
> - `sourceType: SOURCE_TYPE.SLACK` ハードコード
> - `sourceRef: messageTs`（Slack ts専用）
> - プロンプトが `<slack_message>` タグ固定
>
> Gmail 対応には **`extractTask` の汎用化リファクタ** が必要。
> 具体的には `sourceType` と汎用入力テキスト・`sourceRef` を受け取れる形に変更する。
> Slack 呼び出し側の後方互換と既存32テストの非破壊を必ず維持する。
> この作業は **U-07b** に含める。

> **差分2: SOURCE_TYPE / SERVICE_TYPE 定数オブジェクトも更新が必要**
>
> `pkgs/shared/src/constants/index.ts` の `SOURCE_TYPE` と `SERVICE_TYPE` 定数オブジェクトにも
> `GMAIL` / `CALENDAR` / `GOOGLE` を追加する（`enums.ts` の型定義だけでなく**両方**更新）。

> **差分3: Google token は JSON 保存（Slack は平文）**
>
> Slack Bot Token は Secrets Manager に**平文文字列**で保存。
> Google は `refreshToken` / `accessToken` / `expiresAt` など複数値が必要なので
> **JSON 形式**で保存する。保存スキーマ（下記）を設計に明記する:
> ```json
> {
>   "refreshToken": "1//xxx...",
>   "accessToken": "ya29.xxx...",
>   "expiresAt": "2026-05-24T11:00:00.000Z",
>   "scope": "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly"
> }
> ```

> **差分4: redirect_uri は自己URL から動的生成**
>
> `auth.ts` の Slack コールバックでは `redirect_uri` を
> `c.req.url.replace("/auth/slack", "/auth/slack/callback")` で動的生成している。
> Google 版も同方式を採用し設計に明記する。

> **差分5: ForceDelete カスタムリソースが必要**
>
> `data-stack.ts` は Slack Secret に対し destroy 時の **ForceDelete カスタムリソース**を実装済み。
> Google client secret にも同パターンを実装する（`/saborou/google/client-secret-${environment}`）。
> api-stack の権限付与パターン（`saborou/slack-bot-token/*`）に倣い
> `saborou/google-token/*` を追加する。

> **差分6: sourceRef の値を明記**
>
> TaskCandidate.sourceRef: Slack は `messageTs`、Gmail では `messageId` を入れる。

---

## 2. データモデル定義

### 2.1 shared/types/enums.ts 追加

```typescript
// ServiceType に "google" を追加
export type ServiceType = "slack" | "google";

// SourceType に "gmail" / "calendar" を追加
export type SourceType = "slack" | "manual" | "gmail" | "calendar";
```

### 2.2 ServiceConnection 型拡張（shared/types/service-connection.ts）

既存 `ServiceConnection` に Google 専用フィールドを追加する。
Slack 専用フィールド（slackUserId等）と同様に、Google 連携時のみ存在する。

```typescript
export interface ServiceConnection {
  // 既存フィールド（変更なし）
  PK: string;
  SK: string;
  service: ServiceType;
  status: ConnectionStatus;
  secretArn: string;            // refreshToken 保管 ARN（Google の場合）
  slackUserId?: string;
  slackTeamId?: string;
  slackLookupKey?: string;
  connectedAt: string;
  expiresAt: string | null;

  // ---- Google 専用フィールド（追加） ----
  /** Google OAuth で付与されたスコープ（カンマ区切り） */
  googleScopes?: string;
  /** アクセストークンの有効期限（ISO 8601）。refreshToken で更新する */
  googleAccessTokenExpiresAt?: string;
  /** Google Calendar キャッシュの最終取得時刻（ISO 8601） */
  calendarLastFetchedAt?: string;
  /** Gmail キャッシュの最終取得時刻（ISO 8601） */
  gmailLastFetchedAt?: string;
}
```

### 2.3 新テーブル: GoogleCalendarCache（DynamoDB）

Calendar 手動取り込みで取得した「加工済み予定メタデータ」を保管する。
raw（予定タイトル・説明）は永続化しない（PII保護・TaskExtractorのraw破棄パターン踏襲）。

**DynamoDB キー設計**:
- PK: `USER#<cognitoSub>`
- SK: `CACHE#calendar`（ユーザーあたり1レコード・都度上書き）

| 属性 | 型 | 説明 |
|------|-----|------|
| PK | String | `USER#<cognitoSub>` |
| SK | String | `CACHE#calendar` |
| userId | String | cognitoSub（GSI用） |
| fetchedAt | String | ISO 8601 キャッシュ取得日時 |
| upcomingEventCount | Number | 直近24h以内の予定数 |
| nextEventStartsInMinutes | Number | 次の予定開始まで（分）。予定なし=null |
| freeSlotMinutesToday | Number | 今日の空き時間（分）推定値 |
| busyScore | Number | 多忙度スコア 0.0–1.0（ヒューリスティック） |
| ttl | Number | TTL（Unix timestamp、24h後に自動削除） |

**busyScore 計算ヒューリスティック**:
```
busyScore = min(1.0, (upcomingEventCount * 0.3) + (nextEventStartsInMinutes < 30 ? 0.4 : 0))
```

---

## 3. ビジネスロジック定義

### 3.1 BR-G-01: Google OAuth フロー

**Slack OAuth との完全整合**

```
1. GET /api/auth/google
   - authMiddleware（Cognito JWT）で userId 解決
   - GOOGLE_CLIENT_ID（SSM）+ state（HMAC-SHA256署名）を生成
   - JSON { url: "https://accounts.google.com/o/oauth2/v2/auth?..." } を返す

2. フロントエンド: url へ window.location.href でリダイレクト

3. GET /api/auth/google/callback?code=xxx&state=xxx
   - stateパラメータのHMAC検証（CSRF対策）
   - code → { access_token, refresh_token, expires_in, scope } 交換
   - refreshToken を Secrets Manager に保存（secretName: saborou/google-token/<userId>）
   - ServiceConnections DynamoDB に CONN#google レコードを upsert
   - FRONTEND_URL/settings?google=connected へリダイレクト
```

**重要**: Google は `access_type=offline` かつ `prompt=consent` をつけないと
refreshToken を返さない。初回のみ refreshToken が返るため、再連携時は UpdateSecret。

### 3.2 BR-G-02: アクセストークン更新（予防的 + フォールバック）

Google アクセストークンは発行後 3600秒（1h）で失効する。
以下の2段構えでリフレッシュする。

```
[予防的更新]
- API呼び出し前に googleAccessTokenExpiresAt を確認
- 現在時刻 + 5分 > expiresAt の場合 → refreshAccessToken() を実行

[フォールバック更新]
- Google API が 401/403 を返した場合 → refreshAccessToken() を実行してリトライ（1回のみ）
- リトライ後も失敗 → ConnectionStatus を "token_expired" に更新し、エラーを返す
```

**refreshAccessToken() 処理**:
1. Secrets Manager から refreshToken を取得（SecretsManagerキャッシュ5min）
2. Google Token Endpoint に POST（grant_type=refresh_token）
3. 新 access_token を in-memory キャッシュに保存（Lambda ウォーム時再利用）
4. ServiceConnections の googleAccessTokenExpiresAt を更新

### 3.3 BR-G-03: Calendar 手動取り込み

**トリガー**: POST /api/google/calendar/fetch（認証必須）

```
1. ServiceConnections から CONN#google を取得し status=connected を確認
2. BR-G-02 によりアクセストークンを有効状態に保証
3. Google Calendar API v3 events.list を呼び出す
   - timeMin: 現在時刻（UTC）
   - timeMax: 現在時刻 + 24h（UTC）
   - maxResults: 20
   - singleEvents: true, orderBy: startTime
4. 取得した予定リストから busyScore を計算（タイトル・説明は保存しない）
5. GoogleCalendarCache に upsert（TTL=24h）
6. { fetchedAt, upcomingEventCount, nextEventStartsInMinutes, busyScore } を返す
```

### 3.4 BR-G-04: Gmail 手動取り込み → TaskCandidate 生成

**トリガー**: POST /api/google/gmail/fetch（認証必須）

```
1. ServiceConnections から CONN#google を取得し status=connected を確認
2. BR-G-02 によりアクセストークンを有効状態に保証
3. Gmail API messages.list を呼び出す
   - q: "newer_than:7d is:unread" (直近7日・未読)
   - maxResults: 50
4. messages.get でヘッダー（Subject, From, Date）+ snippet を取得
5. TaskExtractorAgent に渡す（件名+送信者+snippet を入力テキストに変換）
6. タスク候補として抽出されたもののみ TaskCandidates テーブルに保存
   - sourceType: "gmail"
   - rawメール本文（body）は永続化しない（snippet のみ使用後破棄）
7. 抽出件数と候補一覧を返す
```

### 3.5 BR-G-05: SaboriProposer への Calendar コンテキスト注入

**設計方針**: リアルタイムに Calendar API を呼ぶのではなく、
キャッシュ済み GoogleCalendarCache を読み込んで判定に使う。
（手動起点取り込みとサボり判定タイミングの整合のため）

```
1. SaboriProposerAgent.propose() 呼び出し前に GoogleCalendarCache を確認
2. キャッシュが存在し fetchedAt から 24h 以内の場合 → calendarContext として注入
3. キャッシュが存在しない or 24h 超過の場合 → calendarContext = undefined（影響なし）
4. フロントエンドには「最終カレンダー取得: ○○分前」を表示
```

**CalendarContext 型**（agent/sabori-proposer/types.ts に追加）:

```typescript
export interface CalendarContext {
  upcomingEventCount: number;
  nextEventStartsInMinutes: number | null;
  freeSlotMinutesToday: number;
  busyScore: number;           // 0.0–1.0
  fetchedAt: string;           // ISO 8601（鮮度表示用）
}
```

**TaskContext 型拡張**（agent/sabori-proposer/types.ts）:

```typescript
export interface TaskContext {
  task: Task;
  slackContext?: SlackContext;
  calendarContext?: CalendarContext;  // 追加
}
```

### 3.6 BR-G-06: Calendar コンテキストのナラティブ生成

contextUtils.ts の `assembleContextNarrative()` に calendarContext セクションを追加する。

```
## Googleカレンダーの状況
- 直近24時間の予定数: <upcomingEventCount>件
- 次の予定まで: <nextEventStartsInMinutes>分 / 予定なし
- 今日の推定空き時間: <freeSlotMinutesToday>分
- 多忙度スコア: <busyScore>（0=余裕 / 1=超多忙）
- データ取得: <fetchedAt> （○○分前）
```

**心理学的シグナル拡張**（derivePsychSignals）:

```
[Calendar ベースの新シグナル]
- calendarBusyness: busyScore >= 0.7 → "high" / busyScore <= 0.3 → "low"
- nextMeetingPressure: nextEventStartsInMinutes < 30 → "high"（会議前はサボれない）
```

---

## 4. エンドポイント定義

| メソッド | パス | 認証 | 説明 |
|---------|------|------|------|
| GET | /api/auth/google | JWT | Google OAuth 認可URL生成 |
| GET | /api/auth/google/callback | なし | OAuthコールバック・トークン交換 |
| DELETE | /api/auth/google | JWT | Google連携解除 |
| POST | /api/google/calendar/fetch | JWT | Calendar 手動取り込み |
| GET | /api/google/calendar/status | JWT | Calendarキャッシュ状態確認 |
| POST | /api/google/gmail/fetch | JWT | Gmail 手動取り込み |

---

## 5. コンポーネント依存関係

```
frontend
  └── settings.ts (Google連携ボタン)
        └── GET /api/auth/google → window.location.href
  └── settings/calendar-section.tsx (取り込みボタン + 最終取得時刻)
        └── POST /api/google/calendar/fetch
  └── settings/gmail-section.tsx (取り込みボタン + 取り込み件数)
        └── POST /api/google/gmail/fetch

backend (routes)
  └── auth.ts → GoogleOAuthFlowを追加（Slack踏襲）
  └── google.ts → Calendar/Gmail取り込みルート
  └── proposals.ts → GoogleCalendarCacheをTaskContextに注入（既存変更）

agent
  └── task-extractor/TaskExtractorAgent.ts → sourceType="gmail"対応（既存変更）
  └── sabori-proposer/SaboriProposerAgent.ts → calendarContext受け取り（既存変更）
  └── sabori-proposer/contextUtils.ts → Calendar用ナラティブ追加（既存変更）
  └── sabori-proposer/saboriJudgmentTool.ts → Calendarシグナル追加（既存変更）

shared
  └── types/enums.ts → ServiceType/SourceType拡張
  └── types/service-connection.ts → Google専用フィールド追加

cdk
  └── data-stack.ts → Google client secret / GoogleCalendarCacheテーブル追加
  └── api-stack.ts → Google token read/write/create権限追加・環境変数追加
```

---

## 6. 既存設計との整合性確認

| 整合性ポイント | 対応方針 | 状態 |
|--------------|---------|------|
| Slack OAuthフロー踏襲 | signState/verifyState を共有ユーティリティ（`utils/oauthState.ts`）に切り出し。JSON返却・フロントリダイレクト・Secrets Manager保存も同パターン | ✅ 確認済み |
| redirect_uri 動的生成 | `c.req.url` から自己URLを動的生成（Slack実装と同方式） | ✅ 差分4確認済み |
| Googleトークン JSON保存 | `{ refreshToken, accessToken, expiresAt, scope }` を JSON で Secrets Manager に保存（Slack平文との差異を明記） | ✅ 差分3確認済み |
| ForceDelete カスタムリソース | Slack Secret と同パターンで dev環境では destroy 時に即時削除 | ✅ 差分5確認済み |
| raw破棄パターン | Gmailは件名+snippet使用後破棄、Calendarは予定タイトル不保存（busyScore等のみ） | ✅ 確認済み |
| TaskExtractor 汎用化（U-07b） | ~~sourceType="gmail"でそのまま呼び出し可能~~ → **汎用化リファクタが必要**（差分1参照） | 修正済み・U-07bに含める |
| sourceRef の値 | Slack: `messageTs`、Gmail: `messageId` | ✅ 差分6確認済み |
| SOURCE_TYPE / SERVICE_TYPE 定数 | `constants/index.ts` の定数オブジェクトも型定義と合わせて両方更新 | ✅ 差分2確認済み |
| SaboriProposer CalendarContext | TaskContext拡張・optional追加のため既存テスト非破壊 | ✅ 確認済み |
| ConnectionStatus 型 | 既に `"connected" \| "disconnected" \| "token_expired"` 有 → BR-G-02 はそのまま使用可 | ✅ 確認済み |
| キャッシュ整合 | 手動取り込みのみ更新。判定時はキャッシュのみ参照（リアルタイム呼び出しなし） | ✅ 確認済み |
| TTL24h | 「昨日取り込んだカレンダー情報で今日の判定」は可。鮮度表示で透明化 | ✅ 確認済み |

---

## 7. 技術スタック（追加分のみ）

| 用途 | 選択 | 理由 |
|------|------|------|
| Google OAuth | OAuth 2.0（Authorization Code + offline access） | 標準。refreshToken取得に必須 |
| Google API クライアント | fetch（直接呼び出し） | SDK不要。@google-api/nodejs-clientは重い |
| Calendar取り込み | Google Calendar API v3 /events | 公式 |
| Gmail取り込み | Gmail API v1 /messages | 公式 |
| アクセストークンキャッシュ | Lambda in-memory変数（Map） | ウォーム時再利用。Slack ClientのMapキャッシュパターン踏襲 |
| Calendarキャッシュ永続化 | DynamoDB（TTL=24h） | 既存テーブル設計と整合 |
