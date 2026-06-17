#!/usr/bin/env bash
set -euo pipefail

# U-V3-05: NFR-V305-R3 — AgentCore Gateway 疎通確認スクリプト
# 対応NFR: NFR-V305-R3 (High)
# 必須環境変数:
#   AWS_REGION           : デプロイリージョン (例: ap-northeast-1)
#   AGENTCORE_GATEWAY_ID : AgentCore Gateway / Agent の ID
#                          取得方法: pnpm --filter @saborou/cdk synth 後
#                            aws cloudformation describe-stacks \
#                              --stack-name SaborouStack \
#                              --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreGatewayId`].OutputValue' \
#                              --output text
# 実行方法: AWS_REGION=ap-northeast-1 AGENTCORE_GATEWAY_ID=ABCD1234 \
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
  echo "" | tee -a "${STATUS_FILE}"
  echo "設定方法:" | tee -a "${STATUS_FILE}"
  echo "  export AWS_REGION=ap-northeast-1" | tee -a "${STATUS_FILE}"
  echo "  export AGENTCORE_GATEWAY_ID=\$(aws cloudformation describe-stacks \\" | tee -a "${STATUS_FILE}"
  echo "    --stack-name SaborouStack \\" | tee -a "${STATUS_FILE}"
  echo "    --query 'Stacks[0].Outputs[?OutputKey==\`AgentCoreGatewayId\`].OutputValue' \\" | tee -a "${STATUS_FILE}"
  echo "    --output text)" | tee -a "${STATUS_FILE}"
  exit 1
fi

echo "AWS_REGION:          ${AWS_REGION}" | tee -a "${STATUS_FILE}"
echo "AGENTCORE_GATEWAY_ID: ${AGENTCORE_GATEWAY_ID}" | tee -a "${STATUS_FILE}"
echo "" | tee -a "${STATUS_FILE}"

echo "--- AgentCore Gateway ステータス取得 ---" | tee -a "${STATUS_FILE}"
AGENT_RESPONSE=$(aws bedrock-agent get-agent \
  --agent-id "${AGENTCORE_GATEWAY_ID}" \
  --region "${AWS_REGION}" \
  --output json 2>&1) || {
  echo "[FAIL] AgentCore ステータス取得に失敗しました" | tee -a "${STATUS_FILE}"
  echo "エラー詳細: ${AGENT_RESPONSE}" | tee -a "${STATUS_FILE}"
  echo "" | tee -a "${STATUS_FILE}"
  echo "TROUBLESHOOTING.md の 'AgentCore Gateway' セクションを参照してください"
  exit 1
}

echo "${AGENT_RESPONSE}" | tee -a "${STATUS_FILE}"

AGENT_STATUS=$(echo "${AGENT_RESPONSE}" | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(d.get('agent',{}).get('agentStatus','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")

echo "" | tee -a "${STATUS_FILE}"
echo "AgentStatus: ${AGENT_STATUS}" | tee -a "${STATUS_FILE}"

if [ "${AGENT_STATUS}" = "AVAILABLE" ]; then
  echo "[RESULT] PASS — AgentCore Gateway は AVAILABLE 状態です" | tee -a "${STATUS_FILE}"
  echo "証拠ファイル: ${STATUS_FILE}"
else
  echo "[RESULT] FAIL — AgentCore Gateway のステータスが AVAILABLE ではありません: ${AGENT_STATUS}" | tee -a "${STATUS_FILE}"
  echo "" | tee -a "${STATUS_FILE}"
  echo "TROUBLESHOOTING.md の 'AgentCore Gateway / ステータス FAILED' セクションを参照してください" | tee -a "${STATUS_FILE}"
  exit 1
fi
