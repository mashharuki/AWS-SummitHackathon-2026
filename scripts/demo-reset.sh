#!/usr/bin/env bash
set -euo pipefail

# U-V3-05: NFR-V305-A2 — デモデータリセットスクリプト
# 対応NFR: NFR-V305-A2 (High) — デモ前の DynamoDB テストデータクリーンアップ
# 必須環境変数:
#   AWS_REGION       : デプロイリージョン (例: ap-northeast-1)
#   DEMO_USER_ID     : デモ用ユーザーID (例: demo-user-01)
#   TASKS_TABLE      : DynamoDB Tasks テーブル名
#                      取得方法:
#                        aws cloudformation describe-stacks \
#                          --stack-name SaborouStack \
#                          --query 'Stacks[0].Outputs[?OutputKey==`TasksTableName`].OutputValue' \
#                          --output text
#   PROPOSALS_TABLE  : DynamoDB Proposals テーブル名
#                      取得方法:
#                        aws cloudformation describe-stacks \
#                          --stack-name SaborouStack \
#                          --query 'Stacks[0].Outputs[?OutputKey==`ProposalsTableName`].OutputValue' \
#                          --output text
# 実行方法:
#   AWS_REGION=ap-northeast-1 \
#   DEMO_USER_ID=demo-user-01 \
#   TASKS_TABLE=saborou-tasks-prod \
#   PROPOSALS_TABLE=saborou-proposals-prod \
#   ./scripts/demo-reset.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${ROOT_DIR}/evidence/A2-demo-reset"

mkdir -p "${EVIDENCE_DIR}"
LOG_FILE="${EVIDENCE_DIR}/reset-run-$(date +%Y%m%dT%H%M%S).log"

echo "=== U-V3-05 NFR-V305-A2: デモデータリセット ===" | tee "${LOG_FILE}"
echo "実行開始: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "${LOG_FILE}"
echo "" | tee -a "${LOG_FILE}"

# 必須環境変数チェック
MISSING_VARS=()
[ -z "${AWS_REGION:-}"      ] && MISSING_VARS+=("AWS_REGION")
[ -z "${DEMO_USER_ID:-}"    ] && MISSING_VARS+=("DEMO_USER_ID")
[ -z "${TASKS_TABLE:-}"     ] && MISSING_VARS+=("TASKS_TABLE")
[ -z "${PROPOSALS_TABLE:-}" ] && MISSING_VARS+=("PROPOSALS_TABLE")

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "[ERROR] 以下の環境変数が未設定です:" | tee -a "${LOG_FILE}"
  for v in "${MISSING_VARS[@]}"; do
    echo "  - ${v}" | tee -a "${LOG_FILE}"
  done
  echo "" | tee -a "${LOG_FILE}"
  echo "ヒント: CDK outputs から取得する場合:" | tee -a "${LOG_FILE}"
  echo "  aws cloudformation describe-stacks --stack-name SaborouStack \\" | tee -a "${LOG_FILE}"
  echo "    --query 'Stacks[0].Outputs' --output table" | tee -a "${LOG_FILE}"
  exit 1
fi

echo "設定値:" | tee -a "${LOG_FILE}"
echo "  AWS_REGION:      ${AWS_REGION}" | tee -a "${LOG_FILE}"
echo "  DEMO_USER_ID:    ${DEMO_USER_ID}" | tee -a "${LOG_FILE}"
echo "  TASKS_TABLE:     ${TASKS_TABLE}" | tee -a "${LOG_FILE}"
echo "  PROPOSALS_TABLE: ${PROPOSALS_TABLE}" | tee -a "${LOG_FILE}"
echo "" | tee -a "${LOG_FILE}"

# =====================
# テーブルから DEMO_USER_ID のアイテムを削除する汎用関数
# 引数: table_name, partition_key_name, sort_key_name (optional)
# =====================
delete_user_items() {
  local table="$1"
  local pk_name="$2"
  local pk_value="${DEMO_USER_ID}"

  echo "--- [RESET] ${table} の ${pk_name}=${pk_value} アイテム削除 ---" | tee -a "${LOG_FILE}"

  # アイテムのソートキー (id) をクエリで取得
  ITEM_IDS=$(aws dynamodb query \
    --table-name "${table}" \
    --key-condition-expression "#pk = :pkval" \
    --expression-attribute-names "{\"#pk\":\"${pk_name}\"}" \
    --expression-attribute-values "{\":pkval\":{\"S\":\"${pk_value}\"}}" \
    --region "${AWS_REGION}" \
    --projection-expression "id" \
    --query 'Items[*].id.S' \
    --output text 2>&1) || {
    echo "[WARN] テーブル ${table} のクエリに失敗しました: ${ITEM_IDS}" | tee -a "${LOG_FILE}"
    return 0
  }

  if [ -z "${ITEM_IDS}" ] || [ "${ITEM_IDS}" = "None" ]; then
    echo "削除対象のアイテムなし（クリーン状態）" | tee -a "${LOG_FILE}"
    return 0
  fi

  DELETE_COUNT=0
  for item_id in ${ITEM_IDS}; do
    aws dynamodb delete-item \
      --table-name "${table}" \
      --key "{\"${pk_name}\":{\"S\":\"${pk_value}\"},\"id\":{\"S\":\"${item_id}\"}}" \
      --region "${AWS_REGION}" >> "${LOG_FILE}" 2>&1 && {
      echo "  削除: id=${item_id}" | tee -a "${LOG_FILE}"
      DELETE_COUNT=$((DELETE_COUNT + 1))
    } || {
      echo "  [WARN] 削除失敗: id=${item_id}" | tee -a "${LOG_FILE}"
    }
  done

  echo "削除完了: ${DELETE_COUNT} 件" | tee -a "${LOG_FILE}"
}

# Tasks テーブルリセット
delete_user_items "${TASKS_TABLE}" "userId"
echo "" | tee -a "${LOG_FILE}"

# Proposals テーブルリセット
delete_user_items "${PROPOSALS_TABLE}" "userId"
echo "" | tee -a "${LOG_FILE}"

echo "================================" | tee -a "${LOG_FILE}"
echo "[RESULT] デモデータリセット完了" | tee -a "${LOG_FILE}"
echo "ログ: ${LOG_FILE}" | tee -a "${LOG_FILE}"
echo ""
echo "次のステップ（DEMO_RUNBOOK.md 参照）:"
echo "  1. ElevenLabs Agent ウォームアップ（音声テスト送信）"
echo "  2. ブラウザで SABOROU UI を開いてタスク一覧が空であることを確認"
echo "  3. DEMO_RUNBOOK.md の「メインデモシナリオ」を実行"
