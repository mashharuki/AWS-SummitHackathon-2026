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

# MCP は REST形式: POST /api/mcp/tools/:toolName
MCP_TOOL_ENDPOINT="${API_ENDPOINT}/api/mcp/tools/saborou_list_tasks"
MCP_JSONRPC_ENDPOINT="${API_ENDPOINT}/api/mcp"
PASS=0
FAIL=0

echo "API Endpoint: ${MCP_TOOL_ENDPOINT}" | tee -a "${LOG_FILE}"
echo "MCP JSON-RPC Endpoint: ${MCP_JSONRPC_ENDPOINT}" | tee -a "${LOG_FILE}"
echo "" | tee -a "${LOG_FILE}"

# =====================
# テスト 0-A: Streamable HTTP initialize → 200 期待
# =====================
echo "--- [TEST 0-A] Streamable HTTP initialize (期待: 200) ---" | tee -a "${LOG_FILE}"
INIT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${MCP_JSONRPC_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"verify-mcp-auth","version":"1.0.0"}}}')

echo "レスポンスコード: ${INIT_STATUS}" | tee -a "${LOG_FILE}"
if [ "${INIT_STATUS}" = "200" ]; then
  echo "[PASS] Streamable HTTP initialize → 200" | tee -a "${LOG_FILE}"
  PASS=$((PASS + 1))
else
  echo "[FAIL] Streamable HTTP initialize → 期待: 200, 実際: ${INIT_STATUS}" | tee -a "${LOG_FILE}"
  FAIL=$((FAIL + 1))
fi
echo "" | tee -a "${LOG_FILE}"

# =====================
# テスト 0-B: Streamable HTTP tools/list 認証付き → 200 期待
# =====================
echo "--- [TEST 0-B] Streamable HTTP tools/list 認証付き (期待: 200) ---" | tee -a "${LOG_FILE}"
TOOLS_LIST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${MCP_JSONRPC_ENDPOINT}" \
  -H "Authorization: Bearer ${COGNITO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')

echo "レスポンスコード: ${TOOLS_LIST_STATUS}" | tee -a "${LOG_FILE}"
if [ "${TOOLS_LIST_STATUS}" = "200" ]; then
  echo "[PASS] Streamable HTTP tools/list → 200" | tee -a "${LOG_FILE}"
  PASS=$((PASS + 1))
else
  echo "[FAIL] Streamable HTTP tools/list → 期待: 200, 実際: ${TOOLS_LIST_STATUS}" | tee -a "${LOG_FILE}"
  FAIL=$((FAIL + 1))
fi
echo "" | tee -a "${LOG_FILE}"

# =====================
# テスト 0-C: SSE GET は未実装として扱う
# =====================
echo "--- [TEST 0-C] SSE GET unsupported 確認 (期待: 401/404/405) ---" | tee -a "${LOG_FILE}"
SSE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "${MCP_JSONRPC_ENDPOINT}" \
  -H "Accept: text/event-stream")

echo "レスポンスコード: ${SSE_STATUS}" | tee -a "${LOG_FILE}"
if [[ "${SSE_STATUS}" =~ ^(401|404|405)$ ]]; then
  echo "[PASS] SSE endpoint は未実装として扱われます (${SSE_STATUS})" | tee -a "${LOG_FILE}"
  PASS=$((PASS + 1))
else
  echo "[FAIL] SSE GET → 期待: 401/404/405, 実際: ${SSE_STATUS}" | tee -a "${LOG_FILE}"
  echo "       SSE をサポートする場合は別途設計・テストが必要です" | tee -a "${LOG_FILE}"
  FAIL=$((FAIL + 1))
fi
echo "" | tee -a "${LOG_FILE}"

# =====================
# テスト 1: 認証付きリクエスト → 200 期待
# =====================
echo "--- [TEST 1] 認証付きリクエスト (期待: 200) ---" | tee -a "${LOG_FILE}"
AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${MCP_TOOL_ENDPOINT}" \
  -H "Authorization: Bearer ${COGNITO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"args":{"limit":1}}')

echo "レスポンスコード: ${AUTH_STATUS}" | tee -a "${LOG_FILE}"
# 200: 成功 / 400: 認証通過・スキーマエラー / 403: 認証通過・権限不足
# いずれも「認証は正常に機能した」ことを示す (NFR-V305-E4 の確認範囲)
if [[ "${AUTH_STATUS}" =~ ^(200|400|403)$ ]]; then
  echo "[PASS] 認証付きリクエスト → ${AUTH_STATUS} (エンドポイント到達・認証通過確認)" | tee -a "${LOG_FILE}"
  PASS=$((PASS + 1))
else
  echo "[FAIL] 認証付きリクエスト → 期待: 200/400/403, 実際: ${AUTH_STATUS}" | tee -a "${LOG_FILE}"
  FAIL=$((FAIL + 1))
fi
echo "" | tee -a "${LOG_FILE}"

# =====================
# テスト 2: 認証なしリクエスト → 401 期待
# =====================
echo "--- [TEST 2] 認証なしリクエスト (期待: 401) ---" | tee -a "${LOG_FILE}"
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${MCP_TOOL_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{"args":{"limit":1}}')

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
  -X POST "${MCP_TOOL_ENDPOINT}" \
  -H "Authorization: Bearer invalid-token-for-testing" \
  -H "Content-Type: application/json" \
  -d '{"args":{"limit":1}}')

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
