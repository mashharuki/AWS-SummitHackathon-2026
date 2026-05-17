#!/usr/bin/env bash
set -euo pipefail

export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=dummy
export AWS_SECRET_ACCESS_KEY=dummy
export AWS_S3_USE_PATH_STYLE=1
export CDK_DEFAULT_ACCOUNT=000000000000
export CDK_DEFAULT_REGION=ap-northeast-1
cdk destroy --all --force
