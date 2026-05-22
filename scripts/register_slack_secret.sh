export ENV=dev   # 本番デプロイ時は prod に変更
export AWS_REGION=ap-northeast-1

# Signing Secret の登録
aws secretsmanager put-secret-value \
  --secret-id "/saborou/slack/signing-secret-${ENV}" \
  --secret-string ${SIGNING_SECRET} \
  --region ${AWS_REGION}

# Client Secret の登録
aws secretsmanager put-secret-value \
  --secret-id "/saborou/slack/client-secret-${ENV}" \
  --secret-string ${CLIENT_SECRET} \
  --region ${AWS_REGION}

# Signing Secret が登録されているか確認（値は表示しない）
aws secretsmanager describe-secret \
  --secret-id "/saborou/slack/signing-secret-${ENV}" \
  --region ${AWS_REGION} \
  --query 'Name'

# Client Secret が登録されているか確認
aws secretsmanager describe-secret \
  --secret-id "/saborou/slack/client-secret-${ENV}" \
  --region ${AWS_REGION} \
  --query 'Name'