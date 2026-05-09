# AI-DLC 状態管理

## プロジェクト情報
- **プロジェクト名**: サボロー（AWS Summit Japan 2026 ハッカソン）
- **プロジェクトタイプ**: Greenfield（新規）
- **開始日時**: 2026-05-09T07:00:00Z
- **現在のステージ**: INCEPTION フェーズ 完了（Units Generation 完了 — Construction 承認待ち）

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
- [ ] Functional Design（EXECUTE — 各Unit）
- [ ] NFR Requirements（EXECUTE — 各Unit）
- [ ] NFR Design（EXECUTE — 各Unit）
- [ ] Infrastructure Design（EXECUTE — 各Unit）
- [ ] Code Generation（EXECUTE — 各Unit・必須）
- [ ] Build and Test（EXECUTE — 全Unit完了後・必須）

### OPERATIONS フェーズ
- [ ] Operations（プレースホルダー）

## Extension 設定
- **Security Baseline**: 無効（Q23=B — PoC・プロトタイプ扱い。基本セキュリティは実装する）
- **Property-Based Testing**: 無効（Q24=C — シンプルな CRUD・統合レイヤーが主）

## Execution Plan Summary（Workflow Planning 完了）

- **実行計画書**: `aidlc-docs/inception/plans/execution-plan.md`（完了）
- **総合リスクレベル**: Medium-High（外部API 3連携 / Bedrock AgentCore 新興性 / 時間制約）
- **推奨実装順序**: shared → infra → agent → api → web
- **実行ステージ数**: Inception 残り2 + Construction 6 × Unit数 = 合計 8〜14 ステージ
- **スキップステージ**: Reverse Engineering（Greenfield のため）/ Operations（プレースホルダー）/ Security Baseline Extension（無効）/ Property-Based Testing Extension（無効）
- **マイルストーン**:
  - M1: 書類審査（2026-05-10）— 4成果物提出
  - M2: MVP デモ（2026-05-30）— 動作する MVP
  - M3: 決勝（2026-06-26）— AWS デプロイ済み完成品

## User Stories 成果物
- **personas.md**: `aidlc-docs/inception/user-stories/personas.md`（完了）— プライマリペルソナ1名（34歳・フリーランスデザイナー）の詳細定義
- **stories.md**: `aidlc-docs/inception/user-stories/stories.md`（完了）— Epic 5件・ストーリー17件（MUST: 15 / SHOULD: 2）
- **demo-stories.md**: `aidlc-docs/inception/user-stories/demo-stories.md`（完了）— 5分デモシナリオ（審査員向け）
- **future-stories.md**: `aidlc-docs/inception/user-stories/future-stories.md`（完了）— 将来展望ストーリー4件（MVP スコープ外）
- **Epic 数**: 5（E-01〜E-05）
- **Story 数**: 17（US-01〜US-17）

## Requirements Analysis 成果物
- **requirements.md**: `aidlc-docs/inception/requirements/requirements.md`（完了）
- **requirement-verification-questions.md**: `aidlc-docs/inception/requirements/requirement-verification-questions.md`（完了・24問全回答）
- **FR 件数**: 8件（FR-01〜FR-08）
- **NFR 件数**: 11件（NFR-01〜NFR-11）

## 入力資料
以下のファイルが aidlc-inputs/ に配置済み:
- `README.md` - プロジェクト概要
- `00-business-brief.md` - サボロー企画書（モック反映済み）
- `01-tech-stack-decisions.md` - 技術スタック方針
- `02-development-policy.md` - 開発ポリシー
- `03-aws-architecture-policy.md` - AWSアーキテクチャ方針
- `mockups/01-task-list.png` / `02-task-detail-chat.png` / `README.md` - ビジネス側提供のUIモック

## Units Generation 成果物
- **unit-of-work.md**: `aidlc-docs/inception/units/unit-of-work.md`（完了）
- **unit-dependencies.md**: `aidlc-docs/inception/units/unit-dependencies.md`（完了）
- **unit-story-map.md**: `aidlc-docs/inception/units/unit-story-map.md`（完了）
- **Unit 数**: 5（U-01: shared / U-02: infra / U-03: agent / U-04: api / U-05: web）
- **実装順序**: shared → infra → agent → api → web
- **規模**: S（U-01）/ M（U-02）/ L（U-03）/ L（U-04）/ M（U-05）
- **次ステージ**: CONSTRUCTION フェーズ — U-01: shared から開始
- **INCEPTION フェーズ完了**: 2026-05-09T15:00:00Z

## Application Design 成果物
- **application-design.md**: `aidlc-docs/inception/application-design/application-design.md`（完了）
- **components.md**: `aidlc-docs/inception/application-design/components.md`（完了）
- **component-methods.md**: `aidlc-docs/inception/application-design/component-methods.md`（完了）
- **services.md**: `aidlc-docs/inception/application-design/services.md`（完了）
- **component-dependency.md**: `aidlc-docs/inception/application-design/component-dependency.md`（完了）
- **コンポーネント総数**: 24（フロントエンド: 8 / バックエンド: 6 / エージェント: 4 / インフラ: 6）
- **DynamoDB テーブル数**: 6（Users / ServiceConnections / TaskCandidates / Tasks / Proposals / HonneData / Personas = 7テーブル）
- **API エンドポイント数**: 14
- **シーケンス図数**: 4（タスク自動抽出 / サボり提案生成 / 本音データ記録 / バックグラウンド再評価）
- **想定 Unit 数**: 5（shared → infra → agent → api → web）

## 特記事項
- ハッカソン書類審査締切: 2026年5月10日
- テーマ: 「人をダメにするサービス」
- AWSリージョン: ap-northeast-1（東京）
