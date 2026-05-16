# CDK ローカル開発ガイド（Floci 使用）

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-16
**バージョン**: 1.0.0
**対象 Unit**: U-02（infra）および関連全 Unit（U-03a / U-03b / U-04）

---

## 1. 概要

本ガイドでは、Floci（ローカル AWS エミュレーター）を使った CDK スタックのローカル検証ワークフローを説明する。
Floci でローカル検証を完了した後、本番 AWS（ap-northeast-1）へデプロイするという2段階ワークフローを採用する。

**Floci の特徴**:
- Java 25 + Quarkus 3.x 製のローカル AWS エミュレーター（LocalStack 相当）
- ポート 4566 でリッスン
- AWS SDK・CLI・CDK をそのまま向けられる（エンドポイント URL を差し替えるだけ）
- Docker Compose で起動（追加インストール不要）

---

## 2. 前提条件

| ツール | バージョン | 確認コマンド |
|--------|----------|------------|
| Docker Desktop | 最新安定版 | `docker --version` |
| Docker Compose | v2 以降 | `docker compose version` |
| Node.js | 20.x 以上 | `node --version` |
| AWS CDK CLI | v2 | `npx cdk --version` |
| AWS CLI | v2 | `aws --version` |

---

## 3. docker-compose.yml サンプル（Floci 設定）

プロジェクトルート（`AWS-SummitHackathon-2026/`）に以下を配置する。

```yaml
# docker-compose.yml
version: "3.9"

services:
  floci:
    image: floci/floci:latest
    ports:
      - "4566:4566"   # AWS エミュレーター（メインエンドポイント）
      - "4510-4559:4510-4559"  # サービス別ポート範囲
    environment:
      - SERVICES=s3,dynamodb,lambda,apigateway,sqs,events,secretsmanager,iam,cloudformation,logs
      - DEBUG=1
      - AWS_DEFAULT_REGION=ap-northeast-1
      - LAMBDA_EXECUTOR=docker
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - floci-data:/var/lib/localstack
    networks:
      - saborou-local

volumes:
  floci-data:

networks:
  saborou-local:
    driver: bridge
```

---

## 4. CDK スタックを Floci に向けるための設定

### 4.1 環境変数による切り替え

```bash
# Floci（ローカル）へデプロイ
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_DEFAULT_REGION=ap-northeast-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
```

### 4.2 CDK デプロイコマンド（Floci 向け）

```bash
# DataStack（DynamoDB）をFlociへデプロイ
AWS_ENDPOINT_URL=http://localhost:4566 \
AWS_ACCESS_KEY_ID=test \
AWS_SECRET_ACCESS_KEY=test \
npx cdk deploy DataStack --require-approval never

# ApiStack + AgentStack + WebhookStack をFlociへデプロイ
AWS_ENDPOINT_URL=http://localhost:4566 \
AWS_ACCESS_KEY_ID=test \
AWS_SECRET_ACCESS_KEY=test \
npx cdk deploy ApiStack AgentStack WebhookStack --require-approval never
```

### 4.3 AWS CLI を Floci に向ける

```bash
# DynamoDB テーブル一覧確認
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# Lambda 関数一覧確認
aws --endpoint-url=http://localhost:4566 lambda list-functions

# S3 バケット一覧確認
aws --endpoint-url=http://localhost:4566 s3 ls
```

### 4.4 各アプリの .env.local 設定例

```bash
# packages/agent/.env.local（U-03a / U-03b ローカル開発用）
DYNAMO_ENDPOINT=http://localhost:4566
AWS_DEFAULT_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# apps/api/.env.local（U-04 ローカル開発用）
DYNAMO_ENDPOINT=http://localhost:4566
AWS_DEFAULT_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

---

## 5. 各 CDK スタックの Floci サポート状況

### 5.1 DataStack（DynamoDB）— 完全サポート

DynamoDB のテーブル作成・GSI・TTL 設定すべてローカルで検証可能。

```bash
# DataStack をFlociへデプロイ
AWS_ENDPOINT_URL=http://localhost:4566 npx cdk deploy DataStack --require-approval never

# テーブル作成確認
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# GSI 確認
aws --endpoint-url=http://localhost:4566 dynamodb describe-table --table-name saborou-tasks
```

### 5.2 ApiStack（Lambda + API Gateway HTTP API）— 完全サポート

Lambda 関数のデプロイと API Gateway ルーティングをローカルで検証可能。

```bash
# ApiStack をFlociへデプロイ
AWS_ENDPOINT_URL=http://localhost:4566 npx cdk deploy ApiStack --require-approval never

# Lambda 疎通確認
aws --endpoint-url=http://localhost:4566 lambda invoke \
  --function-name saborou-api \
  --payload '{"httpMethod":"GET","path":"/api/tasks"}' \
  response.json

# API Gateway エンドポイント取得
aws --endpoint-url=http://localhost:4566 apigatewayv2 get-apis
```

### 5.3 AgentStack（Lambda + EventBridge + SQS）— 完全サポート

TaskExtractor Lambda / SaboriProposer Lambda の呼び出しと EventBridge ルーティングをローカルで検証可能。

```bash
# AgentStack をFlociへデプロイ
AWS_ENDPOINT_URL=http://localhost:4566 npx cdk deploy AgentStack --require-approval never

# TaskExtractor Lambda 疎通確認
aws --endpoint-url=http://localhost:4566 lambda invoke \
  --function-name saborou-task-extractor \
  --payload '{"slackEvent":{"type":"message","text":"明日の会議資料を準備する"}}' \
  output.json

# EventBridge ルール確認
aws --endpoint-url=http://localhost:4566 events list-rules
```

### 5.4 WebhookStack（Lambda + EventBridge）— 完全サポート

Slack Webhook ハンドラの Lambda デプロイと EventBridge への発行をローカルで検証可能。

```bash
# WebhookStack をFlociへデプロイ
AWS_ENDPOINT_URL=http://localhost:4566 npx cdk deploy WebhookStack --require-approval never

# Webhook Lambda 疎通確認（Slack からの challenge 応答テスト）
aws --endpoint-url=http://localhost:4566 lambda invoke \
  --function-name saborou-slack-webhook \
  --payload '{"type":"url_verification","challenge":"test_challenge"}' \
  output.json
```

### 5.5 CognitoStack（User Pool + Google IdP）— 限定サポート

Floci では Cognito エミュレーションが限定的。認証テストは以下のいずれかで対応する。

**推奨代替手段**:
- **Cognito Local** (`cognito-local` npm パッケージ): User Pool のローカルエミュレーター
- **本番 Cognito User Pool（dev 環境）** を使用して認証フローをテスト
- ローカル開発では JWT を固定値でモックし、AuthMiddleware をバイパスするテストモードを実装

```bash
# Cognito Local のセットアップ（代替手段）
npx cognito-local start --port 9229
export COGNITO_ENDPOINT=http://localhost:9229
```

### 5.6 FrontendStack（S3 + CloudFront）— 部分サポート

S3 バケット作成・ファイルアップロードは Floci でサポート。CloudFront は本番 AWS のみ。

**Floci で検証可能な内容**:
- S3 バケット作成確認
- `aws s3 sync dist/ s3://saborou-frontend-local` でのアップロード確認

**CloudFront の代替（ローカル開発）**:
- `vite dev` サーバー（ポート 5173）でフロントエンドをローカル確認
- CloudFront は本番 AWS デプロイ後に確認

---

## 6. 推奨ワークフロー（CDK ローカル検証 → 本番デプロイ）

```
ステップ 1: Floci 起動
  $ docker compose up -d
  # Floci が http://localhost:4566 でリッスン開始

ステップ 2: CDK テンプレート検証
  $ npx cdk synth
  # 全スタックの CloudFormation テンプレート生成・構文チェック

ステップ 3: DataStack をFlociへデプロイ（DynamoDB 検証）
  $ AWS_ENDPOINT_URL=http://localhost:4566 npx cdk deploy DataStack --require-approval never
  # DynamoDB テーブル・GSI が正しく作成されることを確認

ステップ 4: Lambda / API GW スタックをFlociへデプロイ
  $ AWS_ENDPOINT_URL=http://localhost:4566 npx cdk deploy ApiStack AgentStack WebhookStack --require-approval never
  # Lambda 疎通・API Gateway ルーティングを確認

ステップ 5: 統合テスト実行
  $ npm run test:integration
  # Floci 上の DynamoDB / Lambda を使った統合テストを実行

ステップ 6: Floci 停止
  $ docker compose down

ステップ 7: 本番 AWS へデプロイ
  $ npx cdk deploy --all --require-approval never
  # ローカル検証が済んだスタックを本番 ap-northeast-1 へデプロイ
```

---

## 7. カットライン判断

Floci でのローカル検証が困難な場合は、以下の代替手段で対応する。

| 状況 | カットライン（代替手段） |
|------|----------------------|
| Floci が起動しない / コンテナエラー | `cdk synth` のみで CloudFormation テンプレート検証を実施 |
| Lambda が Floci 上で動作しない | `sam local start-api` に切り替えてローカルエミュレーション |
| DynamoDB 接続エラー | DynamoDB Local（公式 Docker イメージ）に切り替え |
| 時間制約でローカル検証をスキップ | `cdk diff` で変更差分確認後、直接 AWS dev 環境へデプロイ |

---

## 8. 検証コマンド一覧

```bash
# CDK テンプレート生成・検証
npx cdk synth

# 既存スタックとの差分確認
npx cdk diff

# Floci へのローカルデプロイ（DataStack）
AWS_ENDPOINT_URL=http://localhost:4566 npx cdk deploy DataStack --require-approval never

# Floci へのローカルデプロイ（Lambda 系スタック）
AWS_ENDPOINT_URL=http://localhost:4566 npx cdk deploy ApiStack AgentStack WebhookStack --require-approval never

# 本番 AWS へのデプロイ（全スタック）
npx cdk deploy --all --require-approval never

# 本番 AWS へのデプロイ（スタック順序指定）
npx cdk deploy CognitoStack && \
npx cdk deploy DataStack && \
npx cdk deploy ApiStack && \
npx cdk deploy AgentStack WebhookStack && \
npx cdk deploy FrontendStack

# スタック全破棄（本番環境での実行は要注意）
npx cdk destroy --all
```

---

## 9. 参照文書

| 文書 | パス |
|------|------|
| Unit-of-Work（U-02 infra） | `aidlc-docs/inception/units/unit-of-work.md` |
| AWSアーキテクチャ設計 | `aidlc-docs/inception/application-design/aws-architecture.md` |
| CDK操作ガイド（Operations） | `aidlc-docs/operations/cdk-operations.md` |
| Well-Architected レビュー | `aidlc-docs/inception/application-design/well-architected-review.md` |

---

*本文書は Application Design ステージの補足ガイドです（Floci統合 v1.0.0 追加: 2026-05-16）。*
