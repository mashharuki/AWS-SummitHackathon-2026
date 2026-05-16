# AWS Well-Architected Framework レビュー — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-16
**バージョン**: 1.0.0
**対象フェーズ**: Inception（設計レビュー）
**適用スキル**: aws-well-architected

---

## レビュー概要

SABOROU プロジェクトの設計を AWS Well-Architected Framework の6本柱で評価する。予選（2026-05-30）に向けた設計が Well-Architected の原則に沿っているか検証し、改善アクションを定義する。

---

## 1. 運用上の優秀性（Operational Excellence）

### 評価: B+（予選スコープとして十分）

| チェック項目 | 状態 | 対応計画 |
|------------|------|---------|
| CloudWatch Logs 設定 | 計画済み（NFR-11）| U-02 infra で全 Lambda に Log Group 設定（保持期間 14日） |
| CloudWatch Metrics/Alarms | 計画済み（NFR-11）| Lambda Errors / Duration / Throttles アラーム |
| X-Ray トレーシング | 計画済み（NFR-11）| API Gateway → Lambda → Bedrock の呼び出しチェーンを可視化 |
| デプロイ自動化 | 計画済み（GitHub Actions）| CDK deploy + S3 sync を CI/CD に組み込む（M3 決勝向け） |
| 運用ランブック | 未定義 | 予選スコープ外。デモ時の障害対応手順（バックアップ動画）で代替 |

**改善アクション（運用）**:
1. CloudWatch Dashboard を CDK で自動生成（Lambda Errors / Duration / Bedrock Cost を可視化）
2. X-Ray を Lambda 環境変数で有効化（`AWS_XRAY_TRACING_NAME` 設定）
3. デモ前チェックリスト: Lambda ウォームアップ → CloudWatch Logs 確認 → Slack Webhook 疎通確認

---

## 2. セキュリティ（Security）

### 評価: A-（ハッカソンスコープとして良好）

| チェック項目 | 状態 | 詳細 |
|------------|------|------|
| IAM 最小権限 | 設計済み | CDK で各 Lambda に最小権限ポリシーを個別付与（`table.grantReadWriteData(fn)` 等）|
| Secrets Manager | 設計済み（NFR-07）| Slack OAuth トークンを Secrets Manager に保管 |
| HTTPS 全通信 | 設計済み（NFR-07）| API Gateway + CloudFront で HTTPS 必須 |
| Cognito JWT 検証 | 設計済み | `aws-jwt-verify` ライブラリで全認証エンドポイントに JWT 検証 |
| Slack 署名検証 | 設計済み | `@slack/bolt` の署名検証ミドルウェアを使用 |
| 生データ不保持 | 設計済み（NFR-07）| Slack メッセージ本文は処理後即削除。DynamoDB にはサマリのみ保存 |
| API キーハードコード禁止 | 設計済み | 全シークレットは Secrets Manager / SSM Parameter Store |
| DynamoDB 暗号化 | デフォルト有効 | AWS 管理 KMS による暗号化（デフォルト） |
| S3 公開アクセス禁止 | 設計済み | CloudFront OAC 経由のみアクセス。BlockPublicAccess 有効 |
| CloudTrail | 未設定 | 予選スコープ外。決勝向けで設定検討 |

**改善アクション（セキュリティ）**:
1. CDK コードで `cdk-nag` の `AwsSolutionsChecks` を実行し準拠確認
2. Slack Signing Secret の有効期限管理ポリシーを Secrets Manager ローテーション設定で対応（M3）
3. 環境変数に機密情報を直接渡さない（Secrets Manager 参照を Lambda に設定）

---

## 3. 信頼性（Reliability）

### 評価: B（予選スコープとして許容）

| チェック項目 | 状態 | 詳細 |
|------------|------|------|
| Lambda 再試行設定 | 計画済み | EventBridge 経由の非同期実行は自動 2回リトライ |
| DynamoDB On-Demand | 設計済み（NFR-03）| PAY_PER_REQUEST で自動スケール |
| エラーハンドリング | 設計済み | Hono ミドルウェアで統一エラーレスポンス（NFR-08）|
| フォールバック設計 | 設計済み | `IBedrockClient` インタフェースでモック差し替え可能 |
| 単一障害点排除 | 限定的 | Lambda + DynamoDB はマルチAZ。Cognito Hosted UI はマルチAZ（デフォルト）|
| バックアップ | 未設定 | ハッカソン規模では DynamoDB Point-in-time Recovery（PITR）は不要 |
| サーキットブレーカー | 未実装 | Bedrock 障害時のフォールバックメッセージを Lambda レベルで実装 |

**改善アクション（信頼性）**:
1. Bedrock エラー時のフォールバックメッセージ（固定文「サボれるかどうか判定中だよぉ〜」）を実装
2. DynamoDB 書き込みエラー時のリトライロジック（指数バックオフ + 最大3回）を `errors/index.ts` に実装
3. Slack Webhook 受信後の非同期処理を EventBridge 経由にして、タイムアウトリスクを分離

---

## 4. パフォーマンス効率（Performance Efficiency）

### 評価: B（予選スコープとして許容）

| チェック項目 | 状態 | 詳細 |
|------------|------|------|
| Lambda メモリサイズ最適化 | 未確定 | task-extractor: 512MB / sabori-proposer: 1024MB を初期設定 |
| Provisioned Concurrency | デモ前ウォームアップで代替 | 本番環境（M3）で検討。デモ前スクリプトでウォームアップ |
| Bedrock streaming（SSE） | 設計済み（NFR-01b）| Lambda Response Streaming + Function URL |
| DynamoDB GSI 設計 | 設計済み（unit-of-work.md §8）| アクセスパターン別 GSI を定義済み |
| CloudFront CDN | 設計済み | フロントエンド（S3）を CloudFront で配信 |
| API Gateway タイムアウト回避 | 設計済み | SSEは Lambda Function URL を使用（API GW 29秒制限を回避）|

**Lambda メモリ設定（初期値）**:
```
task-extractor Lambda:    512MB, Timeout: 60s
sabori-proposer Lambda:  1024MB, Timeout: 120s（Streaming 対応）
webhook Lambda:           256MB, Timeout: 30s
api Lambda:               512MB, Timeout: 30s
background-refresh:       512MB, Timeout: 300s
```

**改善アクション（パフォーマンス）**:
1. 決勝（M3）では `aws-lambda-power-tuning` で最適メモリサイズを検証
2. Bedrock クロスリージョン推論が必要な場合（ap-northeast-1 でモデル未対応時）は `us-west-2` へのルーティングを確認し、レイテンシへの影響を NFR-01a に反映
3. DynamoDB Read/Write の TPS が想定を超えた場合に備えてオートスケーリング設定（M3）

---

## 5. コスト最適化（Cost Optimization）

### 評価: A（設計として優秀）

| チェック項目 | 状態 | 詳細 |
|------------|------|------|
| サーバーレス優先 | 設計済み | 全コンピュートが Lambda（常時稼働インスタンスなし）|
| DynamoDB On-Demand | 設計済み | 低負荷期間のコスト最小化（NFR-03: 1〜5同時ユーザー）|
| CloudWatch ログ保持期間 14日 | 設計済み（NFR-11）| 長期ログ蓄積によるコスト増加を防止 |
| Bedrock 月額 $50 上限 | 設計済み（NFR-06）| AWS Budgets で $30 警告 / $50 通知 |
| トークン数ガード | 設計済み（NFR-06）| `guardTokenLimit()` で 8,000 トークン以内に制限 |
| S3 ストレージコスト | 微小 | 静的フロントエンドのみ。Intelligent-Tiering 不要（小規模）|
| EC2 / RDS 不使用 | 設計済み | 常時稼働インスタンスなし |

**月額コスト試算（デモ環境・NFR-06）**:
```
Lambda:           ~$0（Free Tier 内）
API Gateway:      ~$0（リクエスト数が少ない）
DynamoDB:         ~$0.25（On-Demand・小規模）
CloudFront + S3:  ~$0.50
Cognito:          ~$0（MAU 50人未満）
Bedrock:          ~$20〜30（デモ・テスト込み）
Secrets Manager:  ~$0.40（2シークレット）
CloudWatch:       ~$1（Logs + Alarms）
-----------------------------------------
合計:             ~$22〜$32/月（NFR-06 の$70以内を達成）
```

**改善アクション（コスト）**:
1. ローカル開発・CI では Bedrock を完全モック化（不要なリクエストコストを排除）
2. CDK で CloudWatch Logs の保持期間を `logs.RetentionDays.TWO_WEEKS` に明示設定
3. 決勝（M3）では Compute Optimizer でメモリ最適化を実施

---

## 6. 持続可能性（Sustainability）

### 評価: A-（サーバーレス設計が最適）

| チェック項目 | 状態 | 詳細 |
|------------|------|------|
| サーバーレス（低消費電力）| 設計済み | Lambda はリクエスト時のみ稼働。常時電力消費なし |
| 不要リソースの自動削除（TTL）| 設計済み（NFR-07）| 外部ツール生データに TTL 設定（処理後即削除）|
| リージョン選択 | ap-northeast-1 | 再生可能エネルギー導入が進む AWS 東京リージョン |
| Over-provisioning 排除 | 設計済み | DynamoDB On-Demand（使った分だけ課金） |
| CloudFront キャッシュ | 設計済み | 静的アセットのキャッシュでオリジンサーバーへのリクエスト削減 |

**改善アクション（持続可能性）**:
1. Lambda の Cold Start 後のコンテナ再利用を最大化（モジュールを関数外でキャッシュ）
2. Bedrock 推論の結果を DynamoDB にキャッシュし、同一タスクへの重複推論を抑制

---

## Well-Architected サマリー評価

| 柱 | スコア | 主な理由 |
|----|--------|---------|
| 運用上の優秀性 | B+ | CloudWatch/X-Ray 設計済み。自動化は M3 |
| セキュリティ | A- | IAM最小権限・Secrets Manager・JWT検証が設計済み |
| 信頼性 | B | フォールバック設計あり。バックアップは予選スコープ外 |
| パフォーマンス効率 | B | Lambda Function URL でSSE問題を解決。Cold Start はデモ前ウォームアップで対応 |
| コスト最適化 | A | サーバーレス完全採用・月額$30以内の設計 |
| 持続可能性 | A- | サーバーレス + 東京リージョン + TTL設計 |
| **総合** | **B+** | **ハッカソン予選スコープとして十分。決勝（M3）に向けてA評価を目指す** |

---

## 次のアクション（優先順位付き）

1. **即時対応（Day 1-2）**: CDK コードに `cdk-nag` を組み込んでセキュリティ準拠を確認
2. **Day 3-5**: CloudWatch Dashboard と Bedrock コストアラームを CDK で自動生成
3. **Day 6-8**: `IBedrockClient` インタフェース設計を確定し、モック実装と converse 実装を分離
4. **デモ前（Day 14）**: Lambda ウォームアップスクリプトを実行・CloudWatch で正常稼働を確認
5. **M3（決勝）**: Provisioned Concurrency 検討 / aws-lambda-power-tuning 実施 / CloudTrail 設定

---

*本文書は aws-well-architected スキルを適用して生成された設計評価書です。*
