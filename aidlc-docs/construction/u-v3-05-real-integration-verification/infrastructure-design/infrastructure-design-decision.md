# U-V3-05 Infrastructure Design — スキップ判定

**Unit**: U-V3-05: real-integration-verification
**作成日**: 2026-06-17
**判定**: Infrastructure Design **スキップ**

---

## スキップ根拠

U-V3-05 の成果物は「検証スクリプト（シェルスクリプト）・ドキュメント群」のみであり、
以下の条件に該当するため Infrastructure Design は不要と判断する。

| 判定項目 | 該当 | 理由 |
|---------|------|------|
| 新規 AWS リソースの作成 | なし | Lambda / DynamoDB / S3 等の追加なし |
| IAM ロール・ポリシーの変更 | なし | 既存 IAM を利用。新規スコープ追加なし |
| API Gateway / Hono ルートの追加 | なし | 既存エンドポイントを検証するのみ |
| CDK スタックの変更 | なし | CDK コード変更なし |
| Secrets Manager / SSM の変更 | なし | シークレットは既存設定を環境変数経由で参照 |
| ネットワーク・VPC 変更 | なし | 既存 VPC 設定を変更しない |
| EventBridge / SQS / SNS 設定 | なし | 新規メッセージングリソースなし |

---

## 成果物の配置先

U-V3-05 で生成するファイルは以下のとおり（Infrastructure 変更を伴わない）:

```
scripts/                         ← 検証シェルスクリプト（ワークスペースルート）
  verify-build-test.sh
  verify-cdk-synth.sh
  verify-agentcore.sh
  verify-mcp-auth.sh
  verify-cloudwatch.sh
  verify-secret-scan.sh
  demo-reset.sh

aidlc-docs/construction/u-v3-05-real-integration-verification/
  evidence/
    README.md
    R1-build-test/
    R2-cdk-synth/
    R3-agentcore-status/
    R4-fallback/
    O1-cloudwatch-logs/
    O2-error-log-scan/
    O3-elevenlabs-dashboard/
    E1-get-tasks-e2e/
    E2-slack-reply/
    E3-delegate-to-claude/
    E4-unauth-reject/
    A1-load-test/
    A2-demo-reset/
  TROUBLESHOOTING.md
  DEMO_RUNBOOK.md
```

---

## 再オープン条件

以下のいずれかが発生した場合、Infrastructure Design を再実行すること:

1. 検証スクリプトが新規 AWS リソース（CloudWatch Log Group など）を作成するよう要件変更された場合
2. CI 検証ゲート（LC-V305-05）として GitHub Actions の新規ワークフローを追加する場合
3. `pnpm run verify` の実行に Lambda / ECS / Step Functions が必要になる場合

---

## 次のステージ

Infrastructure Design スキップにより、直接 **Code Generation** に進む。
