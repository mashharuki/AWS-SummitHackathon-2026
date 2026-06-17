# U-V3-04 Infrastructure Design Plan: elevenlabs-registration-fallback

**作成日**: 2026-06-17 JST
**Unit**: U-V3-04 elevenlabs-registration-fallback
**フェーズ**: Infrastructure Design（条件付き実行）

---

## 実行判断: EXECUTE

**実行条件**: `RemoteMcpSetupDescriptor` 論理コンポーネントが CDK/API 出力としての SABOROU MCP エンドポイント URL を必要とする。ElevenLabs Dashboard `streamable_http` 登録のセットアップアーティファクトが、安定した CDK 出力を参照できるよう `McpToolsBaseUrl` CfnOutput を追加する。

**新規 AWS リソース**: なし（既存リソースの活用のみ）  
**新規 IAM 変更**: なし（U-V3-01 設計を維持）  
**SSE ブリッジ**: 延期（U-V3-05 互換性検証が必要な場合のみ再オープン）

---

## 実行チェックリスト

- [x] Step 1: 前提条件確認（Functional Design / NFR Requirements / NFR Design の完了確認）
- [x] Step 2: 論理コンポーネントをインフラリソースにマッピング
- [x] Step 3: CDK 出力（McpToolsBaseUrl）の設計
- [x] Step 4: SSE ブリッジ延期の設計判断記録
- [x] Step 5: Security Baseline 準拠確認
- [x] Step 6: `infrastructure-design.md` 生成
- [x] Step 7: `deployment-architecture.md` 生成

---

## 論理コンポーネント → インフラリソース マッピング

| 論理コンポーネント | マッピング先 | 変更種別 |
|---|---|---|
| `RemoteMcpSetupDescriptor` | 既存 `HttpApiUrl` CfnOutput + 新規 `McpToolsBaseUrl` CfnOutput | CDK 出力追加のみ |
| `TransportDecisionGate` | ドキュメント / セットアップアーティファクト | インフラ変更なし |
| `ExtensionVoiceFallbackCoordinator` | 既存 Chrome 拡張（`pkgs/extension`） | インフラ変更なし |
| `FallbackApiClient` | 既存 Hono Lambda / API Gateway | インフラ変更なし |
| `SafeConfigPresenter` | 拡張 UI コード | インフラ変更なし |
| `DiagnosticCodeMapper` | 拡張コード | インフラ変更なし |
| `RegistryBackedSetupArtifact` | 既存スキーマアーティファクト + セットアップドキュメント | インフラ変更なし |
| `DocumentationAndTestLock` | テストコード（`pkgs/extension/src/__tests__/`） | インフラ変更なし |

---

## CDK 変更セット

| ファイル | 変更内容 |
|---|---|
| `pkgs/cdk/lib/stacks/api-stack.ts` | `McpToolsBaseUrl` CfnOutput を追加（`HttpApiUrl + "/api/mcp/tools"` で導出） |
| `pkgs/cdk/test/api-stack.test.ts` | `McpToolsBaseUrl` 出力の存在と形式をアサート |

---

## リスク管理

| リスク | 対策 |
|---|---|
| `sse` ブリッジが後で必要になる | U-V3-05 が互換性証拠を記録した場合のみ、Infrastructure Design を再オープンして `sse` エンドポイントを追加 |
| CDK 論理 ID 変更による CloudFormation リソース置換 | 既存コンストラクト ID は変更しない。新規 CfnOutput のみ追加 |
| ElevenLabs Dashboard 登録 URL の誤記 | CDK 出力を使用して URL を機械的に導出し、手動入力ミスを防止 |
