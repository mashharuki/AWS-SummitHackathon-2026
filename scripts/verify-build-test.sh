#!/usr/bin/env bash
set -euo pipefail

# U-V3-05: NFR-V305-R1 — 全パッケージビルド・テスト検証スクリプト
# 対応NFR: NFR-V305-R1 (Critical)
# 実行方法: ./scripts/verify-build-test.sh
# セキュリティ: シークレット不要。環境変数なし。

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${ROOT_DIR}/evidence/R1-build-test"

mkdir -p "${EVIDENCE_DIR}"
LOG_FILE="${EVIDENCE_DIR}/build-test-$(date +%Y%m%dT%H%M%S).log"

echo "=== U-V3-05 NFR-V305-R1: 全パッケージビルド・テスト検証 ===" | tee "${LOG_FILE}"
echo "実行開始: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "${LOG_FILE}"
echo "" | tee -a "${LOG_FILE}"

PASS=0
FAIL=0

run_check() {
  local name="$1"
  local cmd="$2"
  echo "--- [CHECK] ${name} ---" | tee -a "${LOG_FILE}"
  if eval "${cmd}" >> "${LOG_FILE}" 2>&1; then
    echo "[PASS] ${name}" | tee -a "${LOG_FILE}"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] ${name}" | tee -a "${LOG_FILE}"
    FAIL=$((FAIL + 1))
  fi
  echo "" | tee -a "${LOG_FILE}"
}

cd "${ROOT_DIR}"

# --- TypeScript 型チェック ---
run_check "@saboru/backend  tsc --noEmit"  "pnpm --filter @saboru/backend  exec tsc --noEmit"
run_check "@saborou/cdk     tsc --noEmit"  "pnpm --filter @saborou/cdk     exec tsc --noEmit"
run_check "frontend          tsc --noEmit"  "pnpm --filter frontend          exec tsc --noEmit"
run_check "@saboru/agent    tsc --noEmit"  "pnpm --filter @saboru/agent     exec tsc --noEmit"
run_check "@saboru/shared   tsc --noEmit"  "pnpm --filter @saboru/shared    exec tsc --noEmit"

# --- ユニットテスト ---
run_check "@saboru/backend  test"  "pnpm --filter @saboru/backend  test"
run_check "@saborou/cdk     test"  "pnpm --filter @saborou/cdk     test"
run_check "frontend          test"  "pnpm --filter frontend          test"
run_check "@saboru/agent    test"  "pnpm --filter @saboru/agent     test"
run_check "@saboru/shared   test"  "pnpm --filter @saboru/shared    test"

echo "================================" | tee -a "${LOG_FILE}"
echo "結果: PASS=${PASS}, FAIL=${FAIL}" | tee -a "${LOG_FILE}"
echo "ログ: ${LOG_FILE}" | tee -a "${LOG_FILE}"

if [ "${FAIL}" -gt 0 ]; then
  echo "[RESULT] FAIL — ${FAIL}件の検証が失敗しました" | tee -a "${LOG_FILE}"
  exit 1
fi

echo "[RESULT] PASS — 全パッケージビルド・テスト通過" | tee -a "${LOG_FILE}"
