# ログ取得・監視コマンド集

**プロジェクト名**: SABOROU（サボロー）  
**バージョン**: v1.0.0  
**作成日**: 2026-05-22  
**対象**: バックエンド Lambda / AI Agent Lambda の CloudWatch Logs 監視  
**リージョン**: ap-northeast-1

---

## ログ対象一覧

| Lambda 名 | ロググループ | 役割 |
|----------|------------|------|
| `saborou-api-dev` | `/aws/lambda/saborou-api-dev` | Hono API（REST / SSE） |
| `saborou-webhook-dev` | `/aws/lambda/saborou-webhook-dev` | Slack Webhook 受信 |
| `saborou-task-extractor-dev` | `/aws/lambda/saborou-task-extractor-dev` | AI Agent: タスク抽出 |
| `saborou-sabori-proposer-dev` | `/aws/lambda/saborou-sabori-proposer-dev` | AI Agent: サボり判定 |

> `dev` を `prod` に読み替えると本番環境のロググループ名になる。

---

## 共通設定

```bash
# 環境変数（以降のコマンドで共通使用）
export ENV=dev
export REGION=ap-northeast-1

# ロググループ名のエイリアス
export LG_API="/aws/lambda/saborou-api-${ENV}"
export LG_WEBHOOK="/aws/lambda/saborou-webhook-${ENV}"
export LG_EXTRACTOR="/aws/lambda/saborou-task-extractor-${ENV}"
export LG_PROPOSER="/aws/lambda/saborou-sabori-proposer-${ENV}"
```

---

## 1. リアルタイム追跡（`aws logs tail`）

デモ当日やデバッグ時に最も頻繁に使う。  
`--follow` を付けると新しいログが届くたびにリアルタイム表示される。

### 1-1. Hono API（REST / SSE）

```bash
# リアルタイム追跡（全ログ）
aws logs tail ${LG_API} \
  --region ${REGION} \
  --follow \
  --format short

# 直近5分のエラーのみ
aws logs tail ${LG_API} \
  --region ${REGION} \
  --since 5m \
  --filter-pattern '"level":"ERROR"'
```

### 1-2. Slack Webhook Lambda

```bash
# リアルタイム追跡
aws logs tail ${LG_WEBHOOK} \
  --region ${REGION} \
  --follow \
  --format short

# Slack 署名検証エラーのみ抽出
aws logs tail ${LG_WEBHOOK} \
  --region ${REGION} \
  --since 10m \
  --filter-pattern '"Invalid Slack signature"'

# EventBridge 転送失敗のみ抽出
aws logs tail ${LG_WEBHOOK} \
  --region ${REGION} \
  --since 10m \
  --filter-pattern '"EventBridge put failed"'
```

### 1-3. TaskExtractor Agent（タスク自動抽出）

```bash
# リアルタイム追跡
aws logs tail ${LG_EXTRACTOR} \
  --region ${REGION} \
  --follow \
  --format short

# 直近10分のログを全表示
aws logs tail ${LG_EXTRACTOR} \
  --region ${REGION} \
  --since 10m

# エラーのみ
aws logs tail ${LG_EXTRACTOR} \
  --region ${REGION} \
  --since 10m \
  --filter-pattern '"level":"ERROR"'

# タスク抽出成功ログのみ（action: extracted）
aws logs tail ${LG_EXTRACTOR} \
  --region ${REGION} \
  --since 10m \
  --filter-pattern '"action":"extracted"'
```

### 1-4. SaboriProposer Agent（サボり判定）

```bash
# リアルタイム追跡
aws logs tail ${LG_PROPOSER} \
  --region ${REGION} \
  --follow \
  --format short

# 判定完了ログのみ（verdict 付き）
aws logs tail ${LG_PROPOSER} \
  --region ${REGION} \
  --since 10m \
  --filter-pattern '"action":"sabori_proposer_complete"'

# Bedrock 判定完了ログのみ
aws logs tail ${LG_PROPOSER} \
  --region ${REGION} \
  --since 10m \
  --filter-pattern '"action":"sabori_judgment_complete"'

# SSE ストリームエラーのみ
aws logs tail ${LG_PROPOSER} \
  --region ${REGION} \
  --since 10m \
  --filter-pattern '"action":"sabori_propose_stream_error"'
```

---

## 2. フィルター検索（`aws logs filter-log-events`）

時間範囲を指定してログを絞り込みたい場合に使用する。

### 2-1. 過去N分のエラーを全 Lambda から一括取得

```bash
# 直近15分のエラーを全Lambdaから横断検索
for LG in ${LG_API} ${LG_WEBHOOK} ${LG_EXTRACTOR} ${LG_PROPOSER}; do
  echo "=== ${LG} ==="
  aws logs filter-log-events \
    --log-group-name "${LG}" \
    --region ${REGION} \
    --start-time $(( $(date +%s) - 900 ))000 \
    --filter-pattern '"level":"ERROR"' \
    --query 'events[*].message' \
    --output text
done
```

### 2-2. 特定 taskId のログを追跡

```bash
# 特定タスクIDに関連するログを全Lambdaから横断検索
TASK_ID="YOUR_TASK_ID_HERE"

for LG in ${LG_API} ${LG_EXTRACTOR} ${LG_PROPOSER}; do
  echo "=== ${LG} ==="
  aws logs filter-log-events \
    --log-group-name "${LG}" \
    --region ${REGION} \
    --start-time $(( $(date +%s) - 3600 ))000 \
    --filter-pattern "\"${TASK_ID}\"" \
    --query 'events[*].{time:timestamp,msg:message}' \
    --output json
done
```

### 2-3. Bedrock 呼び出し関連ログの抽出

```bash
# TaskExtractor の Bedrock ログ（Tool Use 結果含む）
aws logs filter-log-events \
  --log-group-name "${LG_EXTRACTOR}" \
  --region ${REGION} \
  --start-time $(( $(date +%s) - 1800 ))000 \
  --filter-pattern '?"bedrock_no_tool_use" ?"bedrock_output_invalid" ?"extracted"' \
  --query 'events[*].message' \
  --output text

# SaboriProposer の Bedrock 判定ログ
aws logs filter-log-events \
  --log-group-name "${LG_PROPOSER}" \
  --region ${REGION} \
  --start-time $(( $(date +%s) - 1800 ))000 \
  --filter-pattern '?"sabori_judgment_complete" ?"sabori_judgment_no_tool_use" ?"sabori_judgment_invalid_output"' \
  --query 'events[*].message' \
  --output text
```

### 2-4. 特定の verdict（can_saboru / borderline / must_do）を抽出

```bash
# can_saboru 判定のみ
aws logs filter-log-events \
  --log-group-name "${LG_PROPOSER}" \
  --region ${REGION} \
  --start-time $(( $(date +%s) - 86400 ))000 \
  --filter-pattern '"verdict":"can_saboru"' \
  --query 'events[*].message' \
  --output text

# must_do 判定（緊急タスク）のみ
aws logs filter-log-events \
  --log-group-name "${LG_PROPOSER}" \
  --region ${REGION} \
  --start-time $(( $(date +%s) - 86400 ))000 \
  --filter-pattern '"verdict":"must_do"' \
  --query 'events[*].message' \
  --output text
```

### 2-5. SSE ストリーミング関連ログ

```bash
# SSE ストリーム開始〜完了のフロー確認
aws logs filter-log-events \
  --log-group-name "${LG_PROPOSER}" \
  --region ${REGION} \
  --start-time $(( $(date +%s) - 1800 ))000 \
  --filter-pattern '?"sabori_propose_stream_start" ?"sabori_propose_stream_complete" ?"sabori_propose_stream_error"' \
  --query 'events[*].message' \
  --output text
```

---

## 3. CloudWatch Logs Insights クエリ

AWS コンソール → CloudWatch → Logs Insights で実行する。  
複数ロググループを一度にクエリできる点が `aws logs tail` より優れている。

### 3-1. 全 Lambda エラー集計（直近1時間）

```sql
fields @timestamp, level, unit, action, @logStream
| filter level = "ERROR"
| sort @timestamp desc
| limit 50
```

**対象ロググループ**（Logs Insights でマルチ選択）:
- `/aws/lambda/saborou-api-dev`
- `/aws/lambda/saborou-webhook-dev`
- `/aws/lambda/saborou-task-extractor-dev`
- `/aws/lambda/saborou-sabori-proposer-dev`

---

### 3-2. タスク抽出フロー追跡

```sql
fields @timestamp, level, action, candidateId, sourceRef
| filter unit = "saborou-task-extractor-dev"
| sort @timestamp desc
| limit 20
```

**期待されるアクション一覧**:

| action | 意味 |
|--------|------|
| `extracted` | タスク候補抽出成功（`candidateId` フィールドあり） |
| `skipped_not_task` | タスクと判定されなかったメッセージ |
| `invalid_input` | EventBridge ペイロードの Zod バリデーション失敗 |
| `skipped` | TaskExtractorHandler レベルのスキップ |
| `completed` | ハンドラー正常完了（`candidateId`, `sourceRef` フィールドあり） |
| `bedrock_no_tool_use` | Bedrock が Tool Use を返さなかった（異常） |
| `bedrock_output_invalid` | Bedrock 出力の Zod バリデーション失敗 |

---

### 3-3. サボり判定フロー追跡

```sql
fields @timestamp, level, action, taskId, verdict, userId
| filter unit = "saborou-sabori-proposer-dev"
| sort @timestamp desc
| limit 20
```

**期待されるアクション一覧**:

| action | フェーズ | 意味 |
|--------|---------|------|
| `sabori_propose_start` | 開始 | propose() 呼び出し開始 |
| `sabori_judgment_complete` | Phase 2 | Bedrock 判定完了（`verdict` フィールドあり） |
| `sabori_judgment_no_tool_use` | Phase 2 エラー | Tool Use なし（Bedrock 異常） |
| `sabori_judgment_invalid_output` | Phase 2 エラー | 出力 Zod バリデーション失敗 |
| `sabori_propose_complete` | 完了 | propose() 正常完了 |
| `sabori_propose_stream_start` | SSE 開始 | proposeStream() 開始 |
| `sabori_propose_stream_complete` | SSE 完了 | ストリーム正常完了 |
| `sabori_propose_stream_error` | SSE エラー | ストリームエラー |
| `sabori_propose_stream_parse_error` | SSE エラー | JSON パース失敗 |
| `sabori_proposer_complete` | ハンドラー完了 | Lambda ハンドラー正常完了（`verdict`, `userId` フィールドあり） |
| `sabori_proposer_invalid_input` | ハンドラーエラー | Zod バリデーション失敗 |
| `sabori_proposer_slack_context_failed` | 非致命的エラー | Slack コンテキスト取得失敗（処理は続行） |
| `sabori_proposer_background_refresh_skipped` | スケジューラー | EventBridge Scheduler からの起動（MVP stub） |

---

### 3-4. API リクエスト遅延分析

```sql
fields @timestamp, method, path, status, durationMs
| filter action = "request"
| sort durationMs desc
| limit 20
```

**対象**: `/aws/lambda/saborou-api-dev`

---

### 3-5. Slack Webhook 受信確認

```sql
fields @timestamp, level, @message
| filter @logStream like /saborou-webhook/
| sort @timestamp desc
| limit 20
```

**キーワードで絞り込む場合**:
```sql
fields @timestamp, @message
| filter @message like "WEBHOOK"
| sort @timestamp desc
| limit 20
```

---

## 4. Dead Letter Queue（DLQ）の確認

Lambda がリトライを超えて失敗した場合のメッセージが DLQ に溜まる。

### 4-1. DLQ のメッセージ数を確認

```bash
# TaskExtractor DLQ
aws sqs get-queue-attributes \
  --queue-url "$(aws sqs get-queue-url \
    --queue-name saborou-task-extractor-dlq-${ENV} \
    --region ${REGION} \
    --query QueueUrl --output text)" \
  --attribute-names ApproximateNumberOfMessages \
  --region ${REGION} \
  --query 'Attributes.ApproximateNumberOfMessages'

# SaboriProposer DLQ
aws sqs get-queue-attributes \
  --queue-url "$(aws sqs get-queue-url \
    --queue-name saborou-sabori-proposer-dlq-${ENV} \
    --region ${REGION} \
    --query QueueUrl --output text)" \
  --attribute-names ApproximateNumberOfMessages \
  --region ${REGION} \
  --query 'Attributes.ApproximateNumberOfMessages'

# EventBridge Rule DLQ（Webhook → TaskExtractor ルーティング失敗）
aws sqs get-queue-attributes \
  --queue-url "$(aws sqs get-queue-url \
    --queue-name saborou-rule-dlq-${ENV} \
    --region ${REGION} \
    --query QueueUrl --output text)" \
  --attribute-names ApproximateNumberOfMessages \
  --region ${REGION} \
  --query 'Attributes.ApproximateNumberOfMessages'
```

> 全て `"0"` なら正常。`"1"` 以上はリトライ失敗が発生している。

### 4-2. DLQ のメッセージ内容を取得

```bash
QUEUE_URL=$(aws sqs get-queue-url \
  --queue-name saborou-task-extractor-dlq-${ENV} \
  --region ${REGION} \
  --query QueueUrl --output text)

aws sqs receive-message \
  --queue-url "${QUEUE_URL}" \
  --region ${REGION} \
  --max-number-of-messages 10 \
  --query 'Messages[*].Body' \
  --output text | python3 -m json.tool
```

---

## 5. Lambda 直接呼び出しテスト

デプロイ後に各 Lambda を直接 invoke してログを確認する最速の方法。

### 5-1. TaskExtractor をテストイベントで起動

```bash
# テスト用 Slack EventBridge ペイロード
cat > /tmp/test-event-extractor.json << 'EOF'
{
  "source": "saborou.webhook",
  "detail-type": "SlackEvent",
  "detail": {
    "event": {
      "type": "message",
      "user": "U12345678",
      "text": "明日のプレゼン資料、今日中に仕上げておいてください",
      "ts": "1234567890.123456",
      "channel": "C12345678"
    },
    "teamId": "T12345678",
    "receivedAt": "2026-05-22T10:00:00.000Z"
  }
}
EOF

aws lambda invoke \
  --function-name saborou-task-extractor-${ENV} \
  --region ${REGION} \
  --payload file:///tmp/test-event-extractor.json \
  --cli-binary-format raw-in-base64-out \
  /tmp/response-extractor.json \
  --log-type Tail \
  --query 'LogResult' \
  --output text | base64 -d
```

### 5-2. SaboriProposer をテストイベントで起動

```bash
# テスト用 Proposal ペイロード（DynamoDB に対象タスクが必要）
cat > /tmp/test-event-proposer.json << 'EOF'
{
  "taskId": "demo-task-001",
  "userId": "demo-user-001",
  "task": {
    "PK": "USER#demo-user-001",
    "SK": "TASK#demo-task-001",
    "taskId": "demo-task-001",
    "userId": "demo-user-001",
    "status": "approved",
    "title": "提案資料の初稿作成",
    "deadline": null,
    "requester": "U_REQUESTER",
    "description": "来週のミーティング用の提案資料を作成してください",
    "sourceType": "slack",
    "approvedAt": "2026-05-22T09:00:00.000Z",
    "updatedAt": "2026-05-22T09:00:00.000Z"
  }
}
EOF

aws lambda invoke \
  --function-name saborou-sabori-proposer-${ENV} \
  --region ${REGION} \
  --payload file:///tmp/test-event-proposer.json \
  --cli-binary-format raw-in-base64-out \
  /tmp/response-proposer.json \
  --log-type Tail \
  --query 'LogResult' \
  --output text | base64 -d

# レスポンス確認（verdict が含まれているか）
echo "--- Response ---"
cat /tmp/response-proposer.json | python3 -m json.tool
```

### 5-3. Webhook Lambda の url_verification を模擬

```bash
# url_verification テスト（Signing Secretなしの場合は403が返る想定）
cat > /tmp/test-webhook-verify.json << 'EOF'
{
  "httpMethod": "POST",
  "headers": {
    "content-type": "application/json",
    "x-slack-request-timestamp": "9999999999",
    "x-slack-signature": "v0=dummy_signature"
  },
  "body": "{\"type\":\"url_verification\",\"challenge\":\"test_challenge_value\"}",
  "isBase64Encoded": false
}
EOF

aws lambda invoke \
  --function-name saborou-webhook-${ENV} \
  --region ${REGION} \
  --payload file:///tmp/test-webhook-verify.json \
  --cli-binary-format raw-in-base64-out \
  /tmp/response-webhook.json \
  --log-type Tail \
  --query 'LogResult' \
  --output text | base64 -d
```

---

## 6. デモ当日の確認コマンドまとめ

デモ開始前・デモ中に使うコマンドを1カ所に集約する。

### デモ開始前チェックリスト（コマンド実行順）

```bash
# 1. 全 Lambda が Active（起動可能）状態か確認
for FN in saborou-api-${ENV} saborou-webhook-${ENV} \
          saborou-task-extractor-${ENV} saborou-sabori-proposer-${ENV}; do
  STATE=$(aws lambda get-function-configuration \
    --function-name ${FN} --region ${REGION} \
    --query 'State' --output text 2>/dev/null || echo "NOT_FOUND")
  echo "${FN}: ${STATE}"
done

# 2. DLQ がすべて空か確認（"0" なら正常）
for Q in saborou-task-extractor-dlq-${ENV} \
         saborou-sabori-proposer-dlq-${ENV} \
         saborou-rule-dlq-${ENV}; do
  URL=$(aws sqs get-queue-url --queue-name ${Q} \
        --region ${REGION} --query QueueUrl --output text 2>/dev/null)
  COUNT=$(aws sqs get-queue-attributes --queue-url "${URL}" \
          --attribute-names ApproximateNumberOfMessages \
          --region ${REGION} \
          --query 'Attributes.ApproximateNumberOfMessages' \
          --output text 2>/dev/null || echo "N/A")
  echo "${Q}: ${COUNT} messages"
done

# 3. 直近5分のエラーがないか確認
echo "=== Recent ERRORs ==="
for LG in ${LG_API} ${LG_WEBHOOK} ${LG_EXTRACTOR} ${LG_PROPOSER}; do
  COUNT=$(aws logs filter-log-events \
    --log-group-name "${LG}" \
    --region ${REGION} \
    --start-time $(( $(date +%s) - 300 ))000 \
    --filter-pattern '"level":"ERROR"' \
    --query 'length(events)' \
    --output text 2>/dev/null || echo "0")
  echo "${LG}: ${COUNT} errors"
done
```

### デモ中：Slack → タスク抽出フロー監視（別ターミナルで実行）

```bash
# Terminal A: Webhook ログ監視
aws logs tail ${LG_WEBHOOK} --region ${REGION} --follow --format short

# Terminal B: TaskExtractor ログ監視
aws logs tail ${LG_EXTRACTOR} --region ${REGION} --follow --format short

# Terminal C: SaboriProposer ログ監視（verdict が出力されるのを待つ）
aws logs tail ${LG_PROPOSER} --region ${REGION} --follow \
  --filter-pattern '"verdict"'
```

---

## 構造化ログ フォーマット参照

### Agent ログ（`pkgs/agent/src/utils/logger.ts`）

```json
{
  "level": "INFO",
  "unit": "saborou-task-extractor-dev",
  "timestamp": "2026-05-22T10:00:00.000Z",
  "action": "extracted",
  "candidateId": "cand_xxxx",
  "sourceRef": "1234567890.123456"
}
```

### バックエンド リクエストログ（`pkgs/backend/src/middleware/logger.ts`）

```json
{
  "level": "INFO",
  "action": "request",
  "method": "GET",
  "path": "/api/tasks",
  "status": 200,
  "durationMs": 45
}
```

### Webhook ログ（`pkgs/backend/src/routes/webhooks.ts`）

```json
{ "level": "WARN", "message": "[WEBHOOK] Invalid Slack signature", "timestamp": "..." }
{ "level": "ERROR", "message": "[WEBHOOK] EventBridge put failed", "error": "..." }
```

---

## 関連ドキュメント

| ドキュメント | パス |
|------------|------|
| Slack App 設定ガイド | `aidlc-docs/operations/slack-app-setup.md` |
| CDK 操作ガイド | `aidlc-docs/operations/cdk-operations.md` |
| API 動作検証ガイド | `aidlc-docs/operations/api-verification-guide.md` |
| バックエンド操作ガイド | `aidlc-docs/operations/backend-operations.md` |
| Agent ロガー実装 | `pkgs/agent/src/utils/logger.ts` |
| バックエンド ロガー実装 | `pkgs/backend/src/middleware/logger.ts` |

---

*本文書は AI-DLC OPERATIONS フェーズの成果物です（v1.0.0 作成: 2026-05-22）。*
