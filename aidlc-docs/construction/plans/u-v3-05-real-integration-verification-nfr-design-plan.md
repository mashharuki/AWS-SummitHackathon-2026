# U-V3-05 NFR Design 計画書

**Unit**: U-V3-05: real-integration-verification
**作成日**: 2026-06-17
**前提**: NFR Requirements 完了・承認済み（ユーザー B 承認）

---

## 実行ステップ

- [x] Step 1: NFR Requirements を分析（R1〜R4 / O1〜O3 / E1〜E4 / A1〜A2 / M1〜M2）
- [x] Step 2: NFR Design パターンを決定（5 パターン）
- [x] Step 3: コンテキスト適合質問を生成・回答（コンテキストから回答済み）
- [x] Step 4: nfr-design-patterns.md を作成
- [x] Step 5: logical-components.md を作成
- [x] Step 6: audit.md に記録
- [x] Step 7: aidlc-state.md を更新

---

## パターン設計の判断根拠

### U-V3-05 の特性
- 新規ランタイムコンポーネントなし（実装ではなく検証・文書化 Unit）
- 成果物は: 検証スクリプト・証拠ファイル・トラブルシューティングマトリクス・デモ手順書
- Security Baseline: シークレット安全性・ログ品質が適用可能なルール

### 質問と回答（コンテキスト推論）

Q1: 検証証拠ファイルはどこに保存するか？
[Answer]: `aidlc-docs/construction/u-v3-05-real-integration-verification/evidence/` 配下に保存。
git commit は任意（スクリーンショットは `.gitignore` で除外推奨）。

Q2: 検証スクリプトの形式は？
[Answer]: bash スクリプト（`scripts/verify-*.sh`）+ npm/pnpm スクリプトとして `package.json` に登録可能な形。
シークレットは環境変数経由のみ。

Q3: トラブルシューティングマトリクスのフォーマットは？
[Answer]: Markdown テーブル。外部サービス別（AgentCore / Cognito / Slack / ElevenLabs / Google / Hono fallback）に各 3 シナリオ以上。

Q4: デモリセットの対象は？
[Answer]: DynamoDB テストデータ（Tasks / Proposals テーブルのテスト userId 分）。
Cognito ユーザー状態は対象外（既存ユーザーを流用）。

Q5: フォールバック手順書の更新頻度は？
[Answer]: 決勝前リハーサル後に 1 回更新。以降は静的ドキュメントとして保持。

---

## 選定パターン一覧

| パターン名 | 対応 NFR | 目的 |
|-----------|---------|------|
| Verification Evidence Pattern | R1-R4, O1-O3, E1-E4 | 証拠の収集・整理・保存 |
| Env-Safe Script Pattern | M2 | シークレット安全スクリプト構造 |
| Troubleshooting Matrix Pattern | M1 | エラーシナリオの体系的文書化 |
| Fallback Runbook Pattern | R4, A2 | 実行可能なフォールバック手順 |
| Demo Reset Script Pattern | A2 | クリーンデモ状態の再現 |
