# Code Generation Summary — U-02: infra

**Unit**: U-02: infra  
**ステージ**: CONSTRUCTION / Code Generation  
**完了日**: 2026-05-17  
**実行者**: AI-DLC Specialist Agent

---

## 生成ファイル一覧

### 設定ファイル（更新）

| ファイル | 変更内容 |
|---------|---------|
| `pkgs/cdk/tsconfig.json` | `module: NodeNext` → `CommonJS`、`moduleResolution: NodeNext` → `node`（ts-node互換性） |
| `pkgs/cdk/package.json` | `cdk-nag: ^2.35.0` を dependencies に追加 |

### エントリーポイント（書き換え）

| ファイル | 内容 |
|---------|------|
| `pkgs/cdk/bin/cdk.ts` | 6スタック登録 + グローバルタグ（Project/ManagedBy/Environment）+ cdk-nag AwsSolutionsChecks Aspects |

### スタックファイル（新規作成）

| ファイル | リソース | 備考 |
|---------|---------|------|
| `pkgs/cdk/lib/stacks/cognito-stack.ts` | UserPool / Google IdP / UserPoolClient / CognitoDomain | RETAIN、MFA OFF（デモ） |
| `pkgs/cdk/lib/stacks/data-stack.ts` | DynamoDB 7テーブル + 4GSI / Secrets Manager 3件 | PAY_PER_REQUEST / AWS_MANAGED暗号化 / RETAIN |
| `pkgs/cdk/lib/stacks/api-stack.ts` | Lambda(Hono) / HTTP API / JWT Authorizer | ARM64 / 256MB / 29s / X-Ray |
| `pkgs/cdk/lib/stacks/agent-stack.ts` | TaskExtractor Lambda / SaboriProposer Lambda / DLQ×2 | ARM64 / 512MB / 60s / Bedrock IAM |
| `pkgs/cdk/lib/stacks/webhook-stack.ts` | EventBus / EventBridge Rule / Scheduler / Webhook Lambda | MonitoringConstruct統合 |
| `pkgs/cdk/lib/stacks/frontend-stack.ts` | S3(OAC) / CloudFront Distribution | PRICE_CLASS_200 / SPA routing |

### コンストラクト（新規作成）

| ファイル | 内容 |
|---------|------|
| `pkgs/cdk/lib/constructs/monitoring-construct.ts` | CloudWatch Alarms×5 / Dashboard（WebhookStackに統合） |

### テストファイル（新規作成）

| ファイル | テスト数 | 主な検証項目 |
|---------|---------|------------|
| `pkgs/cdk/test/cognito-stack.test.ts` | 5 | UserPool設定・RETAIN・Domain・ClientFlows |
| `pkgs/cdk/test/data-stack.test.ts` | 8 | 7テーブル・PAY_PER_REQUEST・暗号化・TTL・GSI・RETAIN |
| `pkgs/cdk/test/api-stack.test.ts` | 6 | ARM64・メモリ・タイムアウト・X-Ray・HTTP API・JWT Authorizer |
| `pkgs/cdk/test/agent-stack.test.ts` | 5 | 2Lambda・ARM64・DLQ・Bedrock IAM |
| `pkgs/cdk/test/webhook-stack.test.ts` | 4 | EventBus・EventBridgeRule・Scheduler・Webhook Lambda |
| `pkgs/cdk/test/frontend-stack.test.ts` | 5 | S3パブリックアクセスブロック・SSL強制・CloudFront OAC・SPA routing・PRICE_CLASS_200 |

### 削除ファイル

| ファイル | 理由 |
|---------|------|
| `pkgs/cdk/lib/cdk-stack.ts` | 旧スケルトン（不要） |
| `pkgs/cdk/test/cdk.test.ts` | 旧スケルトンテスト（不要） |

---

## 実行結果

### pnpm install

```
cdk-nag@2.35.x インストール成功
Packages: +6 -10 (差し引き実質 +6)
```

### pnpm --filter cdk test

```
Test Suites: 6 passed, 6 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Time:        ~45s
```

### pnpm --filter cdk synth（cdk-nag 結果）

- **Errors**: 0
- **Warnings**: 4（CDK内部のconstruct metadata警告、セキュリティ非関連）
- **合成成功**: `cdk.out/` に6スタックのCloudFormationテンプレート生成済み

#### cdk-nag 抑制一覧（理由付き）

| Rule ID | 対象スタック | 抑制理由 |
|---------|-----------|---------|
| AwsSolutions-COG1 | Cognito | パスワードポリシー緩和（デモ環境・UX重視） |
| AwsSolutions-COG2 | Cognito | MFA無効（デモ環境） |
| AwsSolutions-COG3 | Cognito | AdvancedSecurityMode無効（コスト削減） |
| AwsSolutions-COG8 | Cognito | Plus tier不要（ハッカソンスコープ） |
| AwsSolutions-DDB3 | Data | PITR無効（コスト削減・データ破棄可能） |
| AwsSolutions-SMG4 | Data | シークレットローテーション無効（外部API手動管理） |
| AwsSolutions-L1 | Api/Agent/Webhook | nodejs22.xは最新安定版（cdk-nagの参照リスト未更新） |
| AwsSolutions-IAM4/5 | Api/Agent/Webhook | Lambda実行ロール最小権限・X-Ray/Logs要件 |
| AwsSolutions-APIG1 | Api | HTTPAPIログ無効（コスト削減、Lambda Logsで代替） |
| AwsSolutions-APIG4 | Api | /healthルートは認証不要（死活監視用） |
| AwsSolutions-SQS3 | Agent/Webhook | DLQ自体にDLQ不要（最終宛先） |
| AwsSolutions-SQS4 | Agent/Webhook | SSL強制省略（内部専用DLQ・ハッカソンスコープ） |
| AwsSolutions-S1 | Frontend | S3アクセスログ無効（コスト削減） |
| AwsSolutions-CFR1/2/3 | Frontend | CloudFrontログ・WAF無効（ハッカソンスコープ） |
| AwsSolutions-CFR4 | Frontend | TLS1.2デフォルト適用済み・カスタム証明書不要 |

---

## Well-Architected 6柱準拠確認

| 柱 | 実装済み項目 |
|----|------------|
| 運用上の優秀性 | CloudWatch LogGroup（全Lambda・14日保持）/ CloudWatch Alarms（5項目）/ Dashboard / X-Ray |
| セキュリティ | IAM最小権限 `grant*()` / OAC（S3非公開）/ Secrets Manager / Cognito JWT / cdk-nag通過 |
| 信頼性 | DynamoDB RETAIN / Cognito RETAIN / DLQ（TaskExtractor・SaboriProposer）/ EventBridgeリトライ3回 |
| パフォーマンス効率 | ARM64 Graviton2（全Lambda）/ Lambda適正メモリ / CloudFront Compress有効 |
| コスト最適化 | PAY_PER_REQUEST / サーバーレス全体 / PRICE_CLASS_200（日本向け）/ ログ14日保持 |
| 持続可能性 | サーバーレス全体（ゼロ常時稼働）/ ARM64消費電力削減 |

---

## 制約事項・注意事項

1. `pkgs/backend/dist/` にプレースホルダーを配置（テスト用）。本番デプロイ前にバックエンドビルドが必要。
2. Secrets Manager の実際のシークレット値は手動設定が必要（infrastructure-design.md §4.1参照）。
3. `cdk deploy` は明示的に実行しないこと（ハッカソン指示に従い synth まで）。
4. SSM Parameter Store の `/saborou/google/client-id` と `/saborou/slack/client-id` は初回デプロイ前に手動設定が必要。
