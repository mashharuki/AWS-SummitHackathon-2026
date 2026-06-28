# U-V3-05 NFR Requirements 計画書

**Unit**: U-V3-05: real-integration-verification
**作成日**: 2026-06-17
**ステータス**: 実行中

---

## 実行判断

**判断**: EXECUTE

**理由**:
- デモ当日の稼働信頼性（AWS/AgentCore/ElevenLabs/Slack の全パス）が最重要リスク
- 検証証拠の収集方法・観測要件を明確に定義する必要がある
- U-V3-01〜04 が実装した Security Baseline の実環境での維持確認が必要
- Code Generation で生成するスクリプト/ドキュメントの品質基準を確定する必要がある

---

## NFR 定義ステップ

- [x] Step 1: 既存 v3 NFR 要件（U-V3-01〜04）の継承要件を確認
- [x] Step 2: 信頼性 NFR（ビルド/テスト/デプロイ）を定義
- [x] Step 3: 観測性 NFR（CloudWatch/AgentCore/ElevenLabs ログ確認）を定義
- [x] Step 4: 手動 E2E 検証証拠 NFR を定義
- [x] Step 5: デモ可用性 NFR を定義
- [x] Step 6: Security Baseline 適用ルール確認
- [x] Step 7: Tech Stack Decisions を記録
- [x] Step 8: nfr-requirements.md を生成

---

## 対象 NFR カテゴリ

| カテゴリ | ID | 説明 |
|---------|-----|------|
| 信頼性 | NFR-V305-R1〜R4 | ビルド・テスト・CDK synth・デプロイ |
| 観測性 | NFR-V305-O1〜O3 | CloudWatch・AgentCore・ElevenLabs 動作ログ |
| 手動 E2E 証拠 | NFR-V305-E1〜E4 | AgentCore/ElevenLabs/Slack/`@Claude` 検証証拠 |
| デモ可用性 | NFR-V305-A1〜A2 | 並列アクセス・フォールバック稼働 |
| 保守性 | NFR-V305-M1〜M2 | トラブルシューティング手順・ドキュメント品質 |

---

## Security Baseline 適用評価

| ルール | 適用可否 | 判断理由 |
|--------|---------|---------|
| IAM 最小権限 | N/A | 新規 IAM リソース作成なし |
| シークレット外部化 | Applicable | 検証スクリプトがシークレットを扱う場合の要件 |
| 監査ログ | Applicable | 検証証拠として audit event を確認する要件 |
| fail-closed | N/A | 新規フロー制御なし |
| テストカバレッジ | Applicable | 検証スクリプト・手順のテスト可能性 |
