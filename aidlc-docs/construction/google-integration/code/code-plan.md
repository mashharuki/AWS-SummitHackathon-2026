# U-07: google-integration — Code Generation Plan

**バージョン**: 1.1.0
**作成日**: 2026-05-24
**更新日**: 2026-05-24（整合性検証によるUnit分割・差分反映）
**ステータス**: U-07a 実装中

---

## Unit 分割と実装依存順序

```
U-07a（Google OAuth 基盤）
  ├── shared: enums + constants + types（Google専用フィールド）
  ├── backend: utils/oauthState.ts（切り出し）、GoogleTokenService、Google OAuth ルート
  ├── cdk: GoogleClientSecret + ForceDelete + IAM権限 + 環境変数
  └── frontend: 設定画面 Google 連携ボタン（OAuth 起動のみ）
       ↓ U-07a 完了・承認後に着手
U-07b（Calendar/Gmail/判定連携）
  ├── shared: google-calendar-cache 型 + SOURCE_TYPE.GMAIL/CALENDAR
  ├── backend: GoogleCalendarService + GoogleGmailService + repositories + google.ts ルート
  ├── agent: TaskExtractor 汎用化（重要リファクタ） + contextUtils + saboriJudgmentTool
  ├── cdk: GoogleCalendarCacheTable（U-07bで追加）
  └── frontend: 取り込みボタン + TaskDetailPage Calendar表示
```

---

## U-07a 実装チェックリスト

### Phase 1: shared パッケージ拡張（U-07a 分）
- [ ] `src/types/enums.ts`: `ServiceType` に `"google"` 追加、`SourceType` に `"gmail"` / `"calendar"` 追加
- [ ] `src/constants/index.ts`: `SERVICE_TYPE.GOOGLE` / `SOURCE_TYPE.GMAIL` / `SOURCE_TYPE.CALENDAR` 追加（差分2）
- [ ] `src/types/service-connection.ts`: Google 専用フィールド 5つ追加
- [ ] shared の全テストパス確認（103件継続）

### Phase 2: backend — oauthState 共有化 + Google OAuth
- [ ] `src/utils/oauthState.ts`: `signState` / `verifyState` を auth.ts から切り出し（差分4）
- [ ] `src/routes/auth.ts`: oauthState.ts を import するよう修正（動作変更なし・既存テスト非破壊）
- [ ] `src/types/google.ts`: Zod スキーマ（`GoogleTokenResponseSchema`・`GoogleTokenSecretSchema`）
- [ ] `src/config/env.ts`: `GOOGLE_CLIENT_SECRET_ARN` / `GOOGLE_CLIENT_ID` 追加
- [ ] `src/config/secrets.ts`: `getGoogleClientSecret` / `getGoogleToken` / `saveGoogleToken` 追加（JSON保存・差分3）
- [ ] `src/services/GoogleTokenService.ts`: アクセストークン取得・更新・in-memoryキャッシュ（差分3）
- [ ] `src/routes/google-auth.ts`: `/api/auth/google` / callback / DELETE ルート（redirect_uri動的生成・差分4）
- [ ] `src/index.ts`: google-auth.ts ルートをマウント

### Phase 3: CDK — Google OAuth 基盤
- [ ] `lib/stacks/data-stack.ts`: GoogleClientSecret + ForceDelete カスタムリソース（差分5）・DataStackExports 更新
- [ ] `lib/stacks/api-stack.ts`: 環境変数追加（`GOOGLE_CLIENT_SECRET_ARN` / `GOOGLE_CLIENT_ID`）・IAM権限（`saborou/google-token/*`）追加（差分5）
- [ ] `test/data-stack.test.ts`: GoogleClientSecret テスト追加
- [ ] `test/api-stack.test.ts`: Google 関連環境変数・IAM権限テスト追加
- [ ] CDK synth 確認（エラー 0）

### Phase 4: frontend — Google 連携ボタン
- [ ] `src/services/googleService.ts`: `/api/auth/google` の fetch ラッパー（開始・解除）
- [ ] `src/pages/SettingsPage.tsx`: Google 連携セクション追加（未連携/連携済み状態）

### Phase 5: U-07a 品質確認
- [ ] shared テスト全パス（カバレッジ100%維持）
- [ ] backend テスト追加・全パス
- [ ] cdk テスト全パス（既存 + 追加分）
- [ ] frontend テスト全パス
- [ ] typecheck（全パッケージ）
- [ ] Biome エラー数悪化なし
- [ ] CDK synth 成功
- [ ] 既存テスト非破壊（task-extractor 32件・auth テスト・cdk synth）

---

## U-07b 実装チェックリスト（U-07a 完了・承認後に着手）

### Phase 1: shared パッケージ追加（U-07b 分）
- [ ] `src/types/google-calendar-cache.ts`: 新規 `GoogleCalendarCache` インタフェース
- [ ] `src/types/index.ts`: `GoogleCalendarCache` を re-export

### Phase 2: agent — TaskExtractor 汎用化（差分1・最重要）
- [ ] `src/task-extractor/TaskExtractorAgent.ts`: `extractTask` を汎用化
  - 新シグネチャ: `extractTask(input: GenericExtractInput): Promise<ExtractionResult>`
  - `GenericExtractInput`: `{ text: string; sourceType: SourceType; sourceRef: string; userId: string }`
  - `SlackEventPayload` を受け取る旧シグネチャはオーバーロードまたは変換レイヤーで後方互換維持
  - プロンプトのタグを `<message>` 等の汎用タグに変更（Gmail でも自然になる）
  - 既存32テスト非破壊
- [ ] `src/sabori-proposer/types.ts`: `CalendarContext` 追加、`TaskContext` に `calendarContext?` 追加
- [ ] `src/sabori-proposer/contextUtils.ts`: Calendar ナラティブ・シグナル追加
- [ ] `src/sabori-proposer/saboriJudgmentTool.ts`: `calendarBusyScore` / `nearestMeetingMinutes` フィールド追加

### Phase 3: backend — Calendar / Gmail
- [ ] `src/services/GoogleCalendarService.ts`: Calendar API 呼び出し・busyScore 計算
- [ ] `src/services/GoogleGmailService.ts`: Gmail API 呼び出し・メッセージ取得（sourceRef=messageId・差分6）
- [ ] `src/repositories/DynamoGoogleCalendarCacheRepository.ts`: DynamoDB 実装
- [ ] `src/routes/google.ts`: Calendar/Gmail 取り込みルート
- [ ] `src/index.ts`: google.ts ルートをマウント追加
- [ ] `src/routes/proposals.ts`: GoogleCalendarCache を TaskContext に注入

### Phase 4: CDK — GoogleCalendarCacheTable
- [ ] `lib/stacks/data-stack.ts`: GoogleCalendarCacheTable 追加（TTL=ttl）・DataStackExports 更新
- [ ] `lib/stacks/api-stack.ts`: `DYNAMODB_TABLE_GOOGLE_CALENDAR_CACHE` 環境変数・読み書き権限追加
- [ ] `test/data-stack.test.ts`: GoogleCalendarCacheTable テスト追加
- [ ] `test/api-stack.test.ts`: テスト追加

### Phase 5: frontend — 取り込みボタン + TaskDetail
- [ ] `src/services/googleService.ts`: Calendar/Gmail 取り込み API 呼び出し追加
- [ ] `src/pages/SettingsPage.tsx`: 取り込みボタン + 最終取得時刻追加
- [ ] `src/pages/TaskDetailPage.tsx`: Calendar コンテキスト表示追加

### Phase 6: U-07b 品質確認
- [ ] 全パッケージテスト全パス（カバレッジ100% shared/agent・70% backend・全件 cdk）
- [ ] typecheck・Biome・CDK synth 成功
- [ ] 既存テスト非破壊（task-extractor 32件含む）

---

## 実装規模見積もり

### U-07a

| パッケージ | 新規ファイル | 変更ファイル | 概算工数 |
|-----------|-----------|-----------|---------|
| shared | 0 | 2（enums + constants + service-connection） | 0.5h |
| backend | 3（oauthState, google.ts型, GoogleTokenService） | 4（auth, env, secrets, index, google-auth） | 2.5h |
| cdk | 0 | 4（data-stack, api-stack, test×2） | 1h |
| frontend | 1（googleService） | 1（SettingsPage） | 1.5h |
| テスト | — | — | 1.5h |
| **U-07a 合計** | **4** | **11** | **7h** |

### U-07b

| パッケージ | 新規ファイル | 変更ファイル | 概算工数 |
|-----------|-----------|-----------|---------|
| shared | 1（google-calendar-cache） | 1（types/index） | 0.5h |
| backend | 3（CalendarService, GmailService, CalendarCacheRepo） | 3（google.ts, index, proposals） | 2.5h |
| agent | 0 | 4（TaskExtractorAgent汎用化・types・contextUtils・saboriJudgmentTool） | 2h |
| cdk | 0 | 4（data-stack, api-stack, test×2） | 0.5h |
| frontend | 0 | 2（SettingsPage, TaskDetailPage） | 1h |
| テスト | — | — | 1.5h |
| **U-07b 合計** | **4** | **14** | **8h** |

---

## 注意事項

1. **Slack auth.ts の既存テストを壊さない**: `signState`/`verifyState` を切り出す際、
   動作は同一のまま。既存の auth テストはすべてパスし続けること。

2. **TaskExtractor 後方互換（U-07b）**: `SlackEventPayload` を受け取る既存呼び出しが
   変更不要になるよう、内部で `GenericExtractInput` に変換するラッパーを実装する。
   既存の32件のテストが全てパスし続けること。

3. **calendarContext はすべて optional**: `TaskContext.calendarContext?` が undefined の場合も
   既存の Slack + 締切ベース判定は従来通り動作すること。

4. **Google トークンは JSON 形式**: `{ refreshToken, accessToken, expiresAt, scope }` を
   JSON 文字列として Secrets Manager に保存する（Slack の平文保存とは異なる）。
   `getGoogleToken` は JSON パースして各フィールドを返す実装にする（差分3）。

5. **Google OAuth Redirect URL の設定**: Slack と同様に、再デプロイのたびに
   Google Cloud Console の承認済みリダイレクト URI を更新する必要がある。
   SESSION-HANDOFF.md に手順を追記すること。

6. **refreshToken の初回取得保証**: `prompt=consent` を付けることで、
   既存連携ユーザーが再連携しても必ず refreshToken を取得できることを確認すること。

7. **Biome --unsafe の noDelete 注意**: `delete` を `=undefined` に変えるとテストが壊れる。
   `--unsafe` フラグは使用禁止。
