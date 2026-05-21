# NFR 要件定義 — U-02: infra

**Unit**: U-02: infra
**ステージ**: CONSTRUCTION / NFR Requirements
**作成日**: 2026-05-17
**バージョン**: 1.0.0
**参照**:
- `inception/requirements/requirements.md`（NFR-01〜NFR-11）
- `inception/application-design/well-architected-review.md`
- `construction/shared/nfr-requirements/nfr-requirements.md`（品質最大化方針を継承）

---

## 方針確認

U-01 にて確定した品質最大化方針を U-02 に継承する:
> 「時間の制約は一旦気にせず、できるだけ高いレベルで仕上げたい」

**U-02 固有の最重要 NFR**: セキュリティ（最小権限 IAM）・コスト最適化（サーバーレス）・再現可能デプロイ（IaC）

---

## 1. セキュリティ要件（NFR-I1）

### NFR-I1a: IAM 最小権限

| 項目 | 要件 |
|------|------|
| 原則 | すべての Lambda IAM ロールは必要な操作のみを許可（最小権限の原則）|
| 付与方法 | CDK の `grant*()` メソッドを使用（手書き IAM Policy Statement は避ける）|
| ワイルドカード禁止 | `Action: "*"` または `Resource: "*"` を使用しない |
| スタック横断禁止 | スタック B が スタック A のリソースに直接アクセスできる IAM ポリシーを作らない（Props 経由で ARN を渡し `grant*()` で付与）|
| `cdk-nag` 適用 | `AwsSolutionsChecks` を有効化し IAM 違反を自動検出 |

### NFR-I1b: シークレット管理

| 項目 | 要件 |
|------|------|
| 保管先 | Slack OAuth トークン / Slack Signing Secret / Google OAuth トークン は Secrets Manager |
| 参照方法 | CDK の `Secret.fromSecretNameV2()` でシークレット ARN を取得し Lambda 環境変数として注入 |
| 値の公開禁止 | シークレット値を CDK コード・環境変数の値フィールドにハードコードしない |
| SSM 活用 | 非機密の設定値（clientId 等）は SSM Parameter Store に格納 |

### NFR-I1c: ネットワークセキュリティ

| 項目 | 要件 |
|------|------|
| VPC 使用 | 不使用（サーバーレス・マネージドサービスを VPC なしで構成。VPC コストを排除）|
| HTTPS 強制 | API Gateway + CloudFront で TLS 1.2 以上を必須化 |
| S3 公開禁止 | `BlockPublicAccess.BLOCK_ALL` + `enforceSSL: true` |
| OAC 使用 | CloudFront → S3 のアクセスは Origin Access Control（OAC）で制限 |

---

## 2. コスト最適化要件（NFR-I2）

### NFR-I2a: リソースサイジング

| Lambda | Memory | Timeout | 根拠 |
|--------|--------|---------|------|
| Hono API | 256 MB | 29秒 | API Gateway 統合の最大タイムアウトが 30秒のため 1秒マージン |
| TaskExtractor | 512 MB | 60秒 | Bedrock 呼び出し + DynamoDB 操作 |
| SaboriProposer | 512 MB | 60秒 | Bedrock ストリーミング + 外部 API 呼び出し |
| Webhook Handler | 256 MB | 10秒 | Slack 3秒 ACK 制約のため即時 ACK + 非同期処理 |

### NFR-I2b: DynamoDB コスト

| 項目 | 要件 |
|------|------|
| 課金モデル | PAY_PER_REQUEST（On-Demand）全テーブルで統一 |
| TTL | TaskCandidates テーブルのみ 30日 TTL を有効化 |
| GSI 数 | 最小限（TaskCandidates: 1 / Tasks: 1 / Proposals: 1 / HonneData: 1）|

### NFR-I2c: CloudWatch コスト

| 項目 | 要件 |
|------|------|
| ログ保持期間 | 全 Lambda: 14日（`logs.RetentionDays.TWO_WEEKS`）|
| コスト目標 | CloudWatch ログコスト: 月額 $2.50 以内（aws-architecture.md §6 と整合）|

---

## 3. テスト要件（NFR-I3）

### NFR-I3a: CDK テスト

| 項目 | 要件 |
|------|------|
| テストフレームワーク | Jest（既存 `pkgs/cdk/jest.config.js` で設定済み）|
| テスト種別 | Fine-grained assertion tests + Snapshot tests |
| カバレッジ目標 | 全スタック（6ファイル）のファイングレインドテストを作成 |
| `Template.fromStack()` 使用 | CDK Assertions ライブラリを使用してリソース存在・設定を検証 |

**必須テスト項目**:
- DynamoDB テーブルが PAY_PER_REQUEST で作成されること
- DynamoDB テーブルに正しい GSI が設定されること
- Lambda が ARM64 + 正しい Runtime で作成されること
- S3 バケットが BlockPublicAccess.BLOCK_ALL で作成されること
- CloudFront が HTTPS リダイレクトで作成されること
- Cognito User Pool が自己サインアップ無効で作成されること

### NFR-I3b: CDK Synth テスト

| 項目 | 要件 |
|------|------|
| `cdk synth` | エラー・警告なしで完了すること |
| `cdk diff` | 実行可能で差分が正しく表示されること |
| TypeScript コンパイル | `tsc --noEmit` がエラーなしで完了すること |

---

## 4. IaC 再現性要件（NFR-I4）

### NFR-I4a: デプロイ再現性

| 項目 | 要件 |
|------|------|
| 冪等性 | 同じ CDK コードから同じ CloudFormation テンプレートが生成される |
| context.json | `cdk.context.json` をリポジトリにコミットする（非決定的 synth を防ぐ）|
| 環境分離 | 環境（dev/staging/prod）は CDK コンテキスト（`-c environment=dev`）または環境変数で切り替える |
| ハードコード禁止 | アカウント ID・リージョンを CDK コードにハードコードしない（`env: { account: process.env.CDK_DEFAULT_ACCOUNT }` を使用）|

### NFR-I4b: デプロイ手順の文書化

| 項目 | 要件 |
|------|------|
| 初回デプロイ手順 | CDK Bootstrap → 各スタックのデプロイ順序を明記 |
| 環境変数設定 | デプロイ前に設定が必要な Secrets Manager 値の初期化手順 |

---

## 5. 可観測性要件（NFR-I5）

### NFR-I5a: CloudWatch アラーム

以下のアラームを CDK で定義する（`aws-architecture.md §7` との整合）:

| メトリクス | 閾値 | アラーム名 |
|-----------|------|----------|
| TaskExtractor Duration | > 60秒（P99）| `SaborouAlarm-TaskExtractorTimeout` |
| SaboriProposer Duration | > 60秒（P99）| `SaborouAlarm-SaboriProposerTimeout` |
| API Lambda Duration | > 29秒（P99）| `SaborouAlarm-ApiTimeout` |
| Lambda Concurrent Executions（全体）| > 100 | `SaborouAlarm-ConcurrentExecutions` |
| API Gateway 5xx Error Rate | > 1% | `SaborouAlarm-ApiErrors` |

**アラーム通知先**: SNS トピック（Email 通知）を CDK で作成（アドレスは環境変数から取得）

### NFR-I5b: CloudWatch Dashboard

CDK で以下のウィジェットを含む CloudWatch Dashboard を自動生成する:
- Lambda Errors（全 Lambda、1グラフ）
- Lambda Duration（P50 / P90 / P99）
- API Gateway 4xx / 5xx
- DynamoDB ConsumedReadCapacityUnits / ConsumedWriteCapacityUnits（全テーブル）

---

## 6. cdk-nag 準拠要件（NFR-I6）

### NFR-I6: AWS Solutions Checks

| 項目 | 要件 |
|------|------|
| 適用 | `bin/cdk.ts` で `Aspects.of(app).add(new AwsSolutionsChecks())` を有効化 |
| 抑制ルール | 許容できる違反は `NagSuppressions.addStackSuppressions()` で明示的に抑制・理由を記録 |
| ターゲット | ビルド時（`cdk synth`）に cdk-nag が通過すること（CI で検証）|

---

## NFR 要件サマリ

| NFR ID | カテゴリ | 優先度 | 概要 |
|--------|---------|--------|------|
| NFR-I1a | セキュリティ | 必須 | IAM 最小権限（`grant*()` メソッド使用）|
| NFR-I1b | セキュリティ | 必須 | Secrets Manager へのシークレット分離 |
| NFR-I1c | セキュリティ | 必須 | S3 公開禁止 / CloudFront OAC |
| NFR-I2a | コスト | 必須 | Lambda メモリ・タイムアウト適正設定 |
| NFR-I2b | コスト | 必須 | DynamoDB PAY_PER_REQUEST |
| NFR-I2c | コスト | 推奨 | CloudWatch ログ 14日保持 |
| NFR-I3a | テスト | 必須 | Jest ファイングレインドテスト（全スタック）|
| NFR-I3b | テスト | 必須 | CDK Synth エラーなし |
| NFR-I4a | IaC 再現性 | 必須 | cdk.context.json コミット・環境分離 |
| NFR-I4b | IaC 再現性 | 推奨 | デプロイ手順の文書化 |
| NFR-I5a | 可観測性 | 推奨 | CloudWatch アラーム（5項目）|
| NFR-I5b | 可観測性 | オプション | CloudWatch Dashboard 自動生成 |
| NFR-I6 | コンプライアンス | 推奨 | cdk-nag AwsSolutionsChecks 通過 |

---

*本ドキュメントは U-02: infra の NFR Requirements 成果物（v1.0.0）です。*
