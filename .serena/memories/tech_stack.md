# 技術スタック（2026-05-23 更新版）

最終更新: 2026-05-23

## 確定済み技術スタック

### 言語・ランタイム
- **TypeScript** (全パッケージ共通)
- **Node.js 23** (`.nvmrc` 参照。Lambda ランタイム: nodejs22.x)
- **OS**: macOS (Darwin)

### 共有パッケージ (pkgs/shared)
- 共有型・ユーティリティ（ESM/CJS/DTS ビルド）
- **tsup** でビルド
- **vitest**: ユニットテスト（93テスト全パス・カバレッジ100%）

### エージェント (pkgs/agent)
- **Amazon Bedrock Converse API + Tool Use**: claude-3-5-sonnet / Haiku
- TaskExtractorAgent + SaboriProposerAgent の2エージェント協調
- **IBedrockClient インタフェース**でテスト可能な設計
- **vitest**: ユニットテスト（104テスト全パス）
- **tsup** でESM/CJS/DTS ビルド

### バックエンド (pkgs/backend)
- **Hono ^4.x**: Web フレームワーク（Lambda + ローカル両対応）
- **Slack OAuth + Webhook**: HMAC-SHA256 署名検証
- **Zod**: バリデーション
- **esbuild**: Lambda 向けバンドル（ARM64 最適化）
- **Secrets Manager キャッシュ** (TTL=5分)
- **vitest**: ユニットテスト（172テスト全パス）
- 2エントリーポイント: `dist/index.js` (API) / `dist/webhook.js` (Slack Webhook)

### フロントエンド (pkgs/frontend)
- **React ^19.2.6** + **react-dom ^19.2.6**
- **Vite**: ビルドツール
- **Tailwind CSS v4** (@theme / @utility 設定)
- **Three.js**: 3Dキャラクター（SaborouCharacter3D / SaborouScene3D）
  - Three.js は別チャンク分離（初期バンドル 219KB / Three.js gzip 249KB）
- **react-three-fiber / @react-three/drei**: Three.js React統合
- **shadcn/ui**: UIコンポーネント
- **react-i18next**: 多言語対応（pkgs/frontend/src/i18n.ts）
- **PWA**: service worker / manifest（public/mockServiceWorker.js）
- **ErrorBoundary**: コンポーネント実装済み
- **vitest**: ユニットテスト（126テスト全パス）
- **@playwright/test**: E2Eテスト（tests/e2e.spec.ts）
- ネオブルータリズム UI デザイン

### インフラ (pkgs/cdk)
- **aws-cdk-lib 2.232.1** + **aws-cdk 2.1100.1**
- **constructs ^10.0.0**
- **cdk-nag**: セキュリティルール検査（AwsSolutionsChecks）
- **jest + ts-jest**: CDK テスト（35テスト全パス）
- 6スタック構成（DataStack / StorageStack / CognitoStack / ApiStack / AgentStack / FrontendStack）

### モノレポ管理
- **pnpm ^10.33.0** + **pnpm-workspace.yaml**
- **@biomejs/biome ^1.9.4**: フォーマット + Lint

### AWS サービス（実装済み・デプロイ対象）
- **Lambda**: 全バックエンド処理（ARM64 / Amazon Linux 2023）
  - API Lambda (Hono)
  - Webhook Lambda (Slack Webhook受信)
  - Agent Lambda (Bedrock Agent)
- **API Gateway HTTP API**: REST API
- **Lambda Function URL**: SSE ストリーミング（Response Streaming）
- **DynamoDB On-Demand**: 8テーブル（Users / ServiceConnections / TaskCandidates / Tasks / TaskOrganization / Proposals / HonneData / Personas）
- **S3 + CloudFront**: フロントエンドホスティング（OAC設定）
- **Cognito**: 認証（ユーザープール + Slack OAuth）
- **Amazon Bedrock**: claude-3-5-sonnet（TaskExtractor）+ claude-3-haiku（SaboriProposer）
- **Secrets Manager**: OAuth トークン・APIキー管理
- **EventBridge**: エージェント間非同期連携
- **CloudWatch**: モニタリング・アラート
- **SSM Parameter Store**: OAuth State Secret
- **リージョン**: ap-northeast-1（東京）

### 外部連携
- **Slack API**: タスク抽出元（Slack OAuth + Webhook）
  - HMAC-SHA256 署名検証実装済み
  - `scripts/register_slack_secret.sh` でシークレット登録
- ※ Gmail / Google Calendar は v1.1.0 スコープ（予選外）

### MCPサーバー（.vscode/mcp.json）
- serena, oraios/serena: コードナビゲーション
- context7: ライブラリドキュメント取得
- awslabs aws-d: AWSアーキテクチャ図生成
- chromedevtool: ブラウザ操作
- deepwiki: Wiki検索
- pencil: デザインツール（.pen ファイル）
- sequential-thinking: 思考支援
- aws-mcp: AWS API 直接操作
