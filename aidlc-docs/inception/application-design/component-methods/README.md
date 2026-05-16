# コンポーネントメソッド定義 — インデックス

**プロジェクト名**: SABOROU（サボロー）  
**バージョン**: 1.1.0（コンポーネント別ファイル分割済み）  
**注意**: 詳細なビジネスロジックは Construction フェーズの Functional Design で定義する

このディレクトリはコンポーネント毎にファイルを分割して審査員・AI エージェントが効率的に参照できるように構成しています。

---

## ファイル構成

### バックエンド API（apps/api）

| ファイル | コンポーネント | 主な責務 |
|---------|--------------|---------|
| [BE-01-auth-handler.md](./BE-01-auth-handler.md) | AuthHandler | JWT 検証 / Cognito トークン交換 |
| [BE-02-task-handler.md](./BE-02-task-handler.md) | TaskHandler | タスク CRUD / 候補承認 |
| [BE-03-proposal-handler.md](./BE-03-proposal-handler.md) | ProposalHandler | サボり提案取得 / SSE ストリーミング |
| [BE-04-honne-handler.md](./BE-04-honne-handler.md) | HonneHandler | 本音データ記録 |
| [BE-05-connection-handler.md](./BE-05-connection-handler.md) | ConnectionHandler | 外部サービス OAuth 連携管理 |
| [BE-06-webhook-handler.md](./BE-06-webhook-handler.md) | WebhookHandler | Slack Events API 受信（Vercel Chat SDK） |

### エージェント（packages/agent）

| ファイル | コンポーネント | 主な責務 |
|---------|--------------|---------|
| [AG-01-task-extractor-agent.md](./AG-01-task-extractor-agent.md) | TaskExtractorAgent | 外部イベントからタスク候補を抽出 |
| [AG-02-sabori-proposer-agent.md](./AG-02-sabori-proposer-agent.md) | SaboriProposerAgent | サボり判定（心理学フレームワーク + LLM）/ SSE 出力 |
| [AG-03-persona-renderer.md](./AG-03-persona-renderer.md) | PersonaRenderer | おっとりサボロー口調への変換 |
| [AG-04-context-collector.md](./AG-04-context-collector.md) | ContextCollector | Slack からコンテキスト収集（v1.1.0 以降: Gmail / Calendar） |

### 共通・インフラ

| ファイル | コンポーネント | 主な責務 |
|---------|--------------|---------|
| [shared-utils.md](./shared-utils.md) | packages/shared | 日付ユーティリティ / Bedrock トークン管理 / エラー型 |
| [infra-components.md](./infra-components.md) | infra/ | CDK 6スタック（Cognito/Data/Api/Agent/Webhook/Frontend） |

---

## コンポーネント間の依存関係

```
[BE-01] AuthHandler
  └── Cognito UserPool（JWT 検証）

[BE-02] TaskHandler ──→ [AG-01] TaskExtractorAgent（候補変換）
                    └──→ DynamoDB Tasks / TaskCandidates

[BE-03] ProposalHandler ──→ [AG-02] SaboriProposerAgent（提案生成）
                        └──→ DynamoDB Proposals（キャッシュ）

[BE-04] HonneHandler ──→ DynamoDB HonneData

[BE-05] ConnectionHandler ──→ Secrets Manager（OAuth token 保管）
                          └──→ DynamoDB ServiceConnections

[BE-06] WebhookHandler ──→ Vercel Chat SDK（署名検証）
                       └──→ EventBridge（タスク抽出イベント転送）

[AG-02] SaboriProposerAgent
  ├── [AG-04] ContextCollector（文脈収集）
  ├── Bedrock Claude Sonnet（フル判定・Structured Output）
  └── [AG-03] PersonaRenderer（口調変換）

[AG-03] PersonaRenderer ──→ Bedrock Claude Haiku（口調変換）
                         └──→ DynamoDB Personas

[AG-04] ContextCollector ──→ Slack API
                          └──→ Secrets Manager（Slack Bot Token）
```

---

## 心理学フレームワーク（AG-02 の詳細）

SABOROU のサボり判定は 5 つの社会心理学・動機づけ理論を設計基盤としています。  
詳細は [AG-02-sabori-proposer-agent.md](./AG-02-sabori-proposer-agent.md) の「理論的根拠」セクションを参照。

| 理論 | 出典 | ContextSignals への対応 |
|------|------|----------------------|
| Collective Effort Model | Karau & Williams (1993) | contextCoverage |
| Identifiability | Williams et al. (1981) | requesterActiveStatus / hasReminder |
| Sucker Effect | Kerr (1983) | requesterActiveStatus (away/offline) |
| Self-Determination Theory | Ryan & Deci (2000) | reminderCount / urgencyLevel |
| Expectancy Theory | Vroom (1964) | deadlineMinutes / contextCoverage |

---

## 関連ドキュメント

- [components.md](../components.md) — コンポーネント一覧（FR マッピング）
- [services.md](../services.md) — サービス定義（ポート・依存関係）
- [component-dependency.md](../component-dependency.md) — 依存関係マトリクス
- [aws-architecture.md](../aws-architecture.md) — AWS アーキテクチャ図
