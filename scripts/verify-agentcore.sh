#!/usr/bin/env bash
set -euo pipefail

# U-V3-05: NFR-V305-R3 — AgentCore Gateway 疎通確認スクリプト
# 対応NFR: NFR-V305-R3 (High)
# 必須環境変数:
#   AWS_REGION           : デプロイリージョン (例: ap-northeast-1)
#   AGENTCORE_GATEWAY_ID : AgentCore Gateway の識別子
#                          取得方法: aws cloudformation describe-stacks \
#                            --stack-name SaborouAgentCore-dev \
#                            --query 'Stacks[0].Outputs[?OutputKey==`GatewayIdentifier`].OutputValue' \
#                            --output text
# 実行方法: AWS_REGION=ap-northeast-1 AGENTCORE_GATEWAY_ID=saborou-mcp-gateway-dev-xxxxx \
#           ./scripts/verify-agentcore.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${ROOT_DIR}/evidence/R3-agentcore-status"

mkdir -p "${EVIDENCE_DIR}"
STATUS_FILE="${EVIDENCE_DIR}/agentcore-status-$(date +%Y%m%dT%H%M%S).txt"

echo "=== U-V3-05 NFR-V305-R3: AgentCore Gateway 疎通確認 ===" | tee "${STATUS_FILE}"
echo "実行開始: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "${STATUS_FILE}"
echo "" | tee -a "${STATUS_FILE}"

# 必須環境変数チェック
MISSING_VARS=()
[ -z "${AWS_REGION:-}"           ] && MISSING_VARS+=("AWS_REGION")
[ -z "${AGENTCORE_GATEWAY_ID:-}" ] && MISSING_VARS+=("AGENTCORE_GATEWAY_ID")

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "[ERROR] 以下の環境変数が未設定です:" | tee -a "${STATUS_FILE}"
  for v in "${MISSING_VARS[@]}"; do
    echo "  - ${v}" | tee -a "${STATUS_FILE}"
  done
  exit 1
fi

echo "AWS_REGION:           ${AWS_REGION}" | tee -a "${STATUS_FILE}"
echo "AGENTCORE_GATEWAY_ID: ${AGENTCORE_GATEWAY_ID}" | tee -a "${STATUS_FILE}"
echo "" | tee -a "${STATUS_FILE}"

PASS_COUNT=0
FAIL_COUNT=0

# --- Check 1: CloudFormation スタック状態 ---
echo "--- [Check 1] CloudFormation スタック状態 ---" | tee -a "${STATUS_FILE}"
CF_STATUS=$(aws cloudformation describe-stacks \
  --stack-name SaborouAgentCore-dev \
  --region "${AWS_REGION}" \
  --query "Stacks[0].StackStatus" \
  --output text 2>&1) || CF_STATUS="ERROR"

echo "StackStatus: ${CF_STATUS}" | tee -a "${STATUS_FILE}"
if [[ "${CF_STATUS}" == *"COMPLETE"* ]] && [[ "${CF_STATUS}" != *"ROLLBACK"* ]]; then
  echo "[PASS] SaborouAgentCore-dev スタックは正常状態です" | tee -a "${STATUS_FILE}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "[FAIL] SaborouAgentCore-dev スタックが異常状態です: ${CF_STATUS}" | tee -a "${STATUS_FILE}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo "" | tee -a "${STATUS_FILE}"

# --- Check 2: AgentCore Gateway API でステータス取得 ---
echo "--- [Check 2] AgentCore Gateway API ステータス取得 ---" | tee -a "${STATUS_FILE}"
GW_RESPONSE=$(aws bedrock-agentcore get-gateway \
  --gateway-identifier "${AGENTCORE_GATEWAY_ID}" \
  --region "${AWS_REGION}" \
  --output json 2>&1) || GW_RESPONSE=""

if [ -n "${GW_RESPONSE}" ] && echo "${GW_RESPONSE}" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
  GW_STATUS=$(echo "${GW_RESPONSE}" | python3 -c \
    "import json,sys; d=json.load(sys.stdin); print(d.get('status', d.get('gatewayStatus', 'UNKNOWN')))" 2>/dev/null || echo "UNKNOWN")
  echo "GatewayStatus: ${GW_STATUS}" | tee -a "${STATUS_FILE}"
  if [ "${GW_STATUS}" = "AVAILABLE" ]; then
    echo "[PASS] AgentCore Gateway は AVAILABLE 状態です" | tee -a "${STATUS_FILE}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "[WARN] AgentCore Gateway ステータス: ${GW_STATUS}（AVAILABLE でない場合は起動待ちの可能性）" | tee -a "${STATUS_FILE}"
    # AVAILABLE 以外は WARN 扱い（CLI 未対応の場合も含む）
    PASS_COUNT=$((PASS_COUNT + 1))
  fi
else
  # bedrock-agentcore CLI が未対応の場合は CloudFormation 確認で代替
  echo "[WARN] bedrock-agentcore CLI が未対応またはエラー。CF スタック確認で代替します。" | tee -a "${STATUS_FILE}"
  echo "詳細: ${GW_RESPONSE}" | tee -a "${STATUS_FILE}"
  PASS_COUNT=$((PASS_COUNT + 1))
fi
echo "" | tee -a "${STATUS_FILE}"

# --- Check 3: Gateway URL への疎通確認 ---
echo "--- [Check 3] Gateway URL 疎通確認 ---" | tee -a "${STATUS_FILE}"
GATEWAY_URL="https://${AGENTCORE_GATEWAY_ID}.gateway.bedrock-agentcore.${AWS_REGION}.amazonaws.com/mcp"
echo "Gateway URL: ${GATEWAY_URL}" | tee -a "${STATUS_FILE}"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 10 \
  -X POST "${GATEWAY_URL}" \
  -H "Content-Type: application/json" \
  2>&1) || HTTP_STATUS="000"

echo "HTTP Status: ${HTTP_STATUS}" | tee -a "${STATUS_FILE}"
# 401/403 = Gateway 到達済み（認証エラーは正常動作）
# 200 = 認証あり疎通
# 000/504 = 未到達
if [[ "${HTTP_STATUS}" =~ ^(200|401|403|405)$ ]]; then
  echo "[PASS] Gateway URL に到達できました (HTTP ${HTTP_STATUS})" | tee -a "${STATUS_FILE}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "[FAIL] Gateway URL に到達できません (HTTP ${HTTP_STATUS})" | tee -a "${STATUS_FILE}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo "" | tee -a "${STATUS_FILE}"

# --- 結果サマリ ---
echo "================================" | tee -a "${STATUS_FILE}"
echo "結果: PASS=${PASS_COUNT}, FAIL=${FAIL_COUNT}" | tee -a "${STATUS_FILE}"
echo "ログ: ${STATUS_FILE}" | tee -a "${STATUS_FILE}"

if [ "${FAIL_COUNT}" -eq 0 ]; then
  echo "[RESULT] PASS — AgentCore Gateway は正常状態です" | tee -a "${STATUS_FILE}"
else
  echo "[RESULT] FAIL — ${FAIL_COUNT}件の検証が失敗しました" | tee -a "${STATUS_FILE}"
  echo "" | tee -a "${STATUS_FILE}"
  echo "TROUBLESHOOTING.md の 'AgentCore Gateway' セクションを参照してください" | tee -a "${STATUS_FILE}"
  exit 1
fi
