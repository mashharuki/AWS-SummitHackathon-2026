# AWS アーキテクチャ方針

**ドキュメント種別**：AI-DLC 入力資料
**最終更新**：2026-05-09
**目的**：AWS サービス選定の決定事項と判断基準を明文化し、AI-DLC の Infrastructure Design / NFR Design / Code Generation で参照する。

---

## 1. 基本方針

### 1.1 サーバーレス・マネージド優先

- **常時稼働インスタンス（EC2 / RDS の常時稼働）は原則使わない**
- コンピュートは Lambda を第一選択。長時間処理が必要な場合のみ ECS/Fargate
- データベースは DynamoDB を第一選択。RDB が必須な場合のみ Aurora Serverless v2
- AWS マネージドサービスでまかなえるものは自前運用しない

### 1.2 コスト意識

- **Free Tier 内で収まる設計**を優先
- ハッカソン規模では月額数十ドル以内を目標
- 不要なリソースは即座に削除（CDK で `RemovalPolicy.DESTROY`）
- ログ保持期間は短めに設定（CloudWatch Logs：7〜14日）

### 1.3 リージョン

- **`ap-northeast-1`（東京）のみ使用**
- マルチリージョン構成は不要（ハッカソン規模・レイテンシ要件・コスト）
- ただし Bedrock 一部モデルは `us-east-1` 等のクロスリージョン推論が必要な場合あり

---

## 2. サービス選定

### 2.1 確定済み

| カテゴリ | 採用サービス | 採用理由 |
|---|---|---|
| **API ゲートウェイ** | API Gateway（HTTP API 推奨） | REST API より低コスト・低レイテンシ |
| **コンピュート（同期）** | AWS Lambda | サーバーレス・スケーラブル・コスト効率 |
| **コンピュート（非同期）** | AWS Lambda + EventBridge / SQS | イベント駆動 |
| **オブジェクトストレージ** | Amazon S3 | 静的アセット・本音データのアーカイブ |
| **CDN / 静的ホスティング** | Amazon CloudFront + S3 | フロント配信 |
| **認証** | Amazon Cognito | OAuth/OIDC 統合・ソーシャルログイン対応 |
| **シークレット管理** | AWS Secrets Manager（重要シークレット） / SSM Parameter Store（設定値） | コスト最適化のため使い分け |
| **モニタリング・ログ** | Amazon CloudWatch | Logs / Metrics / Alarms |
| **AI / LLM** | Amazon Bedrock | マネージド LLM・Claude Sonnet 利用 |
| **IaC** | AWS CDK（TypeScript） | バックエンドと同じ言語で記述可 |

### 2.2 第一選択（判断余地は Application Design で再確認）

| カテゴリ | 第一選択 | 補足 |
|---|---|---|
| **データベース** | **DynamoDB** | 動的 JOIN・複雑なクエリは想定しない。アクセスパターン限定的（ユーザー別最新N件・時系列）でカバー可。Aurora は明確に必要性が出た場合のみ再検討 |
| **コンピュート（同期・非同期共通）** | **Lambda** | 全処理が15分以内に収まる想定。タスク収集・Bedrock呼び出し・cron駆動更新すべて Lambda で対応。ECS/Fargate は明確な必要性が出た場合のみ再検討 |

### 2.3 要件次第で決定（AI-DLC で確定）

| カテゴリ | 候補 | 判断基準 |
|---|---|---|
| **エージェント基盤** | Strands Agent SDK / Bedrock AgentCore / 自前実装 | AWS 推奨機能セットと開発工数のバランスで決定 |
| **キャッシュ** | DynamoDB DAX / ElastiCache（Serverless）/ Lambda メモリ内 | レイテンシ要件次第。MVP では未導入想定 |
| **検索** | OpenSearch Serverless / 不要 | 文脈検索が必要になったら検討 |
| **キュー / イベント** | SQS / EventBridge / SNS | イベントの種類と配信保証要件で決定 |
| **WebSocket** | （MVP では原則不採用） | UI モックではチャット形式だが、実態は同期 API + ボタン応答で実装可能。詳細ペインを開いた時のオンデマンド再評価で十分と想定。WebSocket 採用は要件精査後に判断 |

### 2.4 採用しない（明示的にスコープ外）

- **EC2 常時稼働**：サーバーレス方針に反する
- **RDS（非 Serverless）**：常時稼働でコスト負担大
- **ECS / Fargate（MVP では原則不採用）**：全処理が15分以内に収まる想定のため Lambda で十分。明確な長時間処理が判明したら Application Design で再検討
- **Aurora（MVP では原則不採用）**：DynamoDB で要件カバー可能な想定。動的 JOIN・複雑な集計が必要と判明したら Application Design で再検討
- **EKS / Kubernetes**：オーバーキル
- **マルチリージョン構成**：規模に対して過剰
- **オンプレミス連携（Direct Connect / VPN）**：不要

---

## 3. 認証・認可

### 3.1 認証

- **Amazon Cognito User Pools** を中心
- ソーシャルログイン候補：Google / Slack（連携サービスと揃える）
- パスワードログインは MVP では限定的（社内検証用途のみ）

### 3.2 認可

- API Gateway の Cognito Authorizer で JWT 検証
- Lambda 内で Claim ベースの認可
- IAM ロールはリソース・アクションを最小限に絞る

### 3.3 外部サービス連携の OAuth

- **Slack / Gmail / Notion / Google Calendar の OAuth トークン**は Secrets Manager に保管
- リフレッシュトークン管理は Lambda + EventBridge スケジュールで自動更新

---

## 4. データ保護・プライバシー

### 4.1 暗号化

- **保存時**：S3 / DynamoDB / Aurora すべて AWS 管理 KMS で暗号化（デフォルト）
- **転送時**：HTTPS 必須（API Gateway / CloudFront）
- 機密性が高いデータ（外部ツールから取得した会話本文等）はカスタマー管理 KMS キーで個別暗号化を検討

### 4.2 データ保持

- ユーザーが取得した外部ツール上の会話は**最小限のサマリのみ DynamoDB に保存**
- 生データの長期保存は避ける（プライバシー・コスト両面）
- 保持期間とポリシーは Requirements Analysis で確定

### 4.3 PII（個人識別情報）扱い

- メールアドレス・氏名などの PII は Cognito で管理
- 外部ツール由来のデータに含まれる PII（依頼者名等）は最小化・匿名化を検討

---

## 5. AWS CDK（IaC）方針

### 5.1 構成原則

- **TypeScript で記述**（バックエンドと統一）
- スタックは責務ごとに分割（CognitoStack / DataStack / ApiStack / FrontendStack 等）
- 環境分離：`dev` / `staging` / `prod` を CDK Context で切り替え
- L1（CFN）コンストラクト直接利用は避ける。L2 / L3 を優先

### 5.2 CDK スキル活用

- 設計時：`aws-cdk-architect` SKILL を使う
- 構成図生成：`cdk-aws-diagram` SKILL で draw.io 形式の図を出力

### 5.3 デプロイ方針

- ローカル：`cdk synth` / `cdk diff` で確認
- CI：`cdk synth` をジョブに組み込み構文チェック
- CD：GitHub Actions から `cdk deploy`（OIDC で認証、長期キーは使わない）

---

## 6. モニタリング・ログ

| 項目 | サービス | 設定 |
|---|---|---|
| **アプリケーションログ** | CloudWatch Logs | 保持期間 14日（コスト最適化） |
| **メトリクス** | CloudWatch Metrics | Lambda の Errors / Throttles / Duration |
| **アラーム** | CloudWatch Alarms | エラー率閾値超過時に通知（SNS → メール） |
| **トレース** | AWS X-Ray（候補） | API Gateway → Lambda → Bedrock 呼び出しを可視化 |
| **ダッシュボード** | CloudWatch Dashboards | 主要メトリクスを集約 |

---

## 7. コスト管理

### 7.1 コスト見積もり（暫定・MVP 規模）

| サービス | 想定コスト（月） |
|---|---|
| Lambda | $0〜5（Free Tier 100万リクエスト/月内） |
| DynamoDB | $0〜5（On-Demand、軽負荷想定） |
| S3 | $0〜2 |
| CloudFront | $0〜5（1TB 転送/月内） |
| Cognito | $0（5万 MAU 内無料） |
| API Gateway | $0〜3（Free Tier 100万コール/月内） |
| Bedrock | **$10〜50**（最大の変動要素・Claude Sonnet トークン量による） |
| CloudWatch | $0〜3 |
| **合計（暫定）** | **$10〜70/月** |

### 7.2 コスト管理アクション

- AWS Budgets で月額アラート設定（$50 で警告、$100 で停止検討）
- Bedrock のレート制限・トークン上限をアプリ側でガード
- 不要リソースの定期棚卸し

---

## 8. AWS 公式制約との整合

- 既存の `.claude/rules/aws-constraints.md` を**より詳細化したのが本ドキュメント**
- `.claude/rules/aws-constraints.md` は Claude Code 実行時の常時参照ガードレール
- 本ドキュメントは AI-DLC ワークフローでの**設計判断の根拠**として使用
- 矛盾が出た場合は本ドキュメント側を更新し、ガードレール側は最小限に保つ

---

## 9. 未確定事項（AI-DLC で決定する）

- Bedrock の具体モデル ID とパラメータ（NFR Requirements で確定）
- VPC を作るか作らないか（Lambda が外部 API を叩く頻度・帯域次第）
- マルチアカウント運用（dev/prod 分離）するか（時間制約次第）
- エージェント基盤（Strands Agent SDK / Bedrock AgentCore / 自前実装）の選択（Application Design で確定）

**※** DynamoDB / Lambda は第一選択として確定済み。明確な必要性が出た場合のみ Aurora / ECS を Application Design で再検討

**※** WebSocket は MVP では原則不採用方針。UI モック（[`mockups/`](../aidlc-inputs/mockups/)）で「チャット形式 = WebSocket 必須」ではないことを確認済み（同期 API + ボタン応答 + 詳細ペイン展開時のオンデマンド再評価で実装可能）

---

## 10. 変更履歴

| 日付 | 変更内容 | 担当 |
|---|---|---|
| 2026-05-09 | 初版作成 | Claude Code |
