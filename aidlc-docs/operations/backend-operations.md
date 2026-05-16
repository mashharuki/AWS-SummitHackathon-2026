# バックエンド操作ガイド（Lambda / Hono API）

**プロジェクト名**: SABOROU（サボロー）
**バージョン**: v1.0.0
**作成日**: 2026-05-16
**対象**: U-03a（task-extractor）/ U-03b（sabori-proposer）/ U-04（api） / `packages/agent/` / `apps/api/`

---

## 1. ローカル開発環境セットアップ

### 1.1 モノレポ構造

```
AWS-SummitHackathon-2026/
├── packages/
│   ├── shared/     # 型定義・共通ユーティリティ（U-01）
│   └── agent/      # Bedrock エージェント実装（U-03a / U-03b）
│       ├── src/
│       │   ├── agents/
│       │   │   ├── task-extractor.ts     # AG-01: TaskExtractorAgent
│       │   │   └── sabori-proposer.ts    # AG-02: SaboriProposerAgent
│       │   ├── bedrock/
│       │   │   └── client.ts             # IBedrockClient + ConverseBedrockClient
│       │   ├── renderer/
│       │   │   └── persona-renderer.ts   # AG-03: PersonaRenderer
│       │   └── collector/
│       │       └── context-collector.ts  # AG-04: ContextCollector
│       └── handlers/
│           ├── task-extractor.handler.ts
│           ├── sabori-proposer.handler.ts
│           └── background-refresh.handler.ts
└── apps/
    └── api/        # Hono on Lambda（U-04）
        ├── src/
        │   ├── app.ts               # Hono アプリ定義
        │   ├── routes/
        │   │   ├── tasks.ts         # BE-02: TaskHandler
        │   │   ├── proposals.ts     # BE-03: ProposalHandler（SSE）
        │   │   ├── honne.ts         # BE-04: HonneHandler
        │   │   └── connections.ts   # BE-05: ConnectionHandler
        │   ├── repositories/
        │   │   ├── task.repository.ts
        │   │   ├── proposal.repository.ts
        │   │   └── honne.repository.ts
        │   └── middleware/
        │       ├── auth.ts          # BE-01: AuthHandler（JWT検証）
        │       └── error.ts         # 統一エラーハンドリング
        └── handler.ts               # Lambda エントリポイント
```

### 1.2 依存関係インストール

```bash
# プロジェクトルートで実行（全パッケージ）
npm install

# 特定パッケージのみ
cd packages/agent && npm install
cd apps/api && npm install
```

### 1.3 TypeScript ビルド確認

```bash
# 全パッケージのビルド確認
npm run build --workspaces

# 特定パッケージのみ
cd packages/shared && npx tsc --noEmit
cd packages/agent && npx tsc --noEmit
cd apps/api && npx tsc --noEmit
```

---

## 2. .env.local 設定

### 2.1 packages/agent/.env.local（Floci 接続設定）

```bash
# Floci ローカル DynamoDB
DYNAMO_ENDPOINT=http://localhost:4566
AWS_DEFAULT_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# Bedrock（ローカルテスト時はモック使用のため空でも可）
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_MAX_TOKENS=8000

# DynamoDB テーブル名
TASK_CANDIDATES_TABLE=saborou-task-candidates-dev
TASKS_TABLE=saborou-tasks-dev
PROPOSALS_TABLE=saborou-proposals-dev
HONNE_DATA_TABLE=saborou-honne-data-dev
PERSONAS_TABLE=saborou-personas-dev
```

### 2.2 apps/api/.env.local（Floci 接続設定）

```bash
# Floci ローカル DynamoDB
DYNAMO_ENDPOINT=http://localhost:4566
AWS_DEFAULT_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# 認証（ローカルテストではモック or Cognito Local を使用）
COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=ap-northeast-1

# Bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Slack（Webhook 署名検証）
SLACK_SIGNING_SECRET=your_slack_signing_secret

# Lambda 関数名（ローカル Lambda invoke 設定）
TASK_EXTRACTOR_LAMBDA=saborou-task-extractor-dev
SABORI_PROPOSER_LAMBDA=saborou-sabori-proposer-dev

# DynamoDB テーブル名
TASK_CANDIDATES_TABLE=saborou-task-candidates-dev
TASKS_TABLE=saborou-tasks-dev
PROPOSALS_TABLE=saborou-proposals-dev
HONNE_DATA_TABLE=saborou-honne-data-dev
PERSONAS_TABLE=saborou-personas-dev
USERS_TABLE=saborou-users-dev
SERVICE_CONNECTIONS_TABLE=saborou-service-connections-dev
```

---

## 3. Lambda ローカル実行

### 3.1 Floci を使ったローカル統合テスト（推奨）

```bash
# Floci 起動
docker compose up -d

# CDK で Lambda をFlociへデプロイ（AgentStack / ApiStack）
cd infra
AWS_ENDPOINT_URL=http://localhost:4566 \
npx cdk deploy AgentStack ApiStack --require-approval never

# TaskExtractor Lambda を Floci 上で invoke
aws --endpoint-url=http://localhost:4566 lambda invoke \
  --function-name saborou-task-extractor-dev \
  --payload '{"slackEvent":{"type":"message","text":"明日の会議資料を準備する","user":"U123"}}' \
  output.json
cat output.json

# Hono API Lambda を Floci 上で invoke
aws --endpoint-url=http://localhost:4566 lambda invoke \
  --function-name saborou-api-dev \
  --payload '{"httpMethod":"GET","path":"/api/tasks","headers":{"Authorization":"Bearer mock-token"}}' \
  response.json
cat response.json
```

### 3.2 SAM Local を使ったローカル実行（代替手段）

SAM Local は Lambda + API Gateway の統合エミュレーターとして使用できる。

```bash
# SAM Local インストール（未インストールの場合）
brew install aws-sam-cli  # macOS

# SAM Local でAPIサーバー起動（Flociの DynamoDB に向ける）
cd apps/api
DYNAMO_ENDPOINT=http://localhost:4566 sam local start-api \
  --port 3001 \
  --env-vars .env.local

# curl でエンドポイント確認
curl -X GET http://localhost:3001/api/tasks \
  -H "Authorization: Bearer mock-token"
```

### 3.3 Slack Webhook のローカルテスト

Slack からの Webhook 受信をローカルでテストする場合は ngrok 等でトンネルを設定する。

```bash
# ngrok でローカルポート 3001 をパブリック URL に公開
ngrok http 3001

# ngrok が発行したURL（例: https://xxxx.ngrok.io）を
# Slack アプリ設定の Event Subscriptions URL に設定する

# Slack 署名検証テスト（手動）
TIMESTAMP=$(date +%s)
SIGNATURE_BASE="v0:${TIMESTAMP}:{\"type\":\"url_verification\",\"challenge\":\"test\"}"
SIGNING_SECRET="your_slack_signing_secret"
SIGNATURE="v0=$(echo -n "$SIGNATURE_BASE" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" | cut -d ' ' -f 2)"
curl -X POST http://localhost:3001/webhooks/slack \
  -H "Content-Type: application/json" \
  -H "X-Slack-Request-Timestamp: $TIMESTAMP" \
  -H "X-Slack-Signature: $SIGNATURE" \
  -d '{"type":"url_verification","challenge":"test"}'
```

---

## 4. ユニットテスト実行

```bash
# 全テスト実行（プロジェクトルートから）
npm run test --workspaces

# packages/agent のみ
cd packages/agent && npm run test

# apps/api のみ
cd apps/api && npm run test

# カバレッジ付き
cd packages/agent && npm run test -- --coverage

# 特定テストファイルのみ
cd packages/agent && npx vitest run src/agents/task-extractor.test.ts
```

---

## 5. Lambda デプロイ確認（CloudWatch Logs）

### 5.1 API Lambda のログ確認

```bash
# リアルタイムログ確認
aws logs tail /aws/lambda/saborou-api-dev \
  --follow \
  --region ap-northeast-1

# 過去1時間のログ確認
aws logs tail /aws/lambda/saborou-api-dev \
  --since 1h \
  --region ap-northeast-1

# エラーログのみ抽出
aws logs filter-log-events \
  --log-group-name /aws/lambda/saborou-api-dev \
  --filter-pattern "ERROR" \
  --region ap-northeast-1
```

### 5.2 TaskExtractor Lambda のログ確認

```bash
aws logs tail /aws/lambda/saborou-task-extractor-dev \
  --follow \
  --region ap-northeast-1
```

### 5.3 SaboriProposer Lambda のログ確認

```bash
aws logs tail /aws/lambda/saborou-sabori-proposer-dev \
  --follow \
  --region ap-northeast-1
```

### 5.4 Webhook Lambda のログ確認

```bash
aws logs tail /aws/lambda/saborou-slack-webhook-dev \
  --follow \
  --region ap-northeast-1
```

---

## 6. Bedrock 動作確認

### 6.1 モデルアクセス確認

```bash
# 利用可能なモデル一覧確認
aws bedrock list-foundation-models \
  --region ap-northeast-1 \
  --query 'modelSummaries[?contains(modelId, `claude`)].[modelId,modelName]' \
  --output table
```

### 6.2 converse API の疎通テスト

```bash
# converse API でシンプルなメッセージ送受信テスト
aws bedrock-runtime converse \
  --model-id anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --messages '[{"role":"user","content":[{"text":"サボっても大丈夫なタスクを1つ教えてください"}]}]' \
  --region ap-northeast-1 \
  --output json | jq '.output.message.content[0].text'
```

### 6.3 Tool Use（converse API）の疎通テスト

```bash
# Tool Use を使ったタスク抽出テスト
aws bedrock-runtime converse \
  --model-id anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --messages '[{"role":"user","content":[{"text":"明日の会議資料を準備する、レポートを提出する、コーヒーを買う"}]}]' \
  --tool-config '{
    "tools": [{
      "toolSpec": {
        "name": "extract_task_candidates",
        "description": "テキストからタスク候補を抽出する",
        "inputSchema": {
          "json": {
            "type": "object",
            "properties": {
              "tasks": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "title": {"type": "string"},
                    "priority": {"type": "string", "enum": ["high","medium","low"]}
                  }
                }
              }
            }
          }
        }
      }
    }]
  }' \
  --region ap-northeast-1 \
  --output json | jq '.output'
```

---

## 7. 環境変数一覧（全Lambda共通）

| 環境変数 | 説明 | 設定箇所 |
|---------|------|---------|
| `DYNAMO_ENDPOINT` | DynamoDB エンドポイント URL（Floci: `http://localhost:4566`、本番: 設定不要） | `.env.local` / Lambda 環境変数 |
| `AWS_DEFAULT_REGION` | AWS リージョン（`ap-northeast-1`） | `.env.local` / Lambda 環境変数 |
| `COGNITO_USER_POOL_ID` | Cognito ユーザープール ID | Secrets Manager / Lambda 環境変数 |
| `COGNITO_CLIENT_ID` | Cognito アプリクライアント ID | Lambda 環境変数 |
| `BEDROCK_MODEL_ID` | Bedrock モデル ID | Lambda 環境変数 |
| `SLACK_SIGNING_SECRET` | Slack 署名シークレット（Webhook 検証用） | Secrets Manager |
| `TASK_EXTRACTOR_LAMBDA` | TaskExtractor Lambda 関数名 | Lambda 環境変数 |
| `SABORI_PROPOSER_LAMBDA` | SaboriProposer Lambda 関数名 | Lambda 環境変数 |
| `TASK_CANDIDATES_TABLE` | TaskCandidates DynamoDB テーブル名 | Lambda 環境変数 |
| `TASKS_TABLE` | Tasks DynamoDB テーブル名 | Lambda 環境変数 |
| `PROPOSALS_TABLE` | Proposals DynamoDB テーブル名 | Lambda 環境変数 |
| `HONNE_DATA_TABLE` | HonneData DynamoDB テーブル名 | Lambda 環境変数 |
| `PERSONAS_TABLE` | Personas DynamoDB テーブル名 | Lambda 環境変数 |
| `USERS_TABLE` | Users DynamoDB テーブル名 | Lambda 環境変数 |
| `SERVICE_CONNECTIONS_TABLE` | ServiceConnections DynamoDB テーブル名 | Lambda 環境変数 |

---

## 8. 関連文書

| 文書 | パス |
|------|------|
| CDK 操作ガイド | `aidlc-docs/operations/cdk-operations.md` |
| CDK ローカル開発ガイド（Floci） | `aidlc-docs/inception/application-design/cdk-local-development.md` |
| Unit-of-Work（U-03a / U-03b / U-04） | `aidlc-docs/inception/units/unit-of-work.md` |
| AWS アーキテクチャ設計 | `aidlc-docs/inception/application-design/aws-architecture.md` |

---

*本ガイドは AI-DLC OPERATIONS フェーズの成果物です（v1.0.0 作成: 2026-05-16）。*
