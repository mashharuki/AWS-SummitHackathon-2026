#!/usr/bin/env bash
set -euo pipefail

# U-V3-05: NFR-V305-O1, O2 — CloudWatch Logs 監査確認スクリプト
# 対応NFR:
#   NFR-V305-O1 (High)     — CloudWatch MCP tool-call 監査ログ確認
#   NFR-V305-O2 (Critical) — エラーログのトークン漏洩スキャン
# 必須環境変数:
#   AWS_REGION      : デプロイリージョン (例: ap-northeast-1)
#   LOG_GROUP_NAME  : Lambda ロググループ名
#                     取得方法:
#                       aws cloudformation describe-stacks \
#                         --stack-name SaborouStack \
#                         --query 'Stacks[0].Outputs[?OutputKey==`McpLogGroupName`].OutputValue' \
#                         --output text
# 実行方法:
#   AWS_REGION=ap-northeast-1 \
#   LOG_GROUP_NAME=/aws/lambda/saborou-mcp \
#   ./scripts/verify-cloudwatch.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
O1_DIR="${ROOT_DIR}/evidence/O1-cloudwatch-logs"
O2_DIR="${ROOT_DIR}/evidence/O2-error-log-scan"

mkdir -p "${O1_DIR}" "${O2_DIR}"
QUERY_FILE="${O1_DIR}/cloudwatch-query-result-$(date +%Y%m%dT%H%M%S).txt"
SCAN_FILE="${O2_DIR}/secret-scan-result-cloudwatch-$(date +%Y%m%dT%H%M%S).txt"

echo "=== U-V3-05 NFR-V305-O1/O2: CloudWatch Logs 監査 ===" | tee "${QUERY_FILE}"
echo "実行開始: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "${QUERY_FILE}"
echo "" | tee -a "${QUERY_FILE}"

# 必須環境変数チェック
MISSING_VARS=()
[ -z "${AWS_REGION:-}"     ] && MISSING_VARS+=("AWS_REGION")
[ -z "${LOG_GROUP_NAME:-}" ] && MISSING_VARS+=("LOG_GROUP_NAME")

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "[ERROR] 以下の環境変数が未設定です:" | tee -a "${QUERY_FILE}"
  for v in "${MISSING_VARS[@]}"; do
    echo "  - ${v}" | tee -a "${QUERY_FILE}"
  done
  exit 1
fi

echo "AWS_REGION:     ${AWS_REGION}" | tee -a "${QUERY_FILE}"
echo "LOG_GROUP_NAME: ${LOG_GROUP_NAME}" | tee -a "${QUERY_FILE}"
echo "" | tee -a "${QUERY_FILE}"

PASS=0
FAIL=0
# 1時間前〜現在
END_TIME=$(date +%s)000
START_TIME=$(( ($(date +%s) - 3600) ))000

# ===================== O1: tool-call 監査ログ確認 =====================
echo "--- [O1] CloudWatch Logs Insights クエリ実行 ---" | tee -a "${QUERY_FILE}"

QUERY_ID=$(aws logs start-query \
  --log-group-name "${LOG_GROUP_NAME}" \
  --start-time "${START_TIME}" \
  --end-time "${END_TIME}" \
  --query-string 'fields @timestamp, requestId, toolName, userId, status, durationMs | filter toolName like /saborou_/ | sort @timestamp desc | limit 20' \
  --region "${AWS_REGION}" \
  --output text --query 'queryId' 2>&1) || {
  echo "[WARN] CloudWatch Logs クエリ開始に失敗しました" | tee -a "${QUERY_FILE}"
  echo "       ロググループ名を確認してください: ${LOG_GROUP_NAME}" | tee -a "${QUERY_FILE}"
  FAIL=$((FAIL + 1))
  QUERY_ID=""
}

if [ -n "${QUERY_ID}" ]; then
  echo "クエリID: ${QUERY_ID}" | tee -a "${QUERY_FILE}"
  echo "クエリ完了待ち (5秒)..." | tee -a "${QUERY_FILE}"
  sleep 5

  QUERY_RESULT=$(aws logs get-query-results \
    --query-id "${QUERY_ID}" \
    --region "${AWS_REGION}" 2>&1)

  echo "${QUERY_RESULT}" | tee -a "${QUERY_FILE}"

  RESULT_COUNT=$(echo "${QUERY_RESULT}" | \
    python3 -c "import json,sys; data=json.load(sys.stdin); print(len(data.get('results', [])))" 2>/dev/null || echo "0")

  if [ "${RESULT_COUNT}" -gt 0 ]; then
    echo "[PASS] O1: tool-call 監査ログが ${RESULT_COUNT} 件確認できました" | tee -a "${QUERY_FILE}"
    PASS=$((PASS + 1))
  else
    echo "[WARN] O1: tool-call ログが見つかりません。" | tee -a "${QUERY_FILE}"
    echo "       先にデモ（saborou_get_tasks等）を実行してからこのスクリプトを再実行してください" | tee -a "${QUERY_FILE}"
    FAIL=$((FAIL + 1))
  fi
fi

echo "" | tee -a "${QUERY_FILE}"

# ===================== O2: エラーログのトークン漏洩スキャン =====================
echo "=== U-V3-05 NFR-V305-O2: エラーログ トークン漏洩スキャン ===" | tee "${SCAN_FILE}"
echo "実行開始: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "${SCAN_FILE}"
echo "" | tee -a "${SCAN_FILE}"

echo "--- [O2] 直近エラーログ取得 (ERROR フィルタ) ---" | tee -a "${SCAN_FILE}"
ERROR_LOGS=$(aws logs filter-log-events \
  --log-group-name "${LOG_GROUP_NAME}" \
  --start-time "${START_TIME}" \
  --filter-pattern "ERROR" \
  --region "${AWS_REGION}" \
  --max-items 200 \
  --query 'events[*].message' \
  --output text 2>&1) || {
  echo "[WARN] エラーログ取得に失敗しました" | tee -a "${SCAN_FILE}"
  ERROR_LOGS=""
}

# シークレットパターンスキャン
PATTERNS=(
  "sk-[a-zA-Z0-9]{32,}"                               # ElevenLabs API key
  "xox[bp]-[0-9]+-[a-zA-Z0-9-]+"                     # Slack token
  "AKIA[A-Z0-9]{16}"                                   # AWS Access Key ID
  "arn:aws:secretsmanager:[a-z0-9-]+:[0-9]+:secret:"  # ハードコード SecretARN
)

SECRET_FOUND=0
echo "シークレットパターンスキャン結果:" | tee -a "${SCAN_FILE}"
for pattern in "${PATTERNS[@]}"; do
  if echo "${ERROR_LOGS}" | grep -qE "${pattern}" 2>/dev/null; then
    echo "[WARN] パターン検出: ${pattern}" | tee -a "${SCAN_FILE}"
    SECRET_FOUND=$((SECRET_FOUND + 1))
  else
    echo "[CLEAN] ${pattern}" | tee -a "${SCAN_FILE}"
  fi
done

if [ "${SECRET_FOUND}" -gt 0 ]; then
  echo "[RESULT-O2] FAIL — ${SECRET_FOUND}件のシークレットパターンをエラーログで検出しました" | tee -a "${SCAN_FILE}"
  FAIL=$((FAIL + 1))
else
  echo "[RESULT-O2] PASS — エラーログにシークレット漏洩なし" | tee -a "${SCAN_FILE}"
  PASS=$((PASS + 1))
fi

echo "" | tee -a "${SCAN_FILE}"
echo "================================" | tee -a "${SCAN_FILE}"
echo "O1 証拠ログ: ${QUERY_FILE}" | tee -a "${SCAN_FILE}"
echo "O2 証拠ログ: ${SCAN_FILE}" | tee -a "${SCAN_FILE}"

if [ "${FAIL}" -gt 0 ]; then
  echo "[RESULT] FAIL — 詳細は上記ログを確認してください"
  exit 1
fi

echo "[RESULT] PASS — CloudWatch 監査確認完了 (O1/O2 クリア)"
echo "O1 証拠ログ: ${QUERY_FILE}"
echo "O2 証拠ログ: ${SCAN_FILE}"
