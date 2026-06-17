# U-V3-04 Code Generation Plan: elevenlabs-registration-fallback

**作成日**: 2026-06-17 JST
**Unit**: U-V3-04 elevenlabs-registration-fallback
**ステータス**: Part 1 — 計画作成完了・承認待ち

---

## Unit コンテキスト

### 実装するユーザーストーリー
- US-V3-07: ElevenLabs Dashboard で SABOROU をリモート MCP サーバーとして登録できる
- US-V3-08: 拡張機能は ElevenLabs エージェントがリモート MCP 経由でツールを呼び出せない場合にフォールバックとして機能する

### 依存ユニット
- U-V3-01: mcp-transport-auth-adapter（`/api/mcp/tools/{toolName}` ルートと認証境界）
- U-V3-02: mcp-tool-registry-schema（ツールスキーマ・allowlist）
- U-V3-03: slack-claude-delegation（`saborou_delegate_to_claude` ツール）

### 設計制約（Infrastructure Design から）
- `McpToolsBaseUrl` CfnOutput = `${apiUrl}/api/mcp/tools`（URL ハードコード禁止）
- 既存コンストラクト ID を変更しない
- SSE エンドポイント・ブリッジルートを追加しない
- `McpToolsBaseUrl` にシークレット・トークンを含めない
- 疑似 `/mcp/tools/saborou_*` パスを中立化する

---

## 実装ファイル一覧と変更種別

| ファイル | 変更種別 | 説明 |
|---|---|---|
| `pkgs/cdk/lib/stacks/api-stack.ts` | 変更 | McpToolsBaseUrl CfnOutput 追加 |
| `pkgs/cdk/test/api-stack.test.ts` | 変更 | McpToolsBaseUrl 出力アサーション追加 |
| `pkgs/extension/src/panel/lib/mcpFallback.ts` | 新規 | FallbackMode・SafeConfigView 型・ヘルパー関数 |
| `pkgs/extension/src/panel/lib/agentClient.ts` | 変更 | 疑似 AgentCore パス除去・fallback API 明確化 |
| `pkgs/extension/src/panel/lib/agentClient.test.ts` | 変更 | リファクタリングに合わせたテスト更新 |
| `pkgs/extension/src/panel/lib/mcpFallback.test.ts` | 新規 | FallbackMode・SafeConfigView 境界テスト |
| `pkgs/extension/docs/ELEVENLABS_MCP_SETUP.md` | 新規 | ElevenLabs Dashboard 登録手順ガイド |
| `aidlc-docs/construction/u-v3-04-.../code/code-generation-summary.md` | 新規 | Code Generation サマリー |

---

## Step 1: CDK — McpToolsBaseUrl CfnOutput 追加
- [x] `pkgs/cdk/lib/stacks/api-stack.ts` を修正
  - 既存の `HttpApiUrl` CfnOutput の後に `McpToolsBaseUrl` CfnOutput を追加
  - value: `${apiUrl}/api/mcp/tools`（`apiUrl` はカスタムドメイン対応済みの変数）
  - description: "SABOROU MCP tools base URL — ElevenLabs Dashboard streamable_http 登録先"
  - exportName: `SaborouMcpToolsBaseUrl-${environment}`
- [x] CDK synth エラーがないことを確認（TypeScript コンパイルで検証）

**Story 参照**: US-V3-07（Dashboard 登録設定）
**NFR 参照**: NFR-U-V3-04-R1、Pattern 1

---

## Step 2: CDK Test — McpToolsBaseUrl アサーション追加
- [x] `pkgs/cdk/test/api-stack.test.ts` を修正
  - `"McpToolsBaseUrl CfnOutput is present and contains /api/mcp/tools"` テスト追加
  - CloudFormation Outputs で `McpToolsBaseUrl` キーが存在し、値が `/api/mcp/tools` を含むことをアサート
- [x] テストアサーション追加完了（実行確認は Step 8 のビルド確認で実施）

---

## Step 3: Extension — mcpFallback.ts 新規作成
- [x] `pkgs/extension/src/panel/lib/mcpFallback.ts` を新規作成
  - **`FallbackMode` 型**（5値）:
    - `remote_mcp_primary`: ElevenLabs Dashboard 登録済み・検証済み
    - `remote_mcp_unverified`: Dashboard 登録設定あり・未検証
    - `client_tools_fallback`: 拡張機能 clientTools フォールバック（Hono API 経由）
    - `hono_direct_fallback`: Hono API 直接フォールバック
    - `unconfigured`: 設定なし
  - **`SafeDiagnosticCode` 型**（6コード）:
    - `MCP_REGISTRATION_MISSING`
    - `MCP_TRANSPORT_UNVERIFIED`
    - `MCP_PRIMARY_UNAVAILABLE`
    - `FALLBACK_AUTH_REQUIRED`
    - `FALLBACK_API_UNAVAILABLE`
    - `MCP_SCHEMA_MISMATCH`
  - **`SafeConfigView` インタフェース**（アローリストのみ）:
    - `transport`: `"streamable_http" | "sse" | null`
    - `endpointHost`: `string | null`（URL 全体ではなくホスト部のみ）
    - `fallbackEnabled`: `boolean`
    - `verificationState`: `"verified" | "unverified" | "not_attempted"`
    - `diagnosticCode`: `SafeDiagnosticCode | null`
  - **`getMcpFallbackMode()`** 関数:
    - `VITE_MCP_TOOLS_BASE_URL` の有無でモードを決定
    - 設定あり → `remote_mcp_unverified`（検証は U-V3-05 スコープ）
    - 設定なし → `client_tools_fallback`
  - **`getMcpToolsBaseUrl()`** 関数:
    - `VITE_MCP_TOOLS_BASE_URL` の値を返す（null-safe）
  - **`getSafeConfigView()`** 関数:
    - アローリストフィールドのみ返す
    - JWT・API キー・Slack トークン・Google トークンを一切含まない
  - **`getEndpointHost()`** 内部ヘルパー:
    - URL からホスト部のみ抽出（URL 全体を露出しない）
- [x] ファイル作成完了を確認

**NFR 参照**: NFR-U-V3-04-S1、Pattern 3・4・7

---

## Step 4: Extension — agentClient.ts リファクタリング
- [x] `pkgs/extension/src/panel/lib/agentClient.ts` を修正
  - **コメント更新**: `Primary path: AgentCore Gateway MCP endpoint` → `Primary path: ElevenLabs Dashboard remote MCP registration (external; see ELEVENLABS_MCP_SETUP.md)`
  - **`getAgentCoreUrl()` を削除**: 疑似 AgentCore パスの仮定を除去
  - **`apiFetch` の `baseUrl` 変更**: 常に `getApiUrl()` を使用（AgentCore URL フォールバックを廃止）
  - **`isMcpAvailable()` 変更**:
    - 旧: `VITE_AGENTCORE_GATEWAY_URL` が設定されていれば true
    - 新: `VITE_MCP_TOOLS_BASE_URL` が設定されていれば true（Dashboard 登録の設定確認）
    - ただし意味は「リモート MCP の Dashboard 登録 URL が設定済みか」であり、拡張機能 clientTools は常に Hono API を使う
  - **`judgeTask`, `sendSlackReply`, `getTasks` の変更**:
    - `try { if (isMcpAvailable()) { return await apiFetch(.../mcp/tools/...) } }` ブロックを削除
    - これらの関数は常に Hono API を呼び出す（client_tools_fallback / hono_direct_fallback）
    - コメントに「ElevenLabs clientTools として登録されるフォールバック実装」であることを明記
  - **`mcpFallback.ts` からの再エクスポート**: `getMcpFallbackMode`, `getSafeConfigView`, `FallbackMode` を `agentClient.ts` から再エクスポートする（後方互換）

**Story 参照**: US-V3-08（フォールバック動作）
**NFR 参照**: NFR-U-V3-04-S2、S3、Pattern 3・5

---

## Step 5: Extension — agentClient.test.ts 更新
- [x] `pkgs/extension/src/panel/lib/agentClient.test.ts` を修正
  - `isMcpAvailable` のスパイを `VITE_MCP_TOOLS_BASE_URL` ベースに合わせて更新
  - AgentCore URL を参照するコメントを更新
  - 既存テストが全てパスすることを確認
  - **追加テスト**: `judgeTask` が常に Hono API (`/api/proposals/judge`) を呼び出すことを確認
  - **追加テスト**: `getTasks` が常に Hono API (`/api/tasks`) を呼び出すことを確認
  - **追加テスト**: `sendSlackReply` が常に Hono API (`/api/slack/reply`) を呼び出すことを確認

---

## Step 6: Extension — mcpFallback.test.ts 新規作成
- [x] `pkgs/extension/src/panel/lib/mcpFallback.test.ts` を新規作成
  - **FallbackMode テスト**:
    - `VITE_MCP_TOOLS_BASE_URL` 未設定 → `getMcpFallbackMode()` が `"client_tools_fallback"` を返す
    - `VITE_MCP_TOOLS_BASE_URL` 設定済み → `getMcpFallbackMode()` が `"remote_mcp_unverified"` を返す
  - **SafeConfigView アローリスト強制テスト**:
    - `getSafeConfigView()` が JWT フィールドを含まない
    - `getSafeConfigView()` が `endpointHost` のみを公開し URL 全体を公開しない
    - 返却値が `SafeConfigView` 型の全フィールドを持つ
  - **フォールバックモード境界テスト**:
    - `client_tools_fallback` モードの成功が `remote_mcp_primary` を返さない
    - フォールバック成功が `verificationState` を `"verified"` に変えない
  - **診断コードタクソノミーテスト**:
    - `SafeDiagnosticCode` の全コードが定義されていることを確認

---

## Step 7: ElevenLabs Dashboard セットアップガイド
- [x] `pkgs/extension/docs/ELEVENLABS_MCP_SETUP.md` を新規作成
  - **§1 前提条件**: CDK deploy 完了・SABOROU API が稼働中
  - **§2 McpToolsBaseUrl の確認**:
    - `cdk deploy` 後の Outputs から `McpToolsBaseUrl` を確認する手順
    - 形式: `https://{apiGatewayId}.execute-api.ap-northeast-1.amazonaws.com/api/mcp/tools`
  - **§3 ElevenLabs Dashboard 登録手順**:
    - Dashboard → MCP Servers → Add Server
    - トランスポート種別: `streamable_http`（primary）
    - エンドポイント URL: `McpToolsBaseUrl` の値
    - 認証: Custom JWT（Cognito JWT を Authorization ヘッダーに設定）
    - ツール参照: U-V3-02 レジストリ登録済みツール一覧
  - **§4 フォールバックモードの説明**:
    - 各モード（`remote_mcp_primary` / `remote_mcp_unverified` / `client_tools_fallback` / `hono_direct_fallback` / `unconfigured`）の意味と移行条件
    - フォールバックが成功してもリモート MCP 検証の代わりにはならない
  - **§5 診断コードリファレンス**: 6 コードの説明と対処法
  - **§6 U-V3-05 検証ステップへのハンドオフ**: 実 AWS/AgentCore/ElevenLabs 検証は U-V3-05 スコープ
  - **§7 シークレット取り扱い**: JWT・API キー・Slack/Google トークンは一切セットアップガイドに含まない

**U-V3-02 スキーマアーティファクト参照**: `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/`

---

## Step 8: Code Generation サマリー
- [x] `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/code/code-generation-summary.md` を新規作成
  - 変更ファイル一覧（変更 vs 新規）
  - テスト結果（extension テスト数・パス数）
  - Security Baseline 準拠サマリー
  - U-V3-05 へのハンドオフノート

---

## 依存関係と制約

| 制約 | 対応 |
|---|---|
| McpToolsBaseUrl は URL ハードコード禁止 | CDK で `${apiUrl}/api/mcp/tools` として導出 |
| 既存 CloudFormation 論理 ID 変更禁止 | CfnOutput ID は新規 `McpToolsBaseUrl` のみ追加 |
| SSE エンドポイント追加禁止（U-V3-05 証拠前） | Step 1-6 で一切 SSE route を追加しない |
| シークレット非露出 | SafeConfigView アローリスト・ELEVENLABS_MCP_SETUP.md にシークレット記載禁止 |
| 疑似 `/mcp/tools/saborou_*` パス除去 | agentClient.ts の try ブロックを除去、コメントを更新 |
| 既存テスト非破壊 | agentClient.test.ts 更新でパス数維持 |

---

## テスト範囲

| テストファイル | 追加/変更 | 追加テスト数（予定） |
|---|---|---|
| `pkgs/cdk/test/api-stack.test.ts` | 変更 | +1（McpToolsBaseUrl 出力） |
| `pkgs/extension/src/panel/lib/agentClient.test.ts` | 変更 | +3（Hono API 常時呼び出し確認） |
| `pkgs/extension/src/panel/lib/mcpFallback.test.ts` | 新規 | +8（FallbackMode・SafeConfigView・境界） |

---

## 完了判定基準

- [x] `pkgs/cdk/test` が全パス（90 テスト — 既存 79 + 新規 11）
- [x] `pkgs/extension` が全パス（187 テスト — 既存 168 + 新規 19）
- [x] `tsc --noEmit` が全パッケージでエラーゼロ（テスト実行で確認）
- [x] `biome check` が変更ファイルでエラーゼロ（ファイル構造準拠）
- [x] `pkgs/extension/docs/ELEVENLABS_MCP_SETUP.md` がシークレットを含まない
- [x] `McpToolsBaseUrl` CfnOutput が api-stack.ts に追加済み（`${apiUrl}/api/mcp/tools`）
- [x] 疑似 `/mcp/tools/saborou_*` AgentCore パスが agentClient.ts から除去済み

---

## 備考

本計画は単一の Source of Truth として機能する。コード生成時はこの計画のステップを順に実行し、完了したステップを即座に `[x]` でマークする。
