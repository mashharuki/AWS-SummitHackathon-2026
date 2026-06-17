# Infrastructure Design - U-V3-04 elevenlabs-registration-fallback

**作成日**: 2026-06-17 JST
**Unit**: U-V3-04 elevenlabs-registration-fallback
**ステータス**: Review Required

---

## Design Summary

U-V3-04 は新規 AWS リソースを必要としない。既存の API Gateway / Lambda 構成（U-V3-01/02 で整備済み）を ElevenLabs Dashboard `streamable_http` 登録のプライマリエンドポイントとして使用する。

主要インフラ判断:

- 既存 `HttpApiUrl` CfnOutput を基に `McpToolsBaseUrl` CfnOutput を追加する。セットアップガイドはこの出力を参照し、オペレーターが正確な URL を確認できるようにする。
- SSE ブリッジは延期する。U-V3-05 の実 AWS/ElevenLabs 互換性検証が `streamable_http` をブロックした場合のみ、Infrastructure Design を再オープンして `sse` エンドポイントを設計する。
- IAM・ネットワーク・DynamoDB・Secrets Manager・EventBridge の変更はなし。

---

## AWS リソースマッピング

| 論理コンポーネント | AWS/CDK リソース | スタック | U-V3-04 設計 |
|---|---|---|---|
| `RemoteMcpSetupDescriptor` | 既存 `HttpApiUrl` CfnOutput + 新規 `McpToolsBaseUrl` CfnOutput | `SaborouApiStack` | `McpToolsBaseUrl` を追加。MCP エンドポイントベース URL を安定した CDK 出力として公開する。 |
| `TransportDecisionGate` | ドキュメント / 設定アーティファクト（インフラリソースなし） | docs | `streamable_http` をデフォルト選択。`sse` は `fallback_required` 状態後にのみ設計する。 |
| `ExtensionVoiceFallbackCoordinator` | 既存 Chrome 拡張（`pkgs/extension`） | クライアントサイド | インフラ変更なし。既存 ElevenLabs SDK フックを活用。 |
| `FallbackApiClient` | 既存 Hono Lambda + API Gateway | `SaborouApiStack` | インフラ変更なし。既存認証済み API ルートを呼び出す。 |
| `SafeConfigPresenter` | 拡張 UI コード | クライアントサイド | インフラ変更なし。 |
| `DiagnosticCodeMapper` | 拡張コード | クライアントサイド | インフラ変更なし。 |
| `RegistryBackedSetupArtifact` | 既存スキーマアーティファクト（U-V3-02 の S3 bucket + OpenAPI YAML） | `SaborouAgentCoreStack` | インフラ変更なし。セットアップドキュメントが U-V3-02 スキーマ出力を参照する。 |
| `DocumentationAndTestLock` | テストコード（`pkgs/extension/src/__tests__/`） | テスト | インフラ変更なし。テストアサーションのみ。 |

---

## MCP エンドポイント設計

### 既存エンドポイント（U-V3-01 で整備済み）

```
POST {HttpApiUrl}/api/mcp/tools/{toolName}
```

U-V3-01 で設計・実装された MCP アダプタールートが ElevenLabs Dashboard `streamable_http` 登録のプライマリエンドポイントとなる。

### ElevenLabs Dashboard 登録設定

| 項目 | 値 |
|---|---|
| トランスポート種別 | `streamable_http`（プライマリ） |
| エンドポイント URL | `{McpToolsBaseUrl}` (= `{HttpApiUrl}/api/mcp/tools`) |
| 認証方式 | Custom JWT（Cognito JWT を Authorization ヘッダーに含める） |
| ツールスキーマ参照 | U-V3-02 レジストリ登録済みツール（`saborou_get_tasks`, `saborou_judge_sabori` 等） |

### `sse` ブリッジの延期

```
状態: 延期（deferred）
トリガー: U-V3-05 が streamable_http 互換性をブロックする証拠を記録した場合
再オープン条件:
  - 新規エンドポイント（/api/mcp/sse 等）が必要
  - CDK 出力・IAM・アクセスログ設定が必要
  - U-V3-05 の evidence artifact が必要
```

---

## CDK 変更セット

| ファイル | 変更内容 |
|---|---|
| `pkgs/cdk/lib/stacks/api-stack.ts` | `McpToolsBaseUrl` CfnOutput を追加（`apiUrl + "/api/mcp/tools"` で導出） |
| `pkgs/cdk/test/api-stack.test.ts` | `McpToolsBaseUrl` 出力の存在と形式（`/api/mcp/tools` サフィックス）をアサート |

### McpToolsBaseUrl CfnOutput 設計

```typescript
new cdk.CfnOutput(this, "McpToolsBaseUrl", {
  value: `${apiUrl}/api/mcp/tools`,
  description:
    "SABOROU MCP tools base URL — ElevenLabs Dashboard streamable_http 登録先",
  exportName: `SaborouMcpToolsBaseUrl-${environment}`,
});
```

---

## セキュリティ

### 既存セキュリティ境界の維持

- U-V3-01 で設計した JWT 認証バウンダリ、AgentCore IAM ロールスコープ、アクセスログ設定はすべてそのまま維持する。
- U-V3-04 の CDK 変更（CfnOutput 追加のみ）はセキュリティ設定を変更しない。
- `McpToolsBaseUrl` CfnOutput は URL 文字列のみを公開する。シークレット・JWT・APIキーは含まない。

### 拡張側のシークレット保護

- `SafeConfigPresenter` が表示する設定値はアローリストベース（トランスポート種別・エンドポイントホスト・フォールバック有効状態・検証状態・診断コードのみ）。
- JWT・ElevenLabs API キー・Slack トークン・Google トークン・署名付き AWS リクエスト詳細は一切ブラウザ UI に表示しない。

---

## Security Baseline 準拠

| ルール | ステータス | 根拠 |
|---|---|---|
| SECURITY-01 暗号化 | N/A | 新規永続化リソースなし。 |
| SECURITY-02 アクセスログ | 準拠（既存） | U-V3-01 で HTTP API アクセスログ設定済み。新規エンドポイントなし。 |
| SECURITY-03 アプリケーションログ | 準拠（既存） | U-V3-01 の安全監査ログが継続適用。 |
| SECURITY-04 HTTP セキュリティヘッダ | N/A | 新規 HTML エンドポイントなし。 |
| SECURITY-05 入力バリデーション | 準拠（既存） | 既存スキーマファーストバリデーションが継続。 |
| SECURITY-06 最小権限 | 準拠（既存） | 新規 IAM 変更なし。U-V3-01 の AgentCore ロールスコープを維持。 |
| SECURITY-07 ネットワーク設定 | N/A | ネットワークトポロジー変更なし。 |
| SECURITY-08 アクセス制御 | 準拠（既存） | 既存 Cognito JWT バリデーションが継続。フォールバックがサーバーサイド認可をバイパスしない。 |
| SECURITY-09 ハードニング | 準拠 | `SafeConfigPresenter` により内部詳細が非露出。 |
| SECURITY-10 サプライチェーン | 準拠 | 新規ランタイム依存なし。 |
| SECURITY-11 セキュア設計 | 準拠 | プライマリ/フォールバック分離と誤用防止リトライ動作が明示的。 |
| SECURITY-12 クレデンシャル管理 | 準拠 | CDK 出力は URL 文字列のみ。シークレット非含有。 |
| SECURITY-13 完全性 | 準拠（既存） | U-V3-02 レジストリバックドスキーマアーティファクトを継続参照。 |
| SECURITY-14 モニタリング | 準拠（既存） | U-V3-01 の MetricFilters/Alarms が継続。 |
| SECURITY-15 フェイルセーフデフォルト | 準拠 | 設定/認証/スキーマ障害が安全なフォールバックに停止または移行。 |

**ブロッキングファインディング**: なし

---

## Code Generation への制約

- `McpToolsBaseUrl` CfnOutput は `apiUrl + "/api/mcp/tools"` で導出する（URL ハードコード禁止）。
- 既存コンストラクト ID を変更しない（CloudFormation 論理 ID の変更によるリソース置換を防ぐ）。
- SSE エンドポイントやブリッジルートを追加しない（U-V3-05 証拠なしで実装禁止）。
- `McpToolsBaseUrl` にはシークレット・トークン・認証情報を含めない。
- セットアップドキュメントが `streamable_http` を主登録トランスポートとして示すことをテストで検証する。
- 疑似 `/mcp/tools/saborou_*` パスをリモート AgentCore MCP として記述するコメント・ドキュメントを削除または中立化する。
