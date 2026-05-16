# OPERATIONS フェーズ — 索引

**プロジェクト名**: SABOROU（サボロー）
**バージョン**: v1.0.0
**作成日**: 2026-05-16
**対象イベント**: AWS Summit Japan 2026 ハッカソン（予選: 2026-05-30）

---

## 概要

本フォルダは SABOROU プロジェクトの OPERATIONS フェーズ成果物を格納する。
各ガイドは CDK インフラ・バックエンド（Hono on Lambda）・フロントエンド（React + Vite）の
ローカル開発・デプロイ・監視・トラブルシューティング手順を日本語で記載する。

---

## ガイド一覧

| ガイド | ファイル | 概要 |
|--------|---------|------|
| CDK操作ガイド | [cdk-operations.md](./cdk-operations.md) | CDKスタックのブートストラップ・Flociローカル検証・本番デプロイ・スタック破棄手順 |
| バックエンド操作ガイド | [backend-operations.md](./backend-operations.md) | Hono on Lambda のローカル開発・Lambda デプロイ確認・CloudWatch ログ確認手順 |
| フロントエンド操作ガイド | [frontend-operations.md](./frontend-operations.md) | React + Vite のローカル開発・ビルド・S3 + CloudFront デプロイ手順 |

---

## プロジェクト技術スタック

| レイヤー | 技術 |
|---------|------|
| IaC | AWS CDK v2 (TypeScript) 2.232.1 — `pkgs/cdk/` |
| バックエンド | Hono on Lambda 4.12.19 — `pkgs/backend/` |
| エージェント | Bedrock converse API + Tool Use — `pkgs/agent/`（Construction フェーズで作成）|
| フロントエンド | React 19.2.6 + Vite 8.0.12 + shadcn/ui + Three.js — `pkgs/frontend/` |
| パッケージマネージャー | pnpm 10.33.0 (workspaces) |
| Node.js | v23（.nvmrc） |
| コード品質 | Biome 1.9.4（フォーマッター + リンター）|
| DB | DynamoDB On-Demand（7テーブル） |
| AI | Claude Sonnet（anthropic.claude-3-5-sonnet-20241022-v2:0） |
| 認証 | Amazon Cognito + Google ソーシャルログイン |
| 連携 | Slack Events API + Webhook |
| ローカルエミュレーター | Floci（Java 25 + Quarkus 3.x、ポート4566） |
| リージョン | ap-northeast-1（東京） |

---

## CDK スタック構成（6スタック）

| スタック | 責務 |
|---------|------|
| CognitoStack | User Pool + Google IdP |
| DataStack | DynamoDB 7テーブル |
| ApiStack | API Gateway HTTP API + Hono Lambda |
| AgentStack | TaskExtractor / SaboriProposer / BackgroundRefresh Lambda + EventBridge + DLQ |
| WebhookStack | Slack Webhook Lambda + EventBridge |
| FrontendStack | S3 + CloudFront |

---

## モノレポ構成

```
AWS-SummitHackathon-2026/
├── pkgs/
│   ├── shared/           # 型定義・共通ユーティリティ（Construction フェーズで作成）
│   ├── agent/            # Bedrock エージェント実装（Construction フェーズで作成）
│   ├── backend/          # Hono on Lambda（ベース実装済み）
│   ├── frontend/         # React + Vite フロントエンド（ベース実装済み）
│   └── cdk/              # AWS CDK スタック（ベース実装済み）
├── docker-compose.yml    # Floci（ローカル AWS エミュレーター）
├── pnpm-workspace.yaml   # pnpm workspaces ルート（pnpm@10.33.0）
└── package.json          # ルート設定
```

---

## 関連文書

| 文書 | パス |
|------|------|
| CDK ローカル開発ガイド（Floci） | `aidlc-docs/inception/application-design/cdk-local-development.md` |
| AWS アーキテクチャ設計 | `aidlc-docs/inception/application-design/aws-architecture.md` |
| Well-Architected レビュー | `aidlc-docs/inception/application-design/well-architected-review.md` |
| Unit-of-Work 定義書 | `aidlc-docs/inception/units/unit-of-work.md` |

---

*本文書は AI-DLC OPERATIONS フェーズの成果物です（v1.0.0 作成: 2026-05-16）。*
