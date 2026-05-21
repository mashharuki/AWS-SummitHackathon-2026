#!/usr/bin/env bash
# floci (ローカル AWS エミュレータ) に対して CDK bootstrap を実行する。
# 本物の AWS には繋がらない。
#
# NOTE: floci は ECR を完全サポートしておらず、ContainerAssetsRepository の
# 作成は失敗する。これは CDK が許容するため bootstrap 自体は完了する。
# Lambda は zip パッケージで定義されているため ECR 非対応は影響しない。
set -euo pipefail

export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=dummy
export AWS_SECRET_ACCESS_KEY=dummy
export AWS_S3_USE_PATH_STYLE=1
export CDK_DEFAULT_ACCOUNT=000000000000
export CDK_DEFAULT_REGION=ap-northeast-1

cdk bootstrap "aws://${CDK_DEFAULT_ACCOUNT}/${CDK_DEFAULT_REGION}"
