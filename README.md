# SABOROU（サボロー）- サボりの最適解

AWS Summit Japan 2026 ハッカソン応募作品

「今どうサボれば一番うまく逃げ切れるか」を、外部ツール文脈を読んだAIエージェントが提案するサービスです。

## コンセプト

- 表向きの価値: タスクに追われる人の心に余白を作る
- 裏設定（人をダメにする）: タスク整理能力・優先順位判断・危機管理能力・締切感覚をAIに委ね、判断力を徐々に退化させる

## プロダクト概要

- プロダクト正式名: SABOROU
- タグライン: サボりの最適解
- 主要機能:
	- Slack / Gmail / Google Calendar からのタスク候補自動抽出
	- 文脈読解によるサボり判定（can_saboru / caution / danger）
	- おっとりサボロー人格での提案メッセージ生成

## 技術スタック

- フロントエンド: React, TypeScript, Vite, shadcn/ui, Tailwind CSS
- バックエンド: Hono on AWS Lambda, API Gateway HTTP API
- チャット連携: Vercel Chat SDK（chat）
- AI: Amazon Bedrock（Claude Sonnet）, Bedrock AgentCore
- データ: DynamoDB（On-Demand）
- 認証: Amazon Cognito（Google OAuth）
- シークレット管理: AWS Secrets Manager
- インフラ: AWS CDK v2（TypeScript）
- リージョン: ap-northeast-1（東京）

## アーキテクチャ

- フロント配信: CloudFront + S3
- API層: API Gateway + Lambda（Hono）
- エージェント層: TaskExtractorAgent / SaboriProposerAgent
- 非同期連携: EventBridge
- 監視: CloudWatch

詳細図は以下を参照:
- aidlc-docs/inception/application-design/aws-architecture.md

## AI-DLC成果物

一次審査提出ドキュメントは以下に整理しています。

- 要件定義: aidlc-docs/inception/requirements/requirements.md
- ユーザーストーリー: aidlc-docs/inception/user-stories/stories.md
- 実行計画: aidlc-docs/inception/plans/execution-plan.md
- アプリケーション設計: aidlc-docs/inception/application-design/application-design.md
- Unit分解: aidlc-docs/inception/units/unit-of-work.md
- 監査ログ: aidlc-docs/audit.md
- ワークフロー状態: aidlc-docs/aidlc-state.md

## UIモック

- docs/imgs/0.jpg
- docs/imgs/1.jpg
- aidlc-inputs/mockups/

## 開発方針

- TypeScript統一（フロント / バックエンド / IaC）
- サーバーレスファースト（Lambda / API Gateway / DynamoDB）
- 最小権限IAMとシークレット分離（Secrets Manager）
- AI-DLCワークフローに沿った設計・監査記録

## ライセンス

ハッカソン検証用途（PoC）