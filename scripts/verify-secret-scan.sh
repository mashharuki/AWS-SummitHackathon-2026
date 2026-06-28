#!/usr/bin/env bash
set -euo pipefail

# U-V3-05: NFR-V305-M2 — シークレットスキャンスクリプト
# 対応NFR: NFR-V305-M2 (Critical) — Security Baseline
# 用途: スクリプト・ソースコード内のハードコードシークレットを検出する CI ゲート
# 実行方法: ./scripts/verify-secret-scan.sh
# セキュリティ: このスクリプト自体にシークレット不使用

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${ROOT_DIR}/evidence/O2-error-log-scan"

mkdir -p "${EVIDENCE_DIR}"
SCAN_FILE="${EVIDENCE_DIR}/secret-scan-result-$(date +%Y%m%dT%H%M%S).txt"

echo "=== U-V3-05 NFR-V305-M2: シークレットスキャン ===" | tee "${SCAN_FILE}"
echo "実行開始: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "${SCAN_FILE}"
echo "" | tee -a "${SCAN_FILE}"

# =====================
# スキャン対象ディレクトリ
# =====================
SCAN_TARGETS=()
for d in \
  "${ROOT_DIR}/scripts" \
  "${ROOT_DIR}/pkgs" \
  "${ROOT_DIR}/packages" \
  "${ROOT_DIR}/apps" \
  "${ROOT_DIR}/cdk" \
  "${ROOT_DIR}/backend" \
  "${ROOT_DIR}/frontend" \
  "${ROOT_DIR}/agent"
do
  [ -d "${d}" ] && SCAN_TARGETS+=("${d}")
done

echo "スキャン対象:" | tee -a "${SCAN_FILE}"
for t in "${SCAN_TARGETS[@]}"; do
  echo "  - ${t}" | tee -a "${SCAN_FILE}"
done
echo "" | tee -a "${SCAN_FILE}"

# =====================
# シークレットパターン定義（bash 3.2 互換: 配列で名前と正規表現を並列管理）
# =====================
PATTERN_NAMES=(
  "ElevenLabs_API_KEY"
  "Slack_Token_Bot"
  "AWS_Access_Key_ID"
  "Hardcoded_SecretARN"
  "GitHub_PAT"
  "Generic_API_Key"
)
PATTERN_REGEXPS=(
  "sk-[a-zA-Z0-9]{32,}"
  "xox[bp]-[0-9]+-[a-zA-Z0-9-]+"
  "AKIA[A-Z0-9]{16}"
  "arn:aws:secretsmanager:[a-z0-9-]+:[0-9]{12}:secret:[a-zA-Z0-9/+=.@_-]+"
  "ghp_[a-zA-Z0-9]{36,}"
  "api[_-]?key['\"]?[[:space:]]*[:=][[:space:]]*['\"][a-zA-Z0-9_-]{20,}['\"]"
)

TOTAL_ISSUES=0

for dir in "${SCAN_TARGETS[@]}"; do
  echo "--- スキャン: ${dir} ---" | tee -a "${SCAN_FILE}"

  idx=0
  while [ "${idx}" -lt "${#PATTERN_NAMES[@]}" ]; do
    pattern_name="${PATTERN_NAMES[$idx]}"
    pattern="${PATTERN_REGEXPS[$idx]}"
    idx=$((idx + 1))

    MATCHES=$(grep -rEn \
      --include="*.sh" \
      --include="*.ts" \
      --include="*.js" \
      --include="*.mjs" \
      --include="*.cjs" \
      --include="*.json" \
      --include="*.yaml" \
      --include="*.yml" \
      "${pattern}" "${dir}" 2>/dev/null \
      | grep -v "node_modules" \
      | grep -v "cdk\.out" \
      | grep -v ".env.example" \
      | grep -v "\.d\.ts:" \
      | grep -v "# example:" \
      | grep -v "# 取得方法:" \
      | grep -v "# 実行方法:" \
      | grep -v "secretsmanager.*secret:.*[/*]" \
      || true)

    if [ -n "${MATCHES}" ]; then
      echo "[ISSUE] ${pattern_name}" | tee -a "${SCAN_FILE}"
      echo "${MATCHES}" | head -5 | tee -a "${SCAN_FILE}"
      TOTAL_ISSUES=$((TOTAL_ISSUES + 1))
    fi
  done

  echo "" | tee -a "${SCAN_FILE}"
done

echo "================================" | tee -a "${SCAN_FILE}"
echo "検出件数: ${TOTAL_ISSUES}" | tee -a "${SCAN_FILE}"
echo "証拠ログ: ${SCAN_FILE}" | tee -a "${SCAN_FILE}"

if [ "${TOTAL_ISSUES}" -gt 0 ]; then
  echo "" | tee -a "${SCAN_FILE}"
  echo "[RESULT] FAIL — ${TOTAL_ISSUES}件のシークレットパターンを検出しました" | tee -a "${SCAN_FILE}"
  echo "" | tee -a "${SCAN_FILE}"
  echo "対処方法:" | tee -a "${SCAN_FILE}"
  echo "  1. ハードコードされたシークレットをファイルから削除する" | tee -a "${SCAN_FILE}"
  echo "  2. AWS Secrets Manager / SSM Parameter Store に移行する" | tee -a "${SCAN_FILE}"
  echo "  3. 環境変数（.env / Lambda 環境変数）で参照する" | tee -a "${SCAN_FILE}"
  echo "  4. .gitignore に .env を追記してコミットしない" | tee -a "${SCAN_FILE}"
  cat "${SCAN_FILE}"
  exit 1
fi

echo "[RESULT] PASS — シークレットパターンは検出されませんでした (NFR-V305-M2 クリア)" | tee -a "${SCAN_FILE}"
echo "証拠ログ: ${SCAN_FILE}"
