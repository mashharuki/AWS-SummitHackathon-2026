# Unit × ストーリーマップ — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-09
**バージョン**: 1.0.0

---

## 1. ストーリー → Unit マッピング全表

Epic / Story の定義は `aidlc-docs/inception/user-stories/stories.md` を参照。

| Story ID | ストーリータイトル（概要） | 主担当 Unit | 補助 Unit | 優先度 |
|----------|------------------------|-----------|---------|--------|
| US-01 | Slack からタスクが自動抽出される | U-03a task-extractor | U-04 api / U-02 infra | MUST |
| US-02 | Gmail からタスクが自動抽出される | U-03a task-extractor | U-04 api / U-02 infra | MUST |
| US-03 | Google Calendar からタスクが自動抽出される | U-03a task-extractor | U-04 api / U-02 infra | MUST |
| US-04 | Google アカウントでログインできる | U-05 web | U-04 api / U-02 infra | MUST |
| US-05 | タスク候補を一覧で確認できる | U-05 web | U-04 api | MUST |
| US-06 | タスク候補を承認・拒否できる | U-05 web | U-04 api | MUST |
| US-07 | タスクを手動で追加できる | U-05 web | U-04 api | MUST |
| US-08 | タスクに対してサボり提案を受け取れる | U-03b sabori-proposer | U-04 api / U-05 web | MUST |
| US-09 | サボり判定の根拠（理由）を確認できる | U-03b sabori-proposer | U-04 api / U-05 web | MUST |
| US-10 | サボり判定が3状態で視覚的に分かる | U-05 web | U-03b sabori-proposer | MUST |
| US-11 | サボり提案がリアルタイムで更新される | U-04 api | U-03b sabori-proposer / U-02 infra | MUST |
| US-12 | サボり提案が1行サマリで一覧に表示される | U-05 web | U-04 api | MUST |
| US-13 | 本音（クイック返信）を記録できる | U-05 web | U-04 api | MUST |
| US-14 | 本音（自由入力）を記録できる | U-05 web | U-04 api | MUST |
| US-15 | 本音記録後にサボローの返答が届く | U-03b sabori-proposer | U-04 api / U-05 web | MUST |
| US-16 | タスクをインライン編集できる | U-05 web | U-04 api | SHOULD |
| US-17 | サボり提案をオンデマンドで再評価できる | U-03b sabori-proposer | U-04 api / U-05 web | SHOULD |

---

## 2. Unit → ストーリー マッピング

### U-01: shared（全 Story の共通基盤）

U-01 は型定義・ユーティリティを提供するため、全ストーリーの間接的な基盤となる。
直接の主担当ストーリーはなし。

---

### U-02: infra（インフラ基盤）

U-02 も直接の主担当ストーリーはないが、全ストーリーの実行環境を提供する。
特に関連が深い NFR:

| NFR | 内容 |
|-----|------|
| NFR-03 | 可用性（Lambda + DynamoDB マルチ AZ）|
| NFR-04 | CloudFront による高速配信 |
| NFR-06 | Bedrock コスト監視（$50/月アラート）|
| NFR-07 | Secrets Manager による OAuth トークン管理 |
| NFR-11 | IAM 最小権限・暗号化 |

---

### U-03a: task-extractor

主担当: US-01 / US-02 / US-03

| Story | エージェント担当範囲 |
|-------|-----------------|
| US-01 | Slack メッセージ → タスク候補（TaskExtractorAgent）|
| US-02 | Gmail メール → タスク候補（TaskExtractorAgent）|
| US-03 | Google Calendar → タスク候補（TaskExtractorAgent）|

---

### U-03b: sabori-proposer

主担当: US-08 / US-09 / US-15 / US-17

補助担当: US-11（リアルタイム更新の提案生成側）

| Story | エージェント担当範囲 |
|-------|-----------------|
| US-08 | タスク → サボり提案生成（SaboriProposerAgent + ContextCollector）|
| US-09 | reasoning 配列の生成（SaboriProposerAgent）|
| US-11 | バックグラウンド再評価（BackgroundRefreshHandler）|
| US-15 | 本音記録後のサボロー返答（PersonaRenderer）|
| US-17 | オンデマンド再評価（SaboriProposerAgent の再実行）|

---

### U-04: api

主担当: US-11（SSE ストリーミング）

補助担当: US-01〜US-17 ほぼ全て（HTTP ハンドラとして処理）

| エンドポイント | 担当 Story |
|-------------|----------|
| POST /webhooks/slack | US-01 |
| GET /api/connections, POST コールバック | US-04 |
| GET /api/tasks | US-05 |
| POST /api/tasks/candidates/:id/approve | US-06 |
| POST /api/tasks | US-07 |
| GET /api/tasks/:id/proposal（SSE）| US-08 / US-09 / US-11 / US-17 |
| POST /api/tasks/:id/honne | US-13 / US-14 / US-15 |
| PATCH /api/tasks/:id | US-16 |

---

### U-05: web

主担当: US-04 / US-05 / US-06 / US-07 / US-10 / US-12 / US-13 / US-14 / US-16

| コンポーネント | 担当 Story |
|-------------|----------|
| LoginPage（FE-03）| US-04 |
| TaskListPage（FE-01）| US-05 / US-06 / US-12 / US-16 |
| TaskDetailPage（FE-02）| US-08 / US-09 / US-10 / US-13 / US-14 / US-15 / US-17 |
| SettingsPage（FE-04）| US-04（サービス連携管理）|
| TaskCard（FE-08）| US-10 / US-12 |
| AppShell（FE-05）| US-04（認証ガード）|

---

## 3. Epic × Unit マッピング

| Epic ID | Epic タイトル | 主担当 Unit | 補助 Unit |
|---------|------------|-----------|---------|
| E-01 | タスク自動収集 | U-03a task-extractor | U-04 api / U-02 infra |
| E-02 | タスク管理 | U-05 web | U-04 api |
| E-03 | サボり提案 | U-03b sabori-proposer | U-04 api / U-05 web |
| E-04 | 本音記録 | U-05 web | U-04 api / U-03b sabori-proposer |
| E-05 | サービス連携 | U-05 web | U-04 api / U-02 infra |

---

## 4. MVP スコープ（M2: 2026-05-30）における Story 優先度

| Story | MVP 含む | 理由 |
|-------|---------|------|
| US-04 | はい | ログインなしでは何もできない |
| US-05 | はい | タスク確認が基本動作 |
| US-06 | はい | 承認がタスク管理のコア |
| US-07 | はい | 手動追加でデモがスムーズ |
| US-08 | はい | サボり提案がメインバリュー |
| US-09 | はい | 根拠がないと説得力なし |
| US-10 | はい | 3状態の色分けが UX の要 |
| US-12 | はい | 一覧で判定が見えないと UI が成立しない |
| US-13 | はい | クイック返信が「人をダメにする」体験の核心 |
| US-15 | はい | サボローの返答がキャラクターを体験させる |
| US-01 | 条件付き | Slack Webhook の設定が必要。デモでは手動追加で代替可能 |
| US-02 | 条件付き | Gmail API の OAuth 設定が複雑。M2 では後回し可 |
| US-03 | 条件付き | Calendar 同上 |
| US-11 | 条件付き | EventBridge Scheduler の設定後。M2 後半で対応 |
| US-14 | はい | 自由入力は実装コスト低い |
| US-16 | 後回し | SHOULD。M3 で対応 |
| US-17 | はい | 再評価ボタンはデモで使う |

---

*本文書は Units Generation ステージの補助成果物です。*
