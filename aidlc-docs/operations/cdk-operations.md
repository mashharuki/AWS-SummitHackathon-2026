# CDK スタック操作ガイド

**プロジェクト名**: SABOROU（サボロー）
**バージョン**: v1.0.0
**作成日**: 2026-05-16
**対象**: U-02（infra）/ `pkgs/cdk/` ディレクトリ

---

## 1. 前提条件

### 必要ツール

| ツール | バージョン | インストール確認 |
|--------|----------|--------------|
| Node.js | 20.x 以上 | `node --version` |
| AWS CDK CLI | v2 | `npm install -g aws-cdk && cdk --version`（または `pnpm add -g aws-cdk`）|
| AWS CLI | v2 | `aws --version` |
| Docker Desktop | 最新安定版 | `docker --version` |
| TypeScript | 5.x | プロジェクトに含まれる |

### 必要な AWS 権限（IAM）

CDK デプロイには以下の権限が必要。本番環境では IAM Identity Center を使用することを推奨。

```
- cloudformation:* （スタック管理）
- s3:* （CDK アセット保存 + FrontendStack）
- lambda:* （AgentStack / ApiStack / WebhookStack）
- dynamodb:* （DataStack）
- apigateway:* （ApiStack）
- cognito-idp:* （CognitoStack）
- events:* （AgentStack / WebhookStack）
- sqs:* （AgentStack DLQ）
- cloudfront:* （FrontendStack）
- iam:* （各 Lambda ロール作成）
- secretsmanager:* （Secrets Manager 参照）
- cloudwatch:* （アラーム設定）
- bedrock:* （エージェント Lambda のモデルアクセス）
```

---

## 2. 環境変数設定

```bash
# AWS リージョン・アカウント設定
export AWS_REGION=ap-northeast-1
export AWS_ACCOUNT_ID=123456789012        # 実際のアカウントIDに変更
export CDK_DEFAULT_ACCOUNT=$AWS_ACCOUNT_ID
export CDK_DEFAULT_REGION=ap-northeast-1

# 環境ラベル（dev / prod）
export SABOROU_ENV=dev

# Floci ローカル開発時（本番デプロイ時は設定しない）
# export AWS_ENDPOINT_URL=http://localhost:4566
# export AWS_ACCESS_KEY_ID=test
# export AWS_SECRET_ACCESS_KEY=test
```

---

## 3. CDK ブートストラップ

**初回のみ実施**。CDK が使用する S3 バケット・IAM ロールを AWS アカウントに作成する。

```bash
cd pkgs/cdk

# ブートストラップ（初回のみ）
pnpm exec cdk bootstrap aws://$AWS_ACCOUNT_ID/ap-northeast-1

# ブートストラップ状態確認
aws cloudformation describe-stacks --stack-name CDKToolkit --region ap-northeast-1
```

---

## 4. ローカル検証（Floci 使用）

本番 AWS にデプロイする前に、Floci を使ってローカルでスタックを検証する。
詳細は `aidlc-docs/inception/application-design/cdk-local-development.md` を参照。

### 4.1 Floci 起動

```bash
# プロジェクトルートで実行
docker compose up -d

# Floci 起動確認
curl http://localhost:4566/_floci/health
```

### 4.2 DataStack（DynamoDB）のローカル検証

```bash
cd pkgs/cdk

AWS_ENDPOINT_URL=http://localhost:4566 \
AWS_ACCESS_KEY_ID=test \
AWS_SECRET_ACCESS_KEY=test \
pnpm exec cdk deploy DataStack --require-approval never

# テーブル作成確認
aws --endpoint-url=http://localhost:4566 dynamodb list-tables
```

### 4.3 Lambda 系スタック（ApiStack / AgentStack / WebhookStack）のローカル検証

```bash
cd pkgs/cdk

AWS_ENDPOINT_URL=http://localhost:4566 \
AWS_ACCESS_KEY_ID=test \
AWS_SECRET_ACCESS_KEY=test \
pnpm exec cdk deploy ApiStack AgentStack WebhookStack --require-approval never

# Lambda 関数一覧確認
aws --endpoint-url=http://localhost:4566 lambda list-functions

# API Gateway 確認
aws --endpoint-url=http://localhost:4566 apigatewayv2 get-apis
```

### 4.4 Floci 停止

```bash
docker compose down
```

---

## 5. CDK synth / diff

```bash
cd pkgs/cdk

# CloudFormation テンプレート生成・構文検証（デプロイなし）
pnpm synth       # または pnpm exec cdk synth

# 特定スタックのみ
pnpm exec cdk synth DataStack

# 既存スタックとの差分確認
pnpm diff        # または pnpm exec cdk diff

# 特定スタックのみ差分確認
pnpm exec cdk diff ApiStack
```

---

## 6. スタック別デプロイ順序（本番 AWS）

依存関係を考慮した順序で個別デプロイする場合は以下の順序を守ること。

```bash
cd pkgs/cdk

# ステップ 1: CognitoStack（他スタックが参照するユーザープール）
pnpm exec cdk deploy CognitoStack

# ステップ 2: DataStack（DynamoDB テーブル）
pnpm exec cdk deploy DataStack

# ステップ 3: ApiStack（API Gateway + Hono Lambda）
# DataStack の Output を参照するため DataStack 完了後に実施
pnpm exec cdk deploy ApiStack

# ステップ 4: AgentStack + WebhookStack（並列デプロイ可）
# ApiStack の Output を参照するため ApiStack 完了後に実施
pnpm exec cdk deploy AgentStack WebhookStack

# ステップ 5: FrontendStack（S3 + CloudFront）
# すべてのバックエンドスタック完了後に実施
pnpm exec cdk deploy FrontendStack
```

---

## 7. 全スタック一括デプロイ

```bash
cd pkgs/cdk

# 全スタック一括デプロイ（承認スキップ）
pnpm deploy      # または pnpm exec cdk deploy --all --require-approval never

# CDK が依存関係を自動解決して順序通りデプロイする
```

---

## 8. スタック破棄

```bash
cd pkgs/cdk

# 全スタック破棄（本番環境での実行は十分注意すること）
# DynamoDB / S3 の RemovalPolicy が RETAIN の場合は手動削除が必要
pnpm destroy     # または pnpm exec cdk destroy --all

# 特定スタックのみ破棄
pnpm exec cdk destroy FrontendStack

# 注意事項:
# - DataStack（DynamoDB）は RETAIN ポリシーのため、destroy 後もテーブルは残る
# - 完全削除する場合は AWS コンソールから手動で削除すること
# - 本番環境での destroy は取り返しのつかないデータ損失につながる可能性がある
```

---

## 9. よくあるエラーと対処法

### 9.1 CloudFormation エラー

**エラー**: `CREATE_FAILED: Resource of type 'AWS::DynamoDB::Table' with identifier ... already exists`

**対処**:
```bash
# 既存リソースをインポートするか、スタックを手動でクリーンアップ
aws cloudformation describe-stack-resources --stack-name SaborouDataStack
cd pkgs/cdk
pnpm exec cdk destroy DataStack
pnpm exec cdk deploy DataStack
```

### 9.2 IAM 権限不足エラー

**エラー**: `AccessDenied: User is not authorized to perform: iam:CreateRole`

**対処**:
- IAM ユーザー / IAM Identity Center ユーザーに `AdministratorAccess` または CDK 用カスタムポリシーを付与
- CDK ブートストラップ用ロールが存在するか確認

### 9.3 Lambda タイムアウト

**エラー**: CloudWatch ログで `Task timed out after X.XX seconds`

**対処**:
```bash
# Lambda タイムアウト設定確認（CDK コードで設定）
# pkgs/cdk/lib/stacks/agent-stack.ts の timeout 設定を確認
# 推奨: TaskExtractor → 60秒 / SaboriProposer → 60秒

# CloudWatch でログ確認
aws logs tail /aws/lambda/saborou-task-extractor-dev --follow --region ap-northeast-1
```

### 9.4 Bedrock モデルアクセスエラー

**エラー**: `AccessDeniedException: You don't have access to the model with the specified model ID`

**対処**:
1. AWS コンソール → Amazon Bedrock → モデルアクセス
2. `Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)` を有効化
3. ap-northeast-1 リージョンで利用可能であることを確認

### 9.5 CDK ブートストラップ未実施エラー

**エラー**: `[Error at /SaborouApiStack] Need to perform AWS calls for account XXXX`

**対処**:
```bash
npx cdk bootstrap aws://$AWS_ACCOUNT_ID/ap-northeast-1
```

---

## 10. コスト見積もり参照

月額コスト見積もりは `aidlc-docs/inception/application-design/aws-architecture.md` の月額コスト表を参照。

概算（ハッカソン規模・低トラフィック想定）:
- Lambda: 無料枠内（月100万リクエスト以下）
- DynamoDB: 約 $1〜3（On-Demand モード）
- API Gateway: 約 $1〜2
- CloudFront + S3: 約 $1
- Bedrock（Claude Sonnet）: 約 $5〜20（開発・テスト込み）
- Cognito: 無料枠内（月50,000 MAU 以下）
- **合計概算**: 月額 $10〜30

> AWS Budgets で $30（警告）/ $50（上限通知）のアラートを設定すること（NFR-06）。

---

## 11. 関連文書

| 文書 | パス |
|------|------|
| CDK ローカル開発ガイド（Floci） | `aidlc-docs/inception/application-design/cdk-local-development.md` |
| AWS アーキテクチャ設計 | `aidlc-docs/inception/application-design/aws-architecture.md` |
| Unit-of-Work（U-02 infra） | `aidlc-docs/inception/units/unit-of-work.md` |
| バックエンド操作ガイド | `aidlc-docs/operations/backend-operations.md` |
| フロントエンド操作ガイド | `aidlc-docs/operations/frontend-operations.md` |

---

*本ガイドは AI-DLC OPERATIONS フェーズの成果物です（v1.0.0 作成: 2026-05-16）。*
