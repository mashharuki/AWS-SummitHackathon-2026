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
# シークレットパターン定義
# パターン名 → 正規表現
# =====================
declare -A PATTERNS
PATTERNS["ElevenLabs_API_KEY"]="sk-[a-zA-Z0-9]{32,}"
PATTERNS["Slack_Token_Bot"]="xox[bp]-[0-9]+-[a-zA-Z0-9-]+"
PATTERNS["AWS_Access_Key_ID"]="AKIA[A-Z0-9]{16}"
PATTERNS["Hardcoded_SecretARN"]="arn:aws:secretsmanager:[a-z0-9-]+:[0-9]{12}:secret:[a-zA-Z0-9/+=.@_-]+"
PATTERNS["GitHub_PAT"]="ghp_[a-zA-Z0-9]{36,}"
PATTERNS["Generic_API_Key"]="api[_-]?key['\"]?\s*[:=]\s*['\"][a-zA-Z0-9_-]{20,}['\"]"

TOTAL_ISSUES=0

for dir in "${SCAN_TARGETS[@]}"; do
  echo "--- スキャン: ${dir} ---" | tee -a "${SCAN_FILE}"

  for pattern_name in "${!PATTERNS[@]}"; do
    pattern="${PATTERNS[$pattern_name]}"

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
      | grep -v ".env.example" \
      | grep -v "\.d\.ts:" \
      | grep -v "# example:" \
      | grep -v "# 取得方法:" \
      | grep -v "# 実行方法:" \
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
