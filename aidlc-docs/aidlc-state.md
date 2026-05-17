# AI-DLC 状態管理

## プロジェクト情報
- **プロジェクト名**: サボロー（AWS Summit Japan 2026 ハッカソン）
- **プロジェクトタイプ**: Greenfield（新規）
- **開始日時**: 2026-05-09T07:00:00Z
- **現在のステージ**: CONSTRUCTION フェーズ完了（Build and Test 完了 — 2026-05-17T14:20:00Z）。次は OPERATIONS フェーズ（CDK デプロイ）
- **ドキュメントバージョン**: v2.1.0（2026-05-17 Build and Test 完了反映）

## ワークスペース状態
- **既存コード**: なし
- **リバースエンジニアリング要否**: 不要（Greenfield）
- **ワークスペースルート**: /Users/shineikikkawa/dev/hackson/AWS-SummitHackathon-2026

## コード配置ルール
- **アプリケーションコード**: ワークスペースルート（aidlc-docs/ 内には配置しない）
- **ドキュメント**: aidlc-docs/ のみ
- **構造パターン**: code-generation.md の Critical Rules を参照

## ステージ進捗

### INCEPTION フェーズ
- [x] Workspace Detection（完了: 2026-05-09T07:00:00Z）
- [x] Reverse Engineering（スキップ: Greenfield のため不要）
- [x] Requirements Analysis（完了: 2026-05-09T10:00:00Z）
- [x] User Stories（完了: 2026-05-09T12:00:00Z）
- [x] Workflow Planning（完了: 2026-05-09T13:00:00Z）
- [x] Application Design（完了: 2026-05-09T14:30:00Z）
- [x] Units Generation（完了: 2026-05-09T15:00:00Z）

### CONSTRUCTION フェーズ

#### U-01: shared
- [x] Functional Design — 完了・承認済み（2026-05-17T06:00:00Z）。domain-entities.md / business-rules.md / business-logic-model.md 生成済み。ユーザー承認取得。
- [x] NFR Requirements — 完了・承認済み（2026-05-17T08:00:00Z）。nfr-requirements.md / tech-stack-decisions.md 生成済み。品質最大化方針確定（プロダクション品質優先）。ユーザー承認（[B] Continue to Next Stage）。
- [x] NFR Design — 完了（2026-05-17T08:30:00Z）。nfr-design-patterns.md / logical-components.md 生成済み。質問なし・ファストトラック自動進行。
- [x] Infrastructure Design — スキップ（N/A: @saboru/shared はランタイムなしの純粋 TypeScript ライブラリ。AWS リソースを直接使用しないため Infrastructure Design の対象なし）
- [x] Code Generation — 完了（2026-05-17T10:15:00Z）。pkgs/shared/ 生成済み（93テスト全パス・カバレッジ100%・ESM/CJS/DTS ビルド成功）

#### U-02: infra
- [x] Functional Design — 完了（2026-05-17T11:15:00Z）。functional-design.md 生成済み。6スタック責務・Props設計・RemovalPolicy・タグ付け・CfnOutput定義。質問なしファストトラック自動進行。
- [x] NFR Requirements — 完了（2026-05-17T11:30:00Z）。nfr-requirements.md 生成済み。NFR-I1〜I6（セキュリティ/コスト/テスト/IaC再現性/可観測性/cdk-nag）定義。
- [x] NFR Design — 完了（2026-05-17T11:45:00Z）。nfr-design.md 生成済み。8設計パターン（Grant Method Chain / ARN Injection / OAC / ARM64 / CDK Assertions / Context-Based Config / CloudWatch アラーム自動生成 / AwsSolutionsChecks）定義。
- [x] Infrastructure Design — 完了（2026-05-17T12:00:00Z）。infrastructure-design.md 生成済み。6スタック詳細実装仕様・テストファイル仕様・デプロイ手順・CfnOutput 一覧・Well-Architected 6本柱準拠確認。
- [x] Code Generation — 完了（2026-05-17T15:30:00Z）。6スタック + 1コンストラクト + 6テストファイル（33テスト全パス）。cdk synth 成功（Errors=0 / cdk-nag 全Rule対応）。aidlc-docs/construction/infra/code/code-generation-summary.md 生成済み。

#### U-03a: task-extractor
- [x] Functional Design — 完了（2026-05-17T16:10:00Z）。functional-design.md 生成済み。データモデル・Tool Use スキーマ・ビジネスロジック・パッケージ構成定義。質問なしファストトラック自動進行。
- [x] NFR Requirements — 完了（2026-05-17T16:15:00Z）。nfr-requirements.md 生成済み。性能・セキュリティ・信頼性・コスト・テスト容易性・可観測性 NFR 定義。
- [x] NFR Design — 完了（2026-05-17T16:20:00Z）。nfr-design.md 生成済み。8設計パターン定義（Adapter / ToolChoice強制 / Zodダブルバリデーション / 生データ破棄 / 冪等性PutItem / SecretsManagerキャッシュ / 構造化ログ / maxTokens固定）。
- [x] Infrastructure Design — 完了（2026-05-17T16:25:00Z）。infrastructure-design.md 生成済み。U-02既存リソース活用・AgentStack修正点特定（code パス / SLACK_TOKEN_SECRET_NAME / grantRead追加）。
- [x] Code Generation — 完了（2026-05-17T01:50:00Z UTC）。pkgs/agent 新規作成（32テスト全パス・カバレッジ Statements 98.36% / Branches 84.21% / Functions 90.9%）。pkgs/cdk既存33テスト継続パス確認。AgentStack修正完了。

#### U-03b: sabori-proposer
- [x] Functional Design — 完了（2026-05-17T03:10:00Z）。functional-design.md 生成済み。3フェーズ設計・Tool Use スキーマ・心理学5理論シグナル・SSE ストリーミング設計・IBedrockClient 拡張定義。質問なしファストトラック自動進行。
- [x] NFR Requirements — 完了（2026-05-17T03:15:00Z）。nfr-requirements.md 生成済み。NFR-P1〜P4（パフォーマンス）/S1〜S4（セキュリティ）/R1〜R4（信頼性）/C1〜C2（コスト）/T1〜T2（テスト容易性）/O1〜O3（可観測性）全19件定義。
- [x] NFR Design — 完了（2026-05-17T03:20:00Z）。nfr-design.md 生成済み。10設計パターン定義（IBedrockClient拡張/ToolChoice強制/Zodダブルバリデーション/rawSummaryスコープ制限/DynamoDB冪等性/SecretsManagerキャッシュ再利用/構造化ログ/maxTokens2段階/PersonaRendererフォールバック/Slack APIタイムアウト）。
- [x] Infrastructure Design — 完了（2026-05-17T03:25:00Z）。infrastructure-design.md 生成済み。AgentStack修正点特定（handler パス/codeパス/timeout=90s/memorySize=1024MB/SLACK_TOKEN_SECRET_NAME/Haiku IAM ARN追加）。
- [x] Code Generation — 完了（2026-05-17T02:20:00Z UTC）。新規10ファイル・変更6ファイル。pkgs/agentビルド成功（ESM+CJS+DTS）。104テスト全パス（Statements 88.79% / Branches 85.45%）。pkgs/cdk 35テスト全パス（agent-stack.test.ts U-03b仕様2件追加）。code-generation-summary.md 生成済み。

#### U-04: api
- [x] Functional Design — 完了（2026-05-17T05:10:00Z）。domain-entities.md / business-rules.md / business-logic-model.md 生成済み。BR-API-01〜10定義。15エンドポイント仕様・SSEフロー・Webhook受信フロー確定。質問なしファストトラック自動進行。
- [x] NFR Requirements — 完了（2026-05-17T05:15:00Z）。nfr-requirements.md / tech-stack-decisions.md 生成済み。NFR-P1〜P3/S1〜S5/R1〜R3/C1〜C2/T1〜T2/O1〜O3 全17件定義。
- [x] NFR Design — 完了（2026-05-17T05:20:00Z）。nfr-design.md 生成済み。8設計パターン定義（Hono Variables / Zod二重防衛 / Slack HMAC / Secrets Manager キャッシュ / streamSSE / エラーハンドラ / EventBridge fire-and-forget / esbuild ARM64）。
- [x] Infrastructure Design — 完了（2026-05-17T05:25:00Z）。infrastructure-design.md 生成済み。2Lambda エントリポイント構成・CDK変更点（環境変数追加・IAM権限修正）・ビルドスクリプト設計確定。
- [x] Code Generation — 完了（2026-05-17T13:07:00Z）。新規23ファイル（types/errors/middleware 3/config 2/services 2/repositories 6/routes 7/webhook-handler）・変更6ファイル（index/handler/openapi/package.json/tsconfig/vitest.config）・CDK api-stack.ts 更新。build: dist/index.js 286.7kb + dist/webhook.js 76.7kb 成功。test: 117テスト all pass（Statements 72.96% / Branches 67.06% / Functions 72.04% / Lines 72.99%）。CDK jest 35テスト継続パス。code-summary.md 生成済み。

#### U-05: web
- [x] Functional Design — 完了（2026-05-17T14:00:00Z）。domain-entities.md / business-rules.md / business-logic-model.md / frontend-components.md 生成済み。モックUI（01-login/02-tasklist/03-detail/04-settings）参照済み。質問なしファストトラック自動進行。
- [x] NFR Requirements — 完了（2026-05-17T14:10:00Z）。nfr-requirements.md / tech-stack-decisions.md 生成済み。NFR-WEB-P1〜P4/S1〜S5/R1〜R4/A1〜A2/U1〜U3/T1〜T4/O1〜O2 全20件定義。質問なしファストトラック自動進行。
- [x] NFR Design — 完了（2026-05-17T14:20:00Z）。nfr-design-patterns.md（10パターン）/ logical-components.md 生成済み。質問なしファストトラック自動進行。
- [x] Infrastructure Design — 完了（2026-05-17T14:30:00Z）。infrastructure-design.md 生成済み。環境変数定義・ビルド・デプロイ手順・CDK変更点（DistributionId追加/CORS開発許可）確定。
- [x] Code Generation — 完了（2026-05-17T14:45:00Z）。53テスト全pass / tsc エラーゼロ / vite build 成功。E2Eテストファイル作成（tests/e2e.spec.ts）。

#### 全Unit完了後
- [x] Build and Test（完了: 2026-05-17T14:20:00Z）— 542テスト全パス / E2E 5テスト全パス / Biome 0エラー / tsc 全パッケージ成功 / CONSTRUCTION フェーズ完了

### OPERATIONS フェーズ
- [x] CDK操作ガイド（aidlc-docs/operations/cdk-operations.md）
- [x] バックエンド操作ガイド（aidlc-docs/operations/backend-operations.md）
- [x] フロントエンド操作ガイド（aidlc-docs/operations/frontend-operations.md）

## Extension 設定
- **Security Baseline**: 無効（Q23=B — PoC・プロトタイプ扱い。基本セキュリティは実装する）
- **Property-Based Testing**: 無効（Q24=C — シンプルな CRUD・統合レイヤーが主）

## 適用済みスキル
- **aws-well-architected**: 2026-05-16 適用 → `aidlc-docs/inception/application-design/well-architected-review.md` 生成
- **lean-formal-verification**: 2026-05-16 適用 → `execution-plan.md` §10 にクリティカルパス検証・カットライン定義を追記
- **hackathon-strategist**: 2026-05-16 参照 → 14日計画・カットラインの戦略的フレームワーク

## Execution Plan Summary（v2.0.0 — 2026-05-16 予選向け全面改訂）

- **実行計画書**: `aidlc-docs/inception/plans/execution-plan.md`（v2.0.0）
- **総合リスクレベル**: Medium（Slack単独化・converse API直接実装で新興性リスクを解消）
- **推奨実装順序**: shared → infra → task-extractor → sabori-proposer → api → web
- **実行ステージ数**: Construction 5 ステージ × 6 Unit（U-03c は v1.1.0 除外）
- **スキップステージ**: Reverse Engineering（Greenfield）/ U-03c task-organizer（予選スコープ外）/ Operations（プレースホルダー）
- **マイルストーン**:
  - M1: 書類審査（2026-05-10）— **完了（通過済み）**
  - M2: MVP デモ（2026-05-30）— 動作する MVP（Slack+Dual-Agent+Three.js）
  - M3: 決勝（2026-06-26）— AWS デプロイ済み完成品

## v1.3.0 モノレポ実装反映（2026-05-16）

**変更内容**: モノレポベース実装完了に伴う Inception ドキュメント全面更新

| 変更点 | 旧（設計書） | 新（実装） |
|--------|------------|----------|
| ワークスペースルート | `packages/`, `apps/`, `infra/` | `pkgs/` |
| フロントエンド | `apps/web/` | `pkgs/frontend/`（ベース実装済み） |
| バックエンド | `apps/api/` | `pkgs/backend/`（ベース実装済み） |
| インフラ | `infra/` | `pkgs/cdk/`（ベース実装済み） |
| 共有パッケージ | `packages/shared/` | `pkgs/shared/`（Construction で作成） |
| エージェント | `packages/agent/` | `pkgs/agent/`（Construction で作成） |
| パッケージマネージャー | npm workspaces | pnpm@10.33.0 workspaces |
| React | React 18 | React 19.2.6 |
| コード品質 | ESLint / Prettier | Biome 1.9.4 |
| Node.js | 未記載 | v23（.nvmrc） |

**更新ファイル**:
- `inception/units/unit-of-work.md`: 全ユニットのディレクトリパス・モノレポ構成ツリー更新
- `operations/README.md`: モノレポ構成・技術スタックテーブル更新
- `inception/plans/execution-plan.md`: ディレクトリ参照・実装済みパッケージ注記追加
- `inception/application-design/application-design.md`: ディレクトリ参照更新
- `operations/cdk-operations.md` / `backend-operations.md` / `frontend-operations.md`: パス・コマンド更新

---

## v1.2.1 追加クリーンアップ（2026-05-16 第3次）

コンテキスト復元後のグレップ検証で発見した残存参照を修正:
- `AG-02-sabori-proposer-agent.md`: TaskContext から gmailContext/calendarContext を削除
- `component-methods/README.md`: AG-04 依存関係図を Slack API のみに更新
- `shared-utils.md`: EXTERNAL_API_FAILED コメントを Slack のみに
- `infra-components.md`: IN-05 WebhookStack を Slack のみに
- `BE-02-task-handler.md`: FR-01 記述を Slack のみに
- `components.md`: ServiceType 型 / FE-04 責務 / INF-06 EventBridge ルールを Slack のみに
- `design-rules.md`: Gmail/Calendar エラーハンドリング / PII 保護 / レイテンシ設計を v1.0 実態に合わせ更新
- `application-design.md`: ServiceConnections SK / sourceType を v1.0 Slack のみに
- `sequence-diagrams.md`: Gmail/Calendar シーケンス全ステップを `[v1.1.0]` Mermaid コメントに変換。InvokeAgent/InvokeModel → converse API に修正
- `services.md`: exchangeGoogleToken Gmail/Calendar スコープ記述を v1.1.0 scope に移動
- `component-methods.md`: v1.2.0 廃止通知ヘッダーを追加（旧統合ファイル・実装時参照禁止）

**検証結果**: `application-design/` 配下で非意図的な Gmail/Calendar/AgentCore 参照ゼロ確認済み。

---

## v1.2.0 主要変更サマリ（2026-05-16）

| 変更 | 変更前 | 変更後 |
|------|--------|--------|
| 外部連携 | Slack / Gmail / Google Calendar | Slack のみ（他は v1.1.0）|
| エージェント実装 | Bedrock AgentCore | converse API + Tool Use（IBedrockClient インタフェース維持）|
| Three.js | README 記載のみ | M2 MVP スコープに明示（U-05 工数 6-8h → 8-12h）|
| U-03c 優先度 | 高 | 低（v1.1.0）— 予選スコープ外に移動 |
| NFR-01a レイテンシ | 10秒以内 | ウォームアップ時10秒 / コールドスタート時15秒 |
| SSE実装方式 | API Gateway | Lambda Response Streaming + Function URL |
| タイムライン | 旧（崩壊済み）| 14日詳細計画（5/16〜5/30）+ カットライン定義 |
| デプロイ計画 | 未定義 | AWSデプロイ手順・Slack設定・URL確保 追加 |

## User Stories 成果物
- **personas.md**: `aidlc-docs/inception/user-stories/personas.md`（完了）— プライマリペルソナ1名（34歳・フリーランスデザイナー）の詳細定義
- **stories.md**: `aidlc-docs/inception/user-stories/stories.md`（完了）— Epic 5件・ストーリー17件（MUST: 15 / SHOULD: 2）
- **demo-stories.md**: `aidlc-docs/inception/user-stories/demo-stories.md`（完了）— 5分デモシナリオ（審査員向け）
- **future-stories.md**: `aidlc-docs/inception/user-stories/future-stories.md`（完了）— 将来展望ストーリー4件（MVP スコープ外）
- **Epic 数**: 5（E-01〜E-05）
- **Story 数**: 17（US-01〜US-17）

## Requirements Analysis 成果物
- **requirements.md**: `aidlc-docs/inception/requirements/requirements.md`（完了・v1.1.0 更新: 2026-05-10T09:00:00Z）
- **requirement-verification-questions.md**: `aidlc-docs/inception/requirements/requirement-verification-questions.md`（完了・24問全回答）
- **FR 件数**: 9件（FR-01 / FR-01b★新規 / FR-02〜FR-08）
- **NFR 件数**: 11件（NFR-01〜NFR-11）
- **将来展望**: 追加済み（§9: ABテスト人格 / 1対Nプラットフォーム）

## 入力資料
以下のファイルが aidlc-inputs/ に配置済み:
- `README.md` - プロジェクト概要
- `00-business-brief.md` - サボロー企画書（モック反映済み）
- `01-tech-stack-decisions.md` - 技術スタック方針
- `02-development-policy.md` - 開発ポリシー
- `03-aws-architecture-policy.md` - AWSアーキテクチャ方針
- `mockups/01-task-list.png` / `02-task-detail-chat.png` / `README.md` - ビジネス側提供のUIモック

## Units Generation 成果物
- **unit-of-work.md**: `aidlc-docs/inception/units/unit-of-work.md`（完了・v1.1.0 更新: 2026-05-10T09:00:00Z）
- **unit-dependencies.md**: `aidlc-docs/inception/units/unit-dependencies.md`（完了）
- **unit-story-map.md**: `aidlc-docs/inception/units/unit-story-map.md`（完了）
- **Unit 数**: 7（U-01: shared / U-02: infra / U-03a: task-extractor / U-03c: task-organizer★新規 / U-03b: sabori-proposer / U-04: api / U-05: web）
- **実装順序**: shared → infra → task-extractor → task-organizer → sabori-proposer → api → web
- **規模**: S（U-01）/ M（U-02）/ M（U-03a）/ M（U-03c）/ M（U-03b）/ L（U-04）/ M（U-05）
- **次ステージ**: CONSTRUCTION フェーズ — U-01: shared から開始
- **INCEPTION フェーズ完了**: 2026-05-09T15:00:00Z
- **INCEPTION 文書更新（チーム追加要件）**: 2026-05-10T09:00:00Z

## Application Design 成果物
- **application-design.md**: `aidlc-docs/inception/application-design/application-design.md`（完了・v1.1.0 更新: 2026-05-10T09:00:00Z）
- **components.md**: `aidlc-docs/inception/application-design/components.md`（完了・v1.1.0 更新: AG-05追加 / PersonaRenderer人格A/B追加）
- **component-methods.md**: `aidlc-docs/inception/application-design/component-methods.md`（完了）
- **services.md**: `aidlc-docs/inception/application-design/services.md`（完了）
- **component-dependency.md**: `aidlc-docs/inception/application-design/component-dependency.md`（完了）
- **コンポーネント総数**: 25（フロントエンド: 8 / バックエンド: 6 / エージェント: 5★AG-05追加 / インフラ: 6）
- **DynamoDB テーブル数**: 8（Users / ServiceConnections / TaskCandidates / Tasks / TaskOrganization★新規 / Proposals / HonneData / Personas）
- **API エンドポイント数**: 14
- **シーケンス図数**: 7（タスク自動抽出 / サボり提案生成 / 本音データ記録 / バックグラウンド再評価 / 認証 / 外部サービス連携 / エラーハンドリング）
- **想定 Unit 数**: 7（shared → infra → task-extractor → task-organizer★新規 → sabori-proposer → api → web）

## 書類審査レビュー
- **レビュー実施日時**: 2026-05-09T16:30:00Z
- **レビュアー**: AI-DLC Specialist（aws-summit-hackathon-reviewer skill使用）
- **レビュー深度**: 包括的（Comprehensive）
- **総合評価**: B+ (3.69/5.0)
- **提出準備状況**: 要修正（3つの重大な欠陥 + 5つの改善推奨事項あり）
- **競争力評価**: 150チーム中 上位30%圏内（現状）→ 修正後は上位10%圏内を狙える
- **レビューレポート**: `aidlc-docs/review-report-20260509.md`
- **重大な欠陥**:
  1. ✅ 技術スタック変更（Vercel Chat SDK）の主要ドキュメント反映を完了（2026-05-09T18:20:00Z）
  2. ✅ AWS全体アーキテクチャ図（Mermaid）を作成済み（2026-05-09T17:30:00Z）
  3. ✅ シーケンス図を4件→7件に拡張済み（2026-05-09T17:30:00Z）
- **最優先修正項目（24時間以内）**:
  1. ✅ Vercel Chat SDK を requirements.md / application-design.md / unit-of-work.md に反映（完了: 2026-05-09T18:20:00Z）
  2. ✅ AWS全体アーキテクチャ図（Mermaid）を生成（完了: 2026-05-09T17:30:00Z）
  3. ✅ README.md にプロジェクト概要を記載（完了: 2026-05-09T18:20:00Z）
- **シーケンス図更新**: 4 → 7 に増加（認証・外部連携・エラーハンドリング追加完了）
- **次回レビュー**: 予選直前（2026-05-28）— Construction成果物の品質チェック

## AWS全体アーキテクチャ図
- **ファイル**: `aidlc-docs/inception/application-design/aws-architecture.md`（作成完了: 2026-05-09T17:30:00Z）
- **形式**: Mermaid
- **内容**: CloudFront / S3 / API Gateway / Lambda / DynamoDB / Cognito / Bedrock / Secrets Manager / EventBridge / CloudWatch の配置と関係性
- **追加情報**: 6つのCDKスタック構成・セキュリティ境界・データフロー・コスト見積り（月額$30.94）

## 特記事項
- ハッカソン書類審査締切: 2026年5月10日
- テーマ: 「人をダメにするサービス」
- AWSリージョン: ap-northeast-1（東京）
