#!/usr/bin/env bash
set -euo pipefail

# U-V3-05: NFR-V305-R2 — CDK synth 成功確認スクリプト
# 対応NFR: NFR-V305-R2 (Critical)
# 事前条件: AWS_PROFILE または AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY が設定済みであること
# 実行方法: AWS_PROFILE=myprofile ./scripts/verify-cdk-synth.sh
# セキュリティ: AWS 認証情報は環境変数経由（ハードコード禁止）

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${ROOT_DIR}/evidence/R2-cdk-synth"

mkdir -p "${EVIDENCE_DIR}"
LOG_FILE="${EVIDENCE_DIR}/synth-output-$(date +%Y%m%dT%H%M%S).log"

echo "=== U-V3-05 NFR-V305-R2: CDK synth 検証 ===" | tee "${LOG_FILE}"
echo "実行開始: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "${LOG_FILE}"
echo "" | tee -a "${LOG_FILE}"

# AWS 認証確認
if [ -z "${AWS_PROFILE:-}" ] && [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  echo "[WARN] AWS_PROFILE も AWS_ACCESS_KEY_ID も未設定です。" | tee -a "${LOG_FILE}"
  echo "       export AWS_PROFILE=myprofile または IAM 認証情報を設定してから再実行してください" | tee -a "${LOG_FILE}"
fi

cd "${ROOT_DIR}"

echo "--- CDK synth 実行中 ---" | tee -a "${LOG_FILE}"
if pnpm --filter @saborou/cdk synth 2>&1 | tee -a "${LOG_FILE}"; then
  echo "" | tee -a "${LOG_FILE}"

  # cdk-nag Error チェック
  if grep -qE "cdk-nag.*Error|error\[cdk-nag\]" "${LOG_FILE}" 2>/dev/null; then
    echo "[RESULT] FAIL — cdk-nag Error が検出されました。ログを確認してください: ${LOG_FILE}" | tee -a "${LOG_FILE}"
    exit 1
  fi

  echo "[RESULT] PASS — CDK synth 成功 (Errors=0, cdk-nag Error=0)" | tee -a "${LOG_FILE}"
  echo "証拠ログ: ${LOG_FILE}"
else
  echo "[RESULT] FAIL — CDK synth 失敗。ログを確認してください: ${LOG_FILE}" | tee -a "${LOG_FILE}"
  exit 1
fi
