# パフォーマンステスト手順書

## 概要

SABOROUの主要なNFR（非機能要件）のうち、パフォーマンスに関する検証手順を記載する。
本番環境へのデプロイ後に実施する。

---

## 対象NFR

| NFR ID | 要件 | 対象コンポーネント |
|--------|------|----------------|
| NFR-P1 | API レイテンシ P95 < 500ms | backend Lambda |
| NFR-P2 | SSE 初回チャンク < 2s | sabori-proposer |
| NFR-P3 | Webhook 処理 < 29s | task-extractor Lambda |
| NFR-WEB-P1 | LCP < 2.5s | frontend |
| NFR-WEB-P2 | FCP < 1.8s | frontend |

---

## 1. API レイテンシ確認（CloudWatch）

デプロイ後、CloudWatch でメトリクスを確認する。

```bash
# Lambda Duration メトリクス確認（AWS CLI）
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=saborou-api-dev \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics p95 \
  --region ap-northeast-1
```

合格基準: p95 < 500ms

---

## 2. SSE ストリーミング初回チャンク確認

```bash
# time コマンドで初回チャンクまでの時間を計測
time curl -N -s \
  -H "Authorization: Bearer <token>" \
  "https://<api-url>/api/tasks/<taskId>/proposals/stream" \
  | head -1
```

合格基準: 2秒以内に最初のイベント受信

---

## 3. フロントエンドの Core Web Vitals 確認

```bash
# Lighthouse CLI で計測
npx lighthouse https://<frontend-url> \
  --output json \
  --chrome-flags="--headless" \
  | jq '.audits["largest-contentful-paint"].numericValue'
```

または Chrome DevTools の Lighthouse タブで手動計測。

合格基準:
- LCP < 2500ms（グリーン）
- FCP < 1800ms（グリーン）

---

## 4. 負荷テスト（Artillery）

```bash
# Artillery インストール
npm install -g artillery

# 負荷テスト設定
cat > load-test.yml << 'EOF'
config:
  target: "https://<api-url>"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
      - get:
          url: "/api/tasks"
          headers:
            Authorization: "Bearer <token>"
EOF

artillery run load-test.yml
```

合格基準: P95 レイテンシ < 500ms、エラー率 < 0.1%

---

## 5. Lambda コールドスタート計測

```bash
# Lambda 関数を強制的に再デプロイしてコールドスタートを計測
aws lambda update-function-configuration \
  --function-name saborou-api-dev \
  --description "cold-start-test-$(date +%s)" \
  --region ap-northeast-1

# 直後にリクエスト送信
time curl -s https://<api-url>/health
```

合格基準: コールドスタート < 3s（ARM64 + ESM バンドル最適化済み）

---

## 6. DynamoDB スループット確認

```bash
# ConsumedReadCapacityUnits 確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=saborou-tasks-dev \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```

---

## ハッカソン規模でのパフォーマンス見通し

| シナリオ | 予想パフォーマンス | 根拠 |
|---------|----------------|------|
| API レイテンシ（ウォーム） | 50-200ms | esbuild バンドル + DynamoDB PAY_PER_REQUEST |
| API レイテンシ（コールド） | 1-3s | ARM64 Lambda + 286kb バンドル |
| SSE 初回チャンク | 0.5-2s | Bedrock converseStream の初回レスポンス |
| フロントエンド LCP | < 2.5s | CloudFront + S3、gzip 済み |
| タスク抽出完了 | 5-15s | Bedrock Tool Use + DynamoDB Write |

注意: ハッカソン規模（数十ユーザー）では PAY_PER_REQUEST で十分なスループットを確保できる。

---

---

# v3 パフォーマンステスト手順（MCP Serverization — 2026-06-18）

## v3 追加 NFR パフォーマンス要件

U-V3-01〜05 で定義された NFR のうち、パフォーマンスに関わる要件:

| NFR ID | 要件 | 対象コンポーネント |
|--------|------|----------------|
| NFR-V301-P1 | MCP アダプタ p99 レイテンシ < 800ms | `/api/mcp/tools/{toolName}` |
| NFR-V301-P2 | precheck + identity resolve < 100ms | MCP precheck ミドルウェア |
| NFR-V305-R1 | デモ当日の全テスト通過 | 全パッケージ |
| NFR-V305-A1 | デモ中 99% 以上の可用性 | AgentCore Gateway + Hono API |
| NFR-V305-A2 | フォールバック切替 < 10秒 | extension フォールバック |

---

## v3-1. MCP アダプタ レイテンシ確認（実環境）

```bash
# MCP アダプタ呼び出し時間計測（Cognito JWT 付き）
TOKEN="<cognito_jwt>"
time curl -s -w "\n%{time_total}s\n" \
  -X POST "https://<api-url>/api/mcp/tools/saborou_get_tasks" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"arguments": {}}'
```

合格基準: p99 < 800ms（ウォーム状態）

---

## v3-2. Precheck レイテンシ確認

CloudWatch Logs Insights で identity resolve の処理時間を確認:

```bash
# CloudWatch Logs Insights クエリ
aws logs start-query \
  --log-group-name "/aws/apigateway/saborou-api" \
  --start-time $(date -u -v-1H +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, duration | filter requestPath like "/mcp/tools" | stats avg(duration) as avgMs, pct(duration, 99) as p99Ms'
```

合格基準: avg < 50ms、p99 < 100ms

---

## v3-3. AgentCore → MCP エンドツーエンドレイテンシ確認

```bash
bash scripts/verify-agentcore.sh
```

出力に含まれる latency 計測値を確認:
- ElevenLabs → AgentCore → MCP → DynamoDB のエンドツーエンド: < 3000ms

---

## v3-4. フォールバック切替速度確認（extension）

extension の MCP フォールバック切替は JavaScript 同期処理のため、ユニットテストで検証済み:

```bash
pnpm --filter extension test -- --testPathPattern="mcpFallback"
```

確認ポイント: `getMcpFallbackMode()` が瞬時に（< 1ms）FallbackMode を返すこと

---

## v3 パフォーマンス見通し（MCP Serverization 追加後）

| シナリオ | 予想パフォーマンス | 根拠 |
|---------|----------------|------|
| MCP アダプタ（ウォーム） | 100-400ms | precheck + DynamoDB + Identity resolve |
| MCP アダプタ（コールド） | 2-5s | Lambda コールドスタート込み |
| AgentCore → MCP エンドツーエンド | 500-2000ms | AgentCore routing + adapter + backend |
| フォールバック切替（extension） | < 1ms | JavaScript 同期処理 |
| ElevenLabs 音声 → タスク取得 | 1-3s | ElevenLabs STT + AgentCore + MCP |

注意: デモ当日はウォーム状態を維持するため、DEMO_RUNBOOK.md の「デモ前ウォームアップ手順」を実施すること。
