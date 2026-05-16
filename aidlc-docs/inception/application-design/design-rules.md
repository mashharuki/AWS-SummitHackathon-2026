# 設計ルール・トレーサビリティ — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-09
**バージョン**: 1.1.0
**更新日**: 2026-05-10（application-design.md §8〜§14 より分割）
**対象**: ビジネスルール / エラー戦略 / セキュリティ / パフォーマンス / トレーサビリティ

> 本ファイルは `application-design.md` の 8〜14 を独立ファイルとして切り出したものです。
> 設計概要・コンポーネント図・データモデル・API仕様は [`application-design.md`](application-design.md) を参照。
> シーケンス図（全7フロー）は [`sequence-diagrams.md`](sequence-diagrams.md) を参照。

---

## 8. ビジネスルール

### 8.1 サボり判定3状態の定義

| 状態 | verdict | UI 表示 | 判定基準 |
|------|---------|---------|---------|
| サボれる | `can_saboru` | 淡黄色背景「まだ寝かせてOK 💤」| 下記の「サボれる」条件を全て満たす |
| 注意 | `caution` | 通常背景「注意: 今日中に着手を ⚠️」| 「サボれる」でも「危ない」でもない中間状態 |
| 危ない | `danger` | 赤みがかった背景「危ない: 今すぐ着手 🔥」| 下記の「危ない」条件のいずれかに該当 |

### 8.2 判定ロジック（SaboriProposerAgent が評価する材料）

**「危ない」判定トリガー（いずれか1つ以上に該当すれば danger）**:
- 締切が6時間以内
- リマインドが3回以上届いている
- 依頼者から「急ぎ」「ASAP」「今すぐ」等の強調キーワードが検出される
- 依頼者が進捗確認メッセージを送信済み
- 関連会議が2時間以内に迫っている

**「サボれる」判定条件（全て満たす場合に can_saboru）**:
- リマインドが0件（未着信）
- 締切まで48時間以上
- 依頼者がオフラインまたは別件対応中
- 「急ぎ」キーワードなし
- 関連会議が12時間以上先

**「注意」判定（上記以外の全状態）**:
- 例: リマインド1〜2件 + 締切が24〜48時間後
- 例: 依頼者がオンラインだが明示的な催促なし

### 8.3 次回再評価タイミング計算ルール（next_check_at）

| 現在の verdict | 次回評価タイミング |
|--------------|----------------|
| `can_saboru` | 評価から 6時間後 |
| `caution` | 評価から 2時間後 |
| `danger` | 評価から 30分後 |
| 締切まで 12時間以内 | 30分ごと（verdict に関わらず）|

### 8.4 判断材料収集ルール

1. ContextCollector は最大30秒以内に全外部APIから収集する（タイムアウト設定）
2. 外部APIが失敗した場合は当該コンテキストを欠落として記録し、他の情報で判断する
3. 収集した生データ（メッセージ本文・メール本文）は抽出処理後に即時削除（NFR-07）
4. DynamoDB には「リマインド件数」「依頼者状態」「会議時刻」等のサマリのみ保存する
5. 依頼者名は仮名化またはイニシャル化して保存する

### 8.5 Persona（AI人格）定義

PersonaRenderer が参照する2種類の人格定義。MVP は人格A（saboru_ottori）固定。将来展望では人格B（saboru_nekkyou）と A/B テストを実施する。

**人格A: saboru_ottori（おっとりサボロー）— MVP固定**

```
persona_id: saboru_ottori
name: おっとりサボロー
concept: 「心の余白・良化を求める存在」
         ユーザーのメンタルウェルネスを守るという観点から、サボることを正当化する。
         「あなたが今サボっていいのは、心の余白を守るため」というトーン。
tone:
  - 語尾: 「〜だよ」「〜かもぉ」「〜だよぉ」「〜かな」
  - 口調: ゆるく・おっとり。焦らせない
  - 絵文字: ☁️ 💤 😌 📖 ✨ を積極使用（1メッセージに1〜2個）
  - 禁止語: 「必ず」「絶対」「〜してください」等の強い命令形
危ない判定時: 「さすがに今はやった方がいいかもぉ…」等、やんわり警告するが口調は変えない
```

**人格B: saboru_nekkyou（熱血サボロー）— 将来展望（A/Bテスト対象）**

```
persona_id: saboru_nekkyou
name: 熱血サボロー
concept: 「搾取されないぞ！と奮い立たせてくれる存在」
         ユーザーの怒り・反発心を引き出すことで、サボることを「搾取への抵抗」として正当化する。
         「その依頼、今すぐやる義理はない。搾取されるな！」というトーン。
tone:
  - 語尾: 「〜だろ！」「〜するな！」「〜立ち上がれ！」「〜勝ち取れ！」
  - 口調: 情熱的・反骨精神。ユーザーの怒りを煽る
  - 絵文字: 🔥 ✊ 💪 😤 を積極使用（1メッセージに1〜2個）
  - 禁止語: 「かもぉ」「だよぉ」等のおっとり語尾
危ない判定時: 「さすがにこれは戦略的撤退しかねぇ！今すぐやれ！」等、熱く警告する
```

---

## 9. エラーハンドリング戦略

### 9.1 外部 API 失敗

| シナリオ | 対応 |
|---------|------|
| Slack API タイムアウト（30秒超）| Slack コンテキストなしで提案生成。ログに警告記録 |
| Gmail API 失敗（v1.1.0 以降）| Gmail コンテキストなしで提案生成 |
| Google Calendar API 失敗（v1.1.0 以降）| Calendar コンテキストなしで提案生成 |
| OAuth トークン失効 | `TokenExpiredError` をスロー → フロントに「再連携が必要」バナーを表示 |

### 9.2 Bedrock タイムアウト / エラー

| シナリオ | 対応 |
|---------|------|
| converse API タイムアウト（20秒超）| `BedrockTimeoutError` → フロントに「提案の生成に時間がかかっています」表示（v1.2.0 で AgentCore 廃止、converse API 直接実装のためフォールバック不要）|
| converse API エラー（5xx）| 3回リトライ（exponential backoff）後 `BedrockTimeoutError` をスロー |
| コスト制限超過（$50/月）| Budgets アラート + `BedrockCostExceededError` → 提案生成を一時停止 |
| トークン制限超過（8,000）| `guardTokenLimit()` でプロンプトをトリム。超過分は警告ログ |

### 9.3 認証エラー

| シナリオ | 対応 |
|---------|------|
| JWT 期限切れ | 401 → フロントエンドが Cognito リフレッシュを試みる |
| リフレッシュ失敗 | ログアウト処理 → ログイン画面にリダイレクト |
| Cognito 障害 | 503 → メンテナンスメッセージを表示 |

### 9.4 DynamoDB エラー

| シナリオ | 対応 |
|---------|------|
| 書き込みエラー | 3回リトライ（exponential backoff）→ `DynamoWriteFailedError` |
| 読み込みエラー | 2回リトライ → エラー返却。フロントにトースト通知 |
| CapacityExceeded | On-Demand モードのため通常発生しない。発生時は CloudWatch アラート |

---

## 10. セキュリティ設計

### 10.1 IAM 最小権限

| Lambda | 付与する権限（DynamoDB）| 付与する権限（その他）|
|--------|----------------------|---------------------|
| Hono API Lambda | tasks / proposals / honneData / users / connections テーブルへの Read/Write | Cognito GetUser / Secrets Manager GetSecretValue（接続情報のみ）|
| TaskExtractorAgent Lambda | taskCandidates テーブルへの PutItem のみ | Bedrock InvokeAgent / InvokeModel |
| SaboriProposerAgent Lambda | proposals / personas テーブルへの Read/PutItem | Bedrock InvokeAgent / InvokeModel / Secrets Manager GetSecretValue |
| WebhookHandler Lambda | なし（DynamoDB 直接アクセス不可）| EventBridge PutEvents のみ |
| BackgroundRefreshHandler Lambda | proposals テーブルへの Query / PutItem | なし |

### 10.2 OAuth トークン管理

- Slack OAuth Access Token → Secrets Manager（`saborou/slack/<userId>`）
- Google OAuth Refresh Token → Secrets Manager（`saborou/google/<userId>`）
- Cognito JWT は各 Lambda で `aws-jwt-verify` ライブラリを使って検証
- トークン有効期限を `ServiceConnections` テーブルに記録し、期限前にリフレッシュする

### 10.3 PII（個人情報）保護

- Slack のメッセージ本文は抽出後に Lambda メモリ上から削除（AWS サービスへの永続化なし）
- 依頼者名はイニシャル化または仮名化（「T.クライアント」等）して保存
- DynamoDB のデータは AWS 管理 KMS で暗号化（デフォルト設定）
- S3 バケットは `BlockPublicAccess: BLOCK_ALL` + SSL 必須

### 10.4 API セキュリティ

- 全 API Gateway エンドポイントに JWT オーソライザー（Cognito）を設定
- Webhook エンドポイントは JWT 不要だが Slack Signing Secret による署名検証を必須とする
- CORS 設定: CloudFront ドメインのみ許可
- Rate Limiting: API Gateway のデフォルト制限（10,000 req/s）に準拠

---

## 11. パフォーマンス設計

### 11.1 NFR 達成のための具体策

| NFR | 目標値 | 実装策 |
|-----|--------|--------|
| NFR-01a（タスク抽出）| 10秒以内 | Lambda プロビジョニング済み同時実行数を設定。Bedrock プロンプトを最小限に最適化（タスク抽出特化・3,000トークン以内）|
| NFR-01b（サボり提案 first chunk）| 20秒以内 | SSE ストリーミングで体感速度を向上。ContextCollector の並列呼び出し（Promise.allSettled）。Bedrock Streaming API 使用 |
| NFR-01c（タスク整理 v1.1.0）| 30秒以内（非同期）| EventBridge 経由の非同期処理。ユーザー応答をブロックしない設計 |

### 11.2 コスト最適化

- Bedrock プロンプト設計:
  - TaskExtractorAgent: 最大 3,000 トークン（システムプロンプト + 入力メッセージ）
  - SaboriProposerAgent: 最大 8,000 トークン（コンテキスト + 推論 + 出力）
- DynamoDB: On-Demand モード（PAY_PER_REQUEST）でスケールゼロ可能
- Lambda: コールドスタート対策として主要 Lambda に Provisioned Concurrency（最小1）を設定

### 11.3 レイテンシ最適化

- ContextCollector: Slack API を呼び出し（v1.1.0 以降: Gmail / Calendar も `Promise.allSettled` で並列呼び出し）
- Proposals テーブル: `GSI-TaskLatest` を使って最新提案を O(1) で取得
- フロントエンドキャッシュ: タスク一覧は5秒間キャッシュ（React Query staleTime）

---

## 12. トレーサビリティ

### 12.1 コンポーネント → FR/NFR/Story 対応表

| コンポーネント | 対応 FR | 対応 NFR | 対応 Story |
|-------------|---------|---------|-----------|
| TaskExtractorAgent（AG-01）| FR-01 | NFR-01a, NFR-07 | US-01, US-02, US-03 |
| TaskOrganizerAgent（AG-05）| FR-01b | NFR-01c | US-18 |
| SaboriProposerAgent（AG-02）| FR-03, FR-04 | NFR-01b, NFR-06 | US-08, US-09, US-10, US-11 |
| PersonaRenderer（AG-03）| FR-03 | NFR-09 | US-08〜US-10 |
| ContextCollector（AG-04）| FR-03 | NFR-01a, NFR-01b, NFR-07 | US-08〜US-12 |
| TaskHandler（BE-02）| FR-02, FR-08 | NFR-08 | US-05, US-06, US-07, US-16 |
| ProposalHandler（BE-03）| FR-03, FR-04 | NFR-01b, NFR-06 | US-08〜US-12, US-17 |
| HonneHandler（BE-04）| FR-05 | NFR-05 | US-13, US-14, US-15 |
| ConnectionHandler（BE-05）| FR-07 | NFR-07 | US-04 |
| WebhookHandler（BE-06）| FR-01 | NFR-01a | US-01 |
| TaskListPage（FE-01）| FR-02, FR-06, FR-08 | NFR-10 | US-05〜US-07, US-12, US-16 |
| TaskDetailPage（FE-02）| FR-03, FR-04, FR-05 | NFR-01b, NFR-10 | US-08〜US-15, US-17 |
| LoginPage（FE-03）| FR-07 | NFR-07 | US-04 |
| SettingsPage（FE-04）| FR-07 | NFR-07 | US-04 |
| CognitoStack（INF-01）| FR-07 | NFR-07 | US-04 |
| DataStack（INF-02）| FR-01〜FR-08 | NFR-05, NFR-07, NFR-11 | 全 Story |
| ApiStack（INF-03）| FR-01〜FR-08 | NFR-03, NFR-04, NFR-11 | 全 Story |
| AgentStack（INF-04）| FR-01, FR-01b, FR-03 | NFR-06, NFR-11 | US-01〜US-03, US-08〜US-12, US-18 |
| FrontendStack（INF-05）| FR-01〜FR-08 | NFR-04, NFR-11 | 全 Story |
| WebhookStack（INF-06）| FR-01, FR-04 | NFR-01a | US-01〜US-03, US-11 |

---

## 13. 想定 Unit of Work（次ステージへの引き継ぎ）

v1.1.0 からエージェントパイプラインを3エージェント構成に拡張したため、Unit 総数が 6 → 7 に増加した。

| Unit | モジュール | 主な作業内容 |
|------|----------|------------|
| U-01: shared | packages/shared | 型定義・共通ユーティリティ・エラークラス |
| U-02: infra | infra/ | CDK 全スタック（Cognito / Data / Api / Agent / Frontend / Webhook）|
| U-03a: task-extractor | packages/agent | TaskExtractorAgent（AG-01）/ Bedrock wrapper |
| U-03c: task-organizer | packages/agent | TaskOrganizerAgent（AG-05）/ タスク依存関係・手順最適化 ★新規 |
| U-03b: sabori-proposer | packages/agent | SaboriProposerAgent（AG-02）/ PersonaRenderer（AG-03）/ ContextCollector（AG-04）|
| U-04: api | apps/api | Hono ハンドラ全6コンポーネント・サービス層 |
| U-05: web | apps/web | React 全画面（TaskList / TaskDetail / Login / Settings / AppShell）|

**依存順序**: U-01 → U-02 → U-03a → U-03c → U-03b → U-04 → U-05

---

## 14. 参照文書

| 文書 | パス |
|------|------|
| アプリケーション設計書（全体）| `aidlc-docs/inception/application-design/application-design.md` |
| シーケンス図（全7フロー）| `aidlc-docs/inception/application-design/sequence-diagrams.md` |
| コンポーネント定義 | `aidlc-docs/inception/application-design/components.md` |
| コンポーネントメソッド | `aidlc-docs/inception/application-design/component-methods.md` |
| サービス定義 | `aidlc-docs/inception/application-design/services.md` |
| コンポーネント依存関係 | `aidlc-docs/inception/application-design/component-dependency.md` |
| 要件定義書 | `aidlc-docs/inception/requirements/requirements.md` |
| ユーザーストーリー | `aidlc-docs/inception/user-stories/stories.md` |
| 実行計画書 | `aidlc-docs/inception/plans/execution-plan.md` |

---

*本ファイルは `application-design.md` §8〜§14 の分割ファイルです。*
