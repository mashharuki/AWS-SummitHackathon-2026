#!/usr/bin/env bash
# floci (ローカル AWS エミュレータ) に CDK スタックを全部デプロイする。
# 本物の AWS には繋がらない。AWS_ENDPOINT_URL ですべての AWS SDK 呼び出しが
# http://localhost:4566 (floci コンテナ) に向く。
#
# 既知の floci 制限事項:
#   - ECR: ContainerAssetsRepository が CREATE_FAILED (Lambda は zip なので影響なし)
#   - EventBridge: 同一テンプレ内の EventBus → Rule の依存解決に競合があり、
#     SlackToTaskExtractorRule が CREATE_FAILED になる場合がある (実 AWS では正常)
#   - これらは floci 側の制限で、CDK コードや本番デプロイには影響しない。
set -euo pipefail

export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=dummy
export AWS_SECRET_ACCESS_KEY=dummy
export AWS_S3_USE_PATH_STYLE=1
export CDK_DEFAULT_ACCOUNT=000000000000
export CDK_DEFAULT_REGION=ap-northeast-1

# --require-approval never: TTY なしの非対話実行で IAM 変更承認をスキップ
# --no-rollback: floci は CloudFormation ロールバックを完全サポートしておらず、
#                エラー時に空スタックが残るため無効化
cdk deploy --all --require-approval never --no-rollback
