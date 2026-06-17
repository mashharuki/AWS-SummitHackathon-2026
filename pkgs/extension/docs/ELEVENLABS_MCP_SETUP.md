# ElevenLabs Dashboard — SABOROU リモート MCP サーバー登録ガイド

**対象 Unit**: U-V3-04 elevenlabs-registration-fallback
**作成日**: 2026-06-17
**関連 Unit**: U-V3-05（実際の AWS/ElevenLabs 検証ステップ）

---

## §1 前提条件

以下が完了していることを確認してください。

- [ ] SABOROU CDK スタックが `ap-northeast-1` にデプロイ済み
- [ ] `cdk deploy` が正常に完了し CloudFormation Outputs が存在する
- [ ] SABOROU API (`/health`) が稼働中（`curl https://<apiUrl>/health` で 200 OK）
- [ ] ElevenLabs アカウントおよび Dashboard へのアクセス権がある
- [ ] U-V3-01（mcp-transport-auth-adapter）がデプロイ済み
- [ ] U-V3-02（mcp-tool-registry-schema）がデプロイ済み

---

## §2 McpToolsBaseUrl の確認

CDK デプロイ後の CloudFormation Outputs から `McpToolsBaseUrl` を取得します。

### AWS マネジメントコンソールから確認

1. CloudFormation → スタック一覧 → `SaborouApiStack-<environment>` を開く
2. 「出力」タブを開く
3. `McpToolsBaseUrl` キーの値をコピーする

形式:
```
https://<apiGatewayId>.execute-api.ap-northeast-1.amazonaws.com/api/mcp/tools
```

または カスタムドメイン有効時:
```
https://saborou-api.agentic-jp.com/api/mcp/tools
```

### AWS CLI から確認

```bash
aws cloudformation describe-stacks \
  --stack-name SaborouApiStack-dev \
  --query "Stacks[0].Outputs[?OutputKey=='McpToolsBaseUrl'].OutputValue" \
  --output text \
  --region ap-northeast-1
```

> **注意**: この URL はエンドポイントのベース URL です。シークレット・API キー・JWT は含まれていません。

---

## §3 ElevenLabs Dashboard 登録手順

### ステップ 1: Dashboard にアクセス

1. [ElevenLabs Dashboard](https://elevenlabs.io/app) にアクセスしてログイン
2. 対象のエージェントを開く

### ステップ 2: MCP サーバーを追加

1. エージェント設定 → 「Tools」タブを開く
2. 「MCP Servers」セクション → 「Add Server」ボタンをクリック

### ステップ 3: 接続設定を入力

| フィールド | 設定値 |
|-----------|--------|
| **Server Name** | `SABOROU` |
| **Transport Type** | `streamable_http` (primary) |
| **Endpoint URL** | `McpToolsBaseUrl` の値（§2 で取得） |

### ステップ 4: 認証設定

- **Authentication**: Custom JWT
- **Authorization Header**: `Authorization: Bearer <Cognito JWT>`
- Cognito JWT は拡張機能のログイン後に `getValidToken()` で取得される
- Dashboard 上でのテストには有効な Cognito JWT が必要

### ステップ 5: ツール参照（U-V3-02 レジストリ登録済みツール）

以下のツールが利用可能です（U-V3-02 で定義）。

| ツール名 | 説明 |
|---------|------|
| `saborou_judge_sabori` | Slack メッセージのサボり度を判定しリプライ案を生成 |
| `saborou_send_slack_reply` | 承認済みリプライを Slack に送信 |
| `saborou_get_tasks` | タスク一覧を取得 |
| `saborou_delegate_to_claude` | Claude Sonnet 4.6 に処理を委譲（U-V3-03） |

---

## §4 フォールバックモードの説明

SABOROU の MCP 統合は段階的なフォールバックを提供します。

| モード | 説明 | 移行条件 |
|--------|------|----------|
| `remote_mcp_primary` | ElevenLabs Dashboard 登録済み・検証済み | U-V3-05 で `VITE_MCP_VERIFIED=true` を設定後 |
| `remote_mcp_unverified` | Dashboard 登録設定あり・未検証 | `VITE_MCP_TOOLS_BASE_URL` を設定した直後 |
| `client_tools_fallback` | 拡張機能 clientTools フォールバック | `VITE_MCP_TOOLS_BASE_URL` 未設定時（デフォルト） |
| `hono_direct_fallback` | Hono API 直接フォールバック | clientTools 外から直接呼び出す場合 |
| `unconfigured` | 設定なし | `VITE_MCP_TOOLS_BASE_URL` も未設定で設定画面未操作時 |

### 重要事項

- フォールバックが成功しても `remote_mcp_primary` にはなりません
- `client_tools_fallback` 成功は `verificationState` を `"verified"` に変えません
- 実際の ElevenLabs → SABOROU MCP 通信の検証は **U-V3-05 スコープ**です

---

## §5 診断コードリファレンス

`getSafeConfigView().diagnosticCode` が返す可能性のある診断コードと対処法。

| コード | 意味 | 対処法 |
|--------|------|--------|
| `MCP_REGISTRATION_MISSING` | ElevenLabs Dashboard に MCP サーバーが未登録 | §3 の登録手順を実施してください |
| `MCP_TRANSPORT_UNVERIFIED` | 登録設定はあるが接続未検証 | U-V3-05 の検証ステップを実施してください |
| `MCP_PRIMARY_UNAVAILABLE` | リモート MCP エンドポイントが到達不可 | CDK デプロイ状態と API ヘルスチェックを確認してください |
| `FALLBACK_AUTH_REQUIRED` | フォールバック時に認証情報が必要 | Cognito ログイン状態を確認してください |
| `FALLBACK_API_UNAVAILABLE` | フォールバック先の Hono API が到達不可 | `VITE_API_URL` と API デプロイ状態を確認してください |
| `MCP_SCHEMA_MISMATCH` | ツールスキーマが期待値と一致しない | U-V3-02 のスキーマ定義を確認してください |

---

## §6 U-V3-05 検証ステップへのハンドオフ

本ガイドで設定した内容は U-V3-05 で実際に検証されます。

U-V3-05 スコープ（本ガイドのスコープ外）:
- ElevenLabs エージェントから実際に `McpToolsBaseUrl` を叩いての通信確認
- `remote_mcp_primary` モードへの昇格（`VITE_MCP_VERIFIED=true` の設定）
- ElevenLabs と SABOROU バックエンドの E2E MCP ツール呼び出しテスト
- AgentCore Gateway との統合確認（将来対応）

---

## §7 シークレット取り扱いに関する注意

本ガイドおよびリポジトリ上のコード（`mcpFallback.ts`）は以下を**一切含みません**:

- Cognito JWT / アクセストークン / リフレッシュトークン
- Slack OAuth トークン / Bot Token
- Google OAuth トークン / リフレッシュトークン
- ElevenLabs API キー
- AWS アクセスキー / シークレットキー

シークレット類は AWS Secrets Manager または SSM Parameter Store で管理し、
Lambda 環境変数経由でのみバックエンドに注入されます（`.claude/rules/aws-constraints.md` 参照）。

---

## 関連ドキュメント

- [U-V3-02 MCP ツールスキーマ定義](../../aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/)
- [U-V3-01 MCP トランスポート認証アダプタ](../../aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/)
- [mcpFallback.ts ソースコード](../src/panel/lib/mcpFallback.ts)
- [CDK API スタック定義](../../pkgs/cdk/lib/stacks/api-stack.ts)
