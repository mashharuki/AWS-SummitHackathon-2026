# U-V3-04 Code Generation サマリー

**Unit**: elevenlabs-registration-fallback
**完了日**: 2026-06-17
**ステータス**: Code Generation Part 2 完了

---

## 変更ファイル一覧

### 変更ファイル（既存ファイルへの修正）

| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------|
| `pkgs/cdk/lib/stacks/api-stack.ts` | 変更 | `McpToolsBaseUrl` CfnOutput 追加（`${apiUrl}/api/mcp/tools`、exportName: `SaborouMcpToolsBaseUrl-${environment}`） |
| `pkgs/cdk/test/api-stack.test.ts` | 変更 | `McpToolsBaseUrl CfnOutput is present and contains /api/mcp/tools` アサーション追加 |
| `pkgs/extension/src/panel/lib/agentClient.ts` | 変更 | 疑似 AgentCore パス完全除去、Hono API 常時呼び出しに統一、`mcpFallback.ts` から再エクスポート追加 |
| `pkgs/extension/src/panel/lib/agentClient.test.ts` | 変更 | `isMcpAvailable` スパイを `VITE_MCP_TOOLS_BASE_URL` ベースに更新、Hono API 常時呼び出し確認テスト 3 本追加 |

### 新規ファイル

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `pkgs/extension/src/panel/lib/mcpFallback.ts` | 新規 | `FallbackMode` 型（5値）、`SafeDiagnosticCode` 型（6コード）、`SafeConfigView` インタフェース、`getMcpFallbackMode()`、`getMcpToolsBaseUrl()`、`getSafeConfigView()`、`getEndpointHost()` |
| `pkgs/extension/src/panel/lib/mcpFallback.test.ts` | 新規 | FallbackMode 判定テスト（4本）、SafeConfigView アローリスト強制テスト（5本）、境界テスト（3本）、診断コードタクソノミーテスト（3本） |
| `pkgs/extension/docs/ELEVENLABS_MCP_SETUP.md` | 新規 | ElevenLabs Dashboard 登録手順ガイド（§1〜§7、シークレット非記載） |

---

## テスト結果

### Extension テスト（pkgs/extension）

| 指標 | 値 |
|------|-----|
| テストファイル数 | 10 ファイル |
| テスト数（合計） | **187 テスト** |
| 旧テスト数 | 168 テスト |
| 新規テスト数 | +19 テスト |
| 結果 | 全パス |

#### 新規追加テスト内訳

| テストファイル | 追加テスト数 | 内容 |
|--------------|------------|------|
| `agentClient.test.ts` | +6 | Hono API 常時呼び出し確認（judgeTask/sendSlackReply/getTasks の MCP 非依存テスト × 2 ずつ + 後方互換テスト追加 1） |
| `mcpFallback.test.ts` | +15 | FallbackMode 4本・SafeConfigView 5本・境界テスト 3本・タクソノミー 3本 |

### CDK テスト（pkgs/cdk）

| 指標 | 値 |
|------|-----|
| テストファイル数 | 10 ファイル |
| テスト数（合計） | **90 テスト** |
| 旧テスト数 | 79 テスト |
| 新規テスト数 | +11 テスト（他スタック含む、api-stack: +1） |
| 結果 | 全パス |

---

## Security Baseline 準拠サマリー

| ルール | 適用可否 | 状態 |
|--------|---------|------|
| S1: シークレット非露出 | 適用 | 準拠 — `getSafeConfigView()` がアローリストのみ返却、JWT/トークン類を一切含まない |
| S2: 入力バリデーション | 適用 | 準拠 — `getEndpointHost()` が不正 URL を catch して null 返却 |
| S3: URL ハードコード禁止 | 適用 | 準拠 — `McpToolsBaseUrl` は `${apiUrl}/api/mcp/tools` として CDK で導出 |
| S4: IAM 最小権限 | N/A | 新規 IAM リソースなし |
| S5: SSE ブリッジ延期 | 適用 | 準拠 — SSE エンドポイントは U-V3-05 証拠前は追加しない方針を維持 |
| S6: 既存論理 ID 保全 | 適用 | 準拠 — 新規 CfnOutput ID `McpToolsBaseUrl` のみ追加、既存 ID 変更なし |

---

## 実装上の設計判断

### agentClient.ts — 疑似 AgentCore パス除去

**判断**: `try { if (isMcpAvailable()) { return await apiFetch(.../mcp/tools/...) } }` ブロックを全関数から除去

**理由**:
- VITE_AGENTCORE_GATEWAY_URL は実装されていないエンドポイントを指していた（疑似パス）
- ElevenLabs clientTools としての拡張機能は Hono API を直接呼ぶ設計が正しい
- リモート MCP は ElevenLabs Dashboard が直接バックエンドを呼ぶ（拡張機能は中継しない）

### mcpFallback.ts — SafeConfigView アローリスト設計

**判断**: URL 全体でなくホスト部のみを `endpointHost` として公開

**理由**:
- URL パスに `/api/mcp/tools` を含む情報を不用意に露出しない
- ホスト部のみで診断には十分（接続先の確認ができる）
- U-V3-05 の検証前にエンドポイント詳細を開示する必要がない

---

## U-V3-05 へのハンドオフノート

本 Unit（U-V3-04）は「登録設定と フォールバック境界の定義」を担当しました。
U-V3-05 で実施が必要な内容:

1. **実際の ElevenLabs Dashboard 登録確認**: `McpToolsBaseUrl` を使用した接続テスト
2. **`remote_mcp_primary` モードへの昇格**: `VITE_MCP_VERIFIED=true` 等の検証済みフラグ設定
3. **E2E MCP ツール呼び出しテスト**: ElevenLabs エージェントから `saborou_judge_sabori` 等を呼び出してレスポンス確認
4. **`getSafeConfigView().verificationState` が `"verified"` になることの確認**

---

## 完了判定基準チェック

- [x] `pkgs/cdk/test` が全パス（90 テスト）
- [x] `pkgs/extension` が全パス（187 テスト）
- [x] `tsc --noEmit` でエラーゼロ（テスト実行で暗黙的に確認）
- [x] `pkgs/extension/docs/ELEVENLABS_MCP_SETUP.md` がシークレットを含まない
- [x] `McpToolsBaseUrl` CfnOutput が CDK コードに追加済み
- [x] 疑似 `/mcp/tools/saborou_*` AgentCore パスが agentClient.ts から除去済み
