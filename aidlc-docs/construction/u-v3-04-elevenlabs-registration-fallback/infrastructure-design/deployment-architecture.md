# Deployment Architecture - U-V3-04 elevenlabs-registration-fallback

**作成日**: 2026-06-17 JST
**Unit**: U-V3-04 elevenlabs-registration-fallback

---

## デプロイメント概要

U-V3-04 はインフラ変更を最小限に抑え、既存 U-V3-01/02 で整備されたインフラを最大活用するアーキテクチャをとる。

```
[ElevenLabs Agent]
       |
       | streamable_http (primary)
       | POST {McpToolsBaseUrl}/{toolName}
       |
       v
[API Gateway HTTP API]        ← 既存（U-V3-01で整備）
       |
       | JWT Authorization Header forwarded
       |
       v
[Hono Lambda]                 ← 既存（U-V3-01/02で整備）
  |-- McpTransportAuthAdapter ← U-V3-01実装
  |-- McpToolRegistry         ← U-V3-02実装
  |-- McpIdentityResolver     ← U-V3-01実装
  |-- McpSafeAuditLogger      ← U-V3-01実装
       |
       v
[DynamoDB / Secrets Manager]  ← 既存（変更なし）


[Chrome Extension]
  |-- ExtensionVoiceFallbackCoordinator  ← U-V3-04実装（拡張コードのみ）
  |-- FallbackApiClient                  ← U-V3-04実装（拡張コードのみ）
  |-- SafeConfigPresenter                ← U-V3-04実装（拡張コードのみ）
  |-- DiagnosticCodeMapper               ← U-V3-04実装（拡張コードのみ）
       |
       | (fallback: authenticated direct API)
       v
[Hono Lambda via API Gateway]  ← 既存（変更なし）


[CDK Output: McpToolsBaseUrl]  ← U-V3-04で追加
  = {HttpApiUrl}/api/mcp/tools
  → ElevenLabs Dashboard 登録ガイドが参照
```

---

## CDK スタック別変更内容

### SaborouApiStack（`pkgs/cdk/lib/stacks/api-stack.ts`）

**変更**: `McpToolsBaseUrl` CfnOutput 追加のみ

```typescript
new cdk.CfnOutput(this, "McpToolsBaseUrl", {
  value: `${apiUrl}/api/mcp/tools`,
  description:
    "SABOROU MCP tools base URL — ElevenLabs Dashboard streamable_http 登録先",
  exportName: `SaborouMcpToolsBaseUrl-${environment}`,
});
```

**変更なし**: Lambda・API Gateway ルート・JWT Authorizer・IAM ロール・アクセスログ設定・MetricFilters

### SaborouAgentCoreStack（`pkgs/cdk/lib/stacks/agentcore-stack.ts`）

**変更なし**: Gateway・GatewayTarget・SchemaBucket・DeploySchema・GatewayRole のコンストラクト ID、設定、IAM スコープはすべて維持。

---

## ElevenLabs Dashboard 登録フロー

```
1. CDK deploy 実行
   → SaborouApiStack の McpToolsBaseUrl 出力が確定

2. cdk output で URL を確認
   $ npx cdk output SaborouApiStack
   SaborouApiStack.McpToolsBaseUrl = https://{api-id}.execute-api.ap-northeast-1.amazonaws.com/api/mcp/tools

3. ElevenLabs Dashboard でエージェントを開く

4. MCP Servers セクションで「Add remote MCP server」を選択

5. 設定入力:
   Transport type: streamable_http
   Server URL: {McpToolsBaseUrl}（CDK 出力値をそのまま使用）
   Authentication: Custom JWT（SABOROU Cognito トークンを Authorization ヘッダーに設定）

6. ElevenLabs Agent が saborou_get_tasks / saborou_judge_sabori 等を呼び出し

7. SABOROU MCP Adapter が JWT を検証し、ツールを実行

8. 結果を ElevenLabs Agent に返却
```

---

## フォールバックアーキテクチャ

### フォールバック優先順位

| 優先度 | パス | 説明 |
|---|---|---|
| 1（プライマリ） | ElevenLabs Dashboard remote MCP（streamable_http） | AgentCore 経由のフルリモート MCP |
| 2（未検証フォールバック） | ElevenLabs SDK clientTools（ブラウザコールバック） | 拡張内ローカルコールバック → 直接 Hono API |
| 3（デモ回復力） | 直接 Hono API フォールバック | 認証済み直接 API 呼び出し |

### フォールバック状態管理

| 状態 | 説明 | 表示 |
|---|---|---|
| `remote_mcp_primary` | streamable_http 検証済み・使用中 | 「リモート MCP 接続中」 |
| `remote_mcp_unverified` | streamable_http 設定済みだが未検証 | 「リモート MCP 設定済み（検証待ち）」 |
| `client_tools_fallback` | clientTools フォールバック使用中 | 「ローカルフォールバックモード」 |
| `hono_direct_fallback` | 直接 Hono API フォールバック | 「直接 API フォールバックモード」 |
| `unconfigured` | 設定なし | 「MCP 未設定」 |

---

## SSE ブリッジ延期の記録

**現在の判断**: SSE ブリッジは設計・実装しない

**延期理由**:
- U-V3-04 の NFR Design（Pattern 2: Conditional SSE Fallback Gate）に従い、`streamable_http` をデフォルト選択とする
- SSE は U-V3-05 の実互換性検証が `streamable_http` をブロックした場合のみ設計対象とする

**再オープン条件**:
- U-V3-05 が `streamable_http` 互換性をブロックする証拠を `evidence artifact` に記録した場合
- その際は U-V3-04 Infrastructure Design を再オープンし、以下を設計する:
  - `POST /api/mcp/sse` エンドポイント（新規 API Gateway ルート）
  - SSE ブリッジ Lambda（または既存 Lambda への SSE ハンドラ追加）
  - アクセスログ設定（SECURITY-02）
  - IAM ルールスコープ（SECURITY-06）
  - McpSseUrl CfnOutput 追加

---

## デプロイ手順

### CDK 変更のデプロイ

```bash
# 1. CDK ビルド・テスト
cd pkgs/cdk
pnpm build
pnpm test

# 2. diff 確認（McpToolsBaseUrl の追加のみ）
npx cdk diff SaborouApiStack

# 3. デプロイ
npx cdk deploy SaborouApiStack

# 4. 出力確認
npx cdk output SaborouApiStack
# → SaborouApiStack.McpToolsBaseUrl = https://{api-id}.execute-api.ap-northeast-1.amazonaws.com/api/mcp/tools
```

### 検証コマンド

```bash
# MCP エンドポイント疎通確認（ツール名を指定）
curl -X POST \
  "{McpToolsBaseUrl}/saborou_get_tasks" \
  -H "Authorization: Bearer {cognito-id-token}" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test"}'
```

---

## Well-Architected チェック（6 本柱）

| 柱 | U-V3-04 の判断 |
|---|---|
| 運用上の優秀性 | CDK 出力により URL 管理が自動化される。手動入力ミスを排除。 |
| セキュリティ | 既存認証・認可境界を変更しない。CDK 出力はシークレット非含有。 |
| 信頼性 | フォールバック優先順位が明示的。`sse` ブリッジは検証ゲートで管理。 |
| パフォーマンス効率 | 新規リソースなし。既存スタックの変更最小化。 |
| コスト最適化 | 新規リソースなし。追加コストゼロ。 |
| 持続可能性 | 最小変更アプローチにより環境負荷を最小化。 |
