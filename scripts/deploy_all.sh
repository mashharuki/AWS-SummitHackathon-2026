#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

# CDKでデプロイする前に全てのコンポーネントをビルドする
pnpm run -r build

cd "$REPO_ROOT/pkgs/cdk"

CDK_COMMON_OPTS="--require-approval never -c customDomain=true"

# customDomain=true は必須。付け忘れると CloudFront のエイリアス＋ACM 証明書が外れ、
# saborou.agentic-jp.com で ERR_CERT_COMMON_NAME_INVALID となり env-config.json も
# 生 URL（API Gateway / cloudfront.net）で書き込まれて API 接続が壊れる。

# Phase 1: SaborouConfigDeploy-dev を --exclusively でデプロイ
#
# SaborouConfigDeploy-dev は以下の2つのエクスポートを import していた（customDomain=false 時）:
#   - SaborouFrontend-dev:ExportsOutput...DistributionDomainName... (oauthRedirectUri)
#   - SaborouApi-dev:ExportsOutput...HttpApiEndpoint... (VITE_API_BASE_URL)
# customDomain=true にすることでこれらの import が除去され、固定 URL に置き換えられる。
#
# --exclusively が必要な理由:
# CDK は SaborouConfigDeploy-dev の依存先（Frontend・Api）を先にデプロイしようとするが、
# それらは SaborouConfigDeploy-dev が import を持つ間は更新できない（循環デッドロック）。
# --exclusively で依存先デプロイをスキップし、ConfigDeploy の import だけを先に除去する。
npx cdk deploy $CDK_COMMON_OPTS --exclusively SaborouConfigDeploy-dev

# Phase 2: SaborouApi-dev を --exclusively でデプロイ
#
# Phase 1 で SaborouConfigDeploy-dev が SaborouApi-dev の export の import を除去したため、
# SaborouApi-dev は ExportsOutput...HttpApiEndpoint... export を安全に削除できるようになった。
# また SaborouApi-dev 自身も SaborouFrontend-dev:Distribution import を除去する。
# --exclusively で SaborouFrontend-dev への依存デプロイをスキップする。
npx cdk deploy $CDK_COMMON_OPTS --exclusively SaborouApi-dev

# Phase 3: 全スタックをデプロイ
#
# Phase 1+2 で全ての import が除去されたため、
# SaborouFrontend-dev は ExportsOutput...DistributionDomainName... export を安全に削除できる。
npx cdk deploy $CDK_COMMON_OPTS --all
