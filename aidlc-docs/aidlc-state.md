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
- **推奨実装順序**: shared → infra → task-extractor → sabori-proposer → api → web
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
- **DynamoDB テーブル数**: 7（Users / ServiceConnections / TaskCandidates / Tasks / TaskOrganization★新規 / Proposals / HonneData / Personas = 8テーブル）
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
