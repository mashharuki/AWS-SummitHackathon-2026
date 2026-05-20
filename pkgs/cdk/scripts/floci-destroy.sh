#!/usr/bin/env bash
# floci (ローカル AWS エミュレータ) の CDK スタックを全部削除する。
# 本物の AWS には繋がらない。
#
# 本スクリプトは以下を順次実行する。本番 AWS では Secrets / DynamoDB を保護する
# 設計 (RemovalPolicy.RETAIN) をそのまま維持し、floci ローカル限定で強制削除する。
#   [1/5] cdk destroy --all --force (CDK スタックを CloudFormation 経由で削除)
#   [2/5] Secrets Manager の Secret を強制削除 (CDK では削除されない)
#   [3/5] DynamoDB テーブルを強制削除 (CDK では削除されない)
#   [4/5] 残った CloudFormation スタックの強制削除 (RETAIN リソース由来の残存)
#   [5/5] アプリ由来の IAM Policy / Role を強制削除 (CDKToolkit/cdk-* は保持)
#
# 完全クリーンアップが目的なので、エラーは無視して次に進む。
set -uo pipefail

export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=dummy
export AWS_SECRET_ACCESS_KEY=dummy
export AWS_S3_USE_PATH_STYLE=1
export CDK_DEFAULT_ACCOUNT=000000000000
export CDK_DEFAULT_REGION=ap-northeast-1

AWS_OPTS="--endpoint-url ${AWS_ENDPOINT_URL} --region ${CDK_DEFAULT_REGION}"

echo "[1/5] cdk destroy --all --force"
cdk destroy --all --force || true

echo "[2/5] Secrets Manager の Secret を強制削除"
SECRETS=(
  "/saborou/slack/client-secret-dev"
  "/saborou/slack/signing-secret-dev"
  "/saborou/slack/client-secret-staging"
  "/saborou/slack/signing-secret-staging"
  "/saborou/slack/client-secret-prod"
  "/saborou/slack/signing-secret-prod"
)
for secret in "${SECRETS[@]}"; do
  aws secretsmanager delete-secret \
    --secret-id "${secret}" \
    --force-delete-without-recovery \
    ${AWS_OPTS} \
    >/dev/null 2>&1 && echo "  - deleted: ${secret}" || true
done

echo "[3/5] DynamoDB テーブルを強制削除"
TABLES=(
  "saborou-users-dev"
  "saborou-service-connections-dev"
  "saborou-task-candidates-dev"
  "saborou-tasks-dev"
  "saborou-proposals-dev"
  "saborou-honne-data-dev"
  "saborou-personas-dev"
)
for table in "${TABLES[@]}"; do
  aws dynamodb delete-table \
    --table-name "${table}" \
    ${AWS_OPTS} \
    >/dev/null 2>&1 && echo "  - deleted: ${table}" || true
done

echo "[4/5] 残存する CloudFormation スタックを強制削除"
STACKS=(
  "SaborouWebhook-dev"
  "SaborouApi-dev"
  "SaborouCognito-dev"
  "SaborouAgent-dev"
  "SaborouFrontend-dev"
  "SaborouData-dev"
)
for stack in "${STACKS[@]}"; do
  aws cloudformation delete-stack \
    --stack-name "${stack}" \
    ${AWS_OPTS} \
    >/dev/null 2>&1 && echo "  - deleted: ${stack}" || true
done

echo "[5/5] 残存する IAM Policy / Role を強制削除 (CDKToolkit / cdk-* は保持)"
# Policy: アプリ由来のもののみ削除
aws iam list-policies --scope Local ${AWS_OPTS} \
  --query 'Policies[?!starts_with(PolicyName, `CDKToolkit`) && !starts_with(PolicyName, `cdk-`)].Arn' \
  --output text 2>/dev/null | tr '\t' '\n' | while read -r arn; do
  [ -z "${arn}" ] && continue
  aws iam delete-policy --policy-arn "${arn}" ${AWS_OPTS} \
    >/dev/null 2>&1 && echo "  - policy deleted: ${arn##*/}" || true
done

# Role: アプリ由来のもののみ削除（cdk-hnb*, CDKToolkit-* は保持）
aws iam list-roles ${AWS_OPTS} \
  --query 'Roles[?!starts_with(RoleName, `cdk-`) && !starts_with(RoleName, `CDKToolkit-`)].RoleName' \
  --output text 2>/dev/null | tr '\t' '\n' | while read -r role; do
  [ -z "${role}" ] && continue
  aws iam delete-role --role-name "${role}" ${AWS_OPTS} \
    >/dev/null 2>&1 && echo "  - role deleted: ${role}" || true
done

echo "完了: floci 上のリソースを削除しました (CDKToolkit / cdk-* は保持)。"
