#!/usr/bin/env bash
set -euo pipefail

# U-V3-05: NFR-V305-E4 — MCP 認証・未認証リクエスト拒否確認スクリプト
# 対応NFR: NFR-V305-E4 (Critical) — Security Baseline SECURITY-02
# 必須環境変数:
#   API_ENDPOINT  : API Gateway エンドポイント URL
#                   取得方法:
#                     aws cloudformation describe-stacks \
#                       --stack-name SaborouStack \
#                       --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
#                       --output text
#   COGNITO_TOKEN : Cognito JWT アクセストークン
#                   取得方法:
#                     aws cognito-idp initiate-auth \
#                       --auth-flow USER_PASSWORD_AUTH \
#                       --auth-parameters USERNAME=<email>,PASSWORD=<password> \
#                       --client-id <CognitoClientId> \
#                       --query 'AuthenticationResult.AccessToken' \
#                       --output text
# 実行方法:
#   API_ENDPOINT=https://xxx.execute-api.ap-northeast-1.amazonaws.com/prod \
#   COGNITO_TOKEN=eyJhbGciOiJSUzI1NiJ9... \
#   ./scripts/verify-mcp-auth.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${ROOT_DIR}/evidence/E4-unauth-reject"

mkdir -p "${EVIDENCE_DIR}"
LOG_FILE="${EVIDENCE_DIR}/curl-reject-log-$(date +%Y%m%dT%H%M%S).txt"

echo "=== U-V3-05 NFR-V305-E4: MCP 認証・未認証リクエスト確認 ===" | tee "${LOG_FILE}"
echo "実行開始: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "${LOG_FILE}"
echo "" | tee -a "${LOG_FILE}"

# 必須環境変数チェック
MISSING_VARS=()
[ -z "${API_ENDPOINT:-}"  ] && MISSING_VARS+=("API_ENDPOINT")
[ -z "${COGNITO_TOKEN:-}" ] && MISSING_VARS+=("COGNITO_TOKEN")

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "[ERROR] 以下の環境変数が未設定です:" | tee -a "${LOG_FILE}"
  for v in "${MISSING_VARS[@]}"; do
    echo "  - ${v}" | tee -a "${LOG_FILE}"
  done
  exit 1
fi

MCP_ENDPOINT="${API_ENDPOINT}/mcp"
PASS=0
FAIL=0

echo "API Endpoint: ${MCP_ENDPOINT}" | tee -a "${LOG_FILE}"
echo "" | tee -a "${LOG_FILE}"

# =====================
# テスト 1: 認証付きリクエスト → 200 期待
# =====================
echo "--- [TEST 1] 認証付きリクエスト (期待: 200) ---" | tee -a "${LOG_FILE}"
AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${MCP_ENDPOINT}" \
  -H "Authorization: Bearer ${COGNITO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"saborou_get_tasks","arguments":{"limit":1}},"id":1}')

echo "レスポンスコード: ${AUTH_STATUS}" | tee -a "${LOG_FILE}"
if [ "${AUTH_STATUS}" = "200" ]; then
  echo "[PASS] 認証付きリクエスト → 200 OK" | tee -a "${LOG_FILE}"
  PASS=$((PASS + 1))
else
  echo "[FAIL] 認証付きリクエスト → 期待: 200, 実際: ${AUTH_STATUS}" | tee -a "${LOG_FILE}"
  FAIL=$((FAIL + 1))
fi
echo "" | tee -a "${LOG_FILE}"

# =====================
# テスト 2: 認証なしリクエスト → 401 期待
# =====================
echo "--- [TEST 2] 認証なしリクエスト (期待: 401) ---" | tee -a "${LOG_FILE}"
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${MCP_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"saborou_get_tasks","arguments":{"limit":1}},"id":2}')

echo "レスポンスコード: ${UNAUTH_STATUS}" | tee -a "${LOG_FILE}"
if [ "${UNAUTH_STATUS}" = "401" ]; then
  echo "[PASS] 認証なしリクエスト → 401 Unauthorized" | tee -a "${LOG_FILE}"
  PASS=$((PASS + 1))
else
  echo "[FAIL] 認証なしリクエスト → 期待: 401, 実際: ${UNAUTH_STATUS}" | tee -a "${LOG_FILE}"
  echo "       Security Baseline SECURITY-02 違反の可能性があります" | tee -a "${LOG_FILE}"
  FAIL=$((FAIL + 1))
fi
echo "" | tee -a "${LOG_FILE}"

# =====================
# テスト 3: 無効トークンリクエスト → 401 期待
# =====================
echo "--- [TEST 3] 無効トークンリクエスト (期待: 401) ---" | tee -a "${LOG_FILE}"
INVALID_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${MCP_ENDPOINT}" \
  -H "Authorization: Bearer invalid-token-for-testing" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"saborou_get_tasks","arguments":{"limit":1}},"id":3}')

echo "レスポンスコード: ${INVALID_STATUS}" | tee -a "${LOG_FILE}"
if [ "${INVALID_STATUS}" = "401" ]; then
  echo "[PASS] 無効トークン → 401 Unauthorized" | tee -a "${LOG_FILE}"
  PASS=$((PASS + 1))
else
  echo "[FAIL] 無効トークン → 期待: 401, 実際: ${INVALID_STATUS}" | tee -a "${LOG_FILE}"
  FAIL=$((FAIL + 1))
fi
echo "" | tee -a "${LOG_FILE}"

echo "================================" | tee -a "${LOG_FILE}"
echo "結果: PASS=${PASS}, FAIL=${FAIL}" | tee -a "${LOG_FILE}"
echo "証拠ログ: ${LOG_FILE}"

if [ "${FAIL}" -gt 0 ]; then
  echo "[RESULT] FAIL — Security Baseline SECURITY-02 に違反の可能性があります" | tee -a "${LOG_FILE}"
  echo "         TROUBLESHOOTING.md の 'Cognito JWT 認証' セクションを参照してください"
  exit 1
fi

echo "[RESULT] PASS — 認証制御が正常に動作しています (NFR-V305-E4 クリア)" | tee -a "${LOG_FILE}"
