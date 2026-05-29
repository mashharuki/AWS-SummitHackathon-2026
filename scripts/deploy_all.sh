# CDKでデプロイする前に全てのコンポーネントをビルドする
pnpm run -r build
# CDKデプロイ
# customDomain=true は必須。付け忘れると CloudFront のエイリアス＋ACM 証明書が外れ、
# saborou.agentic-jp.com で ERR_CERT_COMMON_NAME_INVALID となり env-config.json も
# 生 URL（API Gateway / cloudfront.net）で書き込まれて API 接続が壊れる。
pnpm cdk run deploy --require-approval never --all -c customDomain=true