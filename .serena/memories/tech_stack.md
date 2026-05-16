# 技術スタック（2026-05-16 確定版）

## 確定済み技術スタック

### 言語・ランタイム
- **TypeScript** (全パッケージ共通)
- **Node.js 20** (Lambda ランタイム)
- **OS**: macOS (Darwin)

### バックエンド (pkgs/backend)
- **Hono ^4.12.19**: Web フレームワーク（Lambda + ローカル両対応）
- **@hono/node-server ^2.0.2**: ローカル開発サーバー
- **@hono/swagger-ui ^0.6.1**: Swagger UI 提供
- **esbuild ^0.21.4**: Lambda 向けバンドル
- **tsx ^4.22.0**: ローカル開発用 TypeScript 実行
- **vitest ^4.1.6**: ユニットテスト
- **tsconfig**: ESNext + Bundler moduleResolution + jsxImportSource: "hono/jsx"

### フロントエンド (pkgs/frontend)
- **React ^19.2.6** + **react-dom ^19.2.6**
- **Vite ^8.0.12**: ビルドツール（@vitejs/plugin-react ^6.0.1）
- **TypeScript ~6.0.2**
- **vitest ^4.1.6**: ユニットテスト
- **@playwright/test ^1.60.0**: E2Eテスト
- ※ shadcn/ui と Three.js は Construction フェーズで追加予定

### インフラ (pkgs/cdk)
- **aws-cdk-lib 2.232.1** + **aws-cdk 2.1100.1**
- **constructs ^10.0.0**
- **TypeScript ~5.9.3**
- **jest ^29.7.0** + **ts-jest ^29.2.5**: CDK テスト

### モノレポ管理
- **pnpm ^10.33.0** + **pnpm-workspace.yaml**
- **@biomejs/biome ^1.9.4**: フォーマット + Lint

### AWS サービス（設計済み、未デプロイ）
- **Lambda**: 全バックエンド処理（Hono handler + Agent Lambda）
- **API Gateway HTTP API**: REST API エンドポイント
- **DynamoDB On-Demand**: データ永続化（Tasks / Proposals / Personas テーブル）
- **S3 + CloudFront**: フロントエンドホスティング
- **Cognito**: 認証（ユーザープール）
- **Amazon Bedrock**: Claude Sonnet (claude-3-5-sonnet) + converse API + Tool Use
- **Secrets Manager**: OAuth トークン管理（Slack）
- **EventBridge**: エージェント間非同期連携 + Scheduler（定期再評価）
- **CloudWatch**: モニタリング・アラート
- **リージョン**: ap-northeast-1（東京）

### 外部連携（v1.0 スコープ）
- **Slack API**: タスク抽出元（Slack OAuth + Webhook）
- ※ Gmail / Google Calendar は v1.1.0 スコープ（予選外）

### AIワークフロー
- AI-DLC with Claude / GitHub Copilot
- CodeRabbit（日本語PR自動レビュー）

## MCPサーバー（.vscode/mcp.json）
- serena, oraios/serena: コードナビゲーション
- context7: ライブラリドキュメント取得
- awslabs aws-d: AWSアーキテクチャ図生成
- chromedevtool: ブラウザ操作
- deepwiki: Wiki検索
- pencil: デザインツール
- sequential-thinking: 思考支援
- aws-mcp: AWS API 直接操作
