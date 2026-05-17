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
