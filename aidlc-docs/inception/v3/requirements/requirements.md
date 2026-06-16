# SABOROU v3 要件定義 - MCP Serverization

**バージョン**: 1.1.0
**作成日**: 2026-06-16
**ステータス**: ギャップ分析反映版・レビュー待ち
**対象**: SABOROU APIサーバーのMCPサーバー化、およびElevenLabs AgentからのSABOROU機能呼び出し
**分析方法**: Serena MCPでプロジェクトを有効化し、実コードを局所読みして照合（SerenaのTypeScript宣言解決は現環境では失敗したため、`rg` と対象ファイル確認で補完）

---

## 0. インテント分析

### ユーザー要求

ElevenLabs SDKのAgent接続は動作したが、SABOROU APIサーバーをMCPサーバー化していないため、音声からSABOROU機能を呼び出せない。AI-DLCでこの実装を進める。

### Request Type

- **分類**: Enhancement / Integration
- **対象**: 既存v2音声Agent・AgentCore Gateway・Hono API・Chrome拡張の接続完成
- **スコープ**: Multiple Components
- **複雑度**: Complex
- **リスク**: 高。認証、外部Agent連携、Slack送信、実AWS/ElevenLabs検証を含む。

### 主要判断

| 論点 | 決定 |
|------|------|
| MCP実装方式 | Amazon Bedrock AgentCore Gatewayを本命とし、OpenAPIスキーマとGateway接続を完成させる |
| ツール化範囲 | 既存APIで音声から呼べるものをすべてMCPツール化する |
| 認証方式 | AgentCore GatewayはCustom JWT/IAM連携を優先し、Hono API側は既存JWT認証を維持する |
| デモ完了条件 | Slack返信送信、タスク一覧読み上げ、タスク選択後にSlack上で `@Claude` をメンションして実行依頼する |
| Security Baseline | 有効。ブロッキング制約として扱う |
| Property-Based Testing | 無効。通常のユニット/統合/手動E2Eテストで対応する |
| 検証レベル | 実AWS / AgentCore / ElevenLabs Agentの実接続まで検証する |

---

## 1. 現状整理

### 実装済み資産

- `pkgs/extension`: Chrome拡張 Side Panel、ElevenLabs SDK接続、Cognito PKCE、clientTools登録
- `pkgs/extension/src/panel/lib/agentClient.ts`: AgentCore Gateway風パスを優先し、Hono APIへフォールバックする呼び出し層
- `pkgs/backend`: Hono API、Slack返信、タスク、提案生成、Google連携、進捗報告系ルート
- `pkgs/cdk/lib/stacks/agentcore-stack.ts`: AgentCore Gateway / GatewayTarget / OpenAPIスキーマS3配置のCDK定義
- `pkgs/agent`: SaboriProposerAgentV2、返信文・断り文生成、音声読み上げ用整形

### コード照合で確認した実装済み事項

| 項目 | 実装状況 | 根拠 |
|------|----------|------|
| AgentCore Gateway CDK | 実装済み | `pkgs/cdk/lib/stacks/agentcore-stack.ts` |
| AgentCore用OpenAPIスキーマ | 手書きスキーマあり | `pkgs/cdk/schemas/saborou-openapi.yaml` |
| AgentCoreスタックテスト | Gateway / Target / S3 / Outputの構造テストあり | `pkgs/cdk/test/agentcore-stack.test.ts` |
| Hono API JWT Authorizer | API GatewayのメインルートにCognito JWT Authorizerあり | `pkgs/cdk/lib/stacks/api-stack.ts` |
| Hono認証ミドルウェア | API Gateway JWT claims `sub` を `userId` として使用 | `pkgs/backend/src/middleware/auth.ts` |
| ElevenLabs clientTools | `saborou_get_tasks` / `saborou_judge_sabori` / `saborou_send_slack_reply` を登録 | `pkgs/extension/src/panel/hooks/useConversationalAgent.ts` |
| 拡張側APIクライアント | AgentCore URLがあれば `/mcp/tools/...` を優先し、失敗時にHono APIへフォールバック | `pkgs/extension/src/panel/lib/agentClient.ts` |
| Slack返信送信API | `POST /api/slack/reply` 実装済み | `pkgs/backend/src/routes/slack.ts` |
| 進捗報告生成API | `POST /api/tasks/:id/report` 実装済み | `pkgs/backend/src/routes/tasks.ts` |
| Google Calendar/Gmail取得API | 実装済みだがAgentCoreスキーマ未公開 | `pkgs/backend/src/routes/google.ts` |

### コード照合で確認したギャップ

| Gap ID | 内容 | 影響 | 対応要件 |
|--------|------|------|----------|
| GAP-V3-01 | AgentCore用OpenAPIスキーマは5 operationのみ。Google連携、Slack sync/channels、タスク候補承認、手動作成、planned steps、honne等は未公開 | 「既存APIで音声から呼べるものすべて」という回答に未達 | FR-V3-02 / FR-V3-05 |
| GAP-V3-02 | バックエンド `/doc` のOpenAPI 3.0定義と、AgentCore用 `saborou-openapi.yaml` が別管理 | ルート追加時にMCP公開漏れが起きる | FR-V3-05 |
| GAP-V3-03 | AgentCore Gateway Targetは `GATEWAY_IAM_ROLE` でHTTP APIを呼ぶが、HTTP APIのメインルートはCognito JWT Authorizer必須 | Gateway経由のHono API呼び出しが401になる可能性が高い | FR-V3-06 / NFR-V3-S1 |
| GAP-V3-04 | Hono `authMiddleware` はAPI Gateway JWT claimsからのみ `userId` を読む | AgentCoreからIAM認証だけで来た場合、Lambda内でユーザー識別できない | FR-V3-06 / NFR-V3-S1 |
| GAP-V3-05 | 拡張側の `/mcp/tools/saborou_*` はAgentCoreの実MCPプロトコルではなく仮想RESTパス | `VITE_AGENTCORE_GATEWAY_URL` を設定しても実Gatewayに対して動かない可能性が高い | FR-V3-03 |
| GAP-V3-06 | `@Claude` メンション投稿専用API/ツールは未実装 | Q4のデモ完了条件に未達 | FR-V3-04 |
| GAP-V3-07 | `POST /api/proposals/judge` の `saboriScore` は固定値 `0.5` | 音声で「判定」として扱うには精度不足 | FR-V3-07 |
| GAP-V3-08 | 実AWS / AgentCore / ElevenLabs Agentを通した実接続テスト手順が未実装 | Q7の検証レベルDに未達 | NFR-V3-R1 / NFR-V3-T1 |

---

## 2. 機能要件

### FR-V3-01: AgentCore Gateway本命のMCPサーバー化

SABOROU Hono APIをAmazon Bedrock AgentCore Gateway経由でMCPツールとして公開する。

**受け入れ条件**:

- AgentCore Gateway TargetがSABOROU OpenAPIスキーマを読み込める
- GatewayのMCP endpoint URLをCDK Outputまたは手順書から取得できる
- GatewayはCognito Custom JWTで呼び出し元を検証する
- GatewayからHono APIへの呼び出しはIAM `execute-api:Invoke` の最小権限で行う

### FR-V3-02: 既存APIの音声呼び出し可能ツール化

音声Agentから利用価値がある既存APIをMCPツールとして公開する。ユーザー回答は「既存APIで音声から呼べるものはすべて」だが、認証/OAuth callback/webhook/healthのように音声Agentに公開すべきでないAPIは除外する。

**現在AgentCoreスキーマに存在するツール**:

| MCPツール候補 | 対応API | 目的 |
|---------------|---------|------|
| `saborou_get_tasks` | `GET /api/tasks` | 今日/現在のタスク一覧を取得し、音声で読み上げる |
| `saborou_judge_sabori` | `POST /api/proposals/judge` | Slackメッセージの返信ドラフト生成 |
| `saborou_send_slack_reply` | `POST /api/slack/reply` | ユーザー承認後にSlackへ返信を送信 |
| `saborou_schedule_report` | `POST /api/tasks/{id}/report` | タスク進捗報告を生成/スケジュール |
| `streamProposal` | `POST /api/proposals/stream` | OpenAPI上には存在するが、実Honoルートとの差分確認が必要 |

**v3で追加公開するツール**:

| MCPツール候補 | 対応API | 目的 |
|---------------|---------|------|
| `saborou_get_google_calendar_status` | `GET /api/google/calendar/status` | Google Calendar文脈の鮮度と忙しさを取得 |
| `saborou_fetch_google_calendar` | `POST /api/google/calendar/fetch` | ユーザー承認後にCalendarからタスク候補を抽出 |
| `saborou_fetch_gmail_tasks` | `POST /api/google/gmail/fetch` | ユーザー承認後にGmailからタスク候補を抽出 |
| `saborou_get_slack_channels` | `GET /api/slack/channels` | 投稿先候補を音声Agentへ提示 |
| `saborou_sync_slack_messages` | `POST /api/slack/sync-messages` | ユーザー承認後にSlack履歴からタスク候補を抽出 |
| `saborou_create_task` | `POST /api/tasks` | 音声で手動タスクを作成 |
| `saborou_get_task` | `GET /api/tasks/{id}` | 選択タスクの詳細を取得 |
| `saborou_approve_task_candidate` | `POST /api/tasks/candidates/{id}/approve` | 音声承認で候補をタスク化 |
| `saborou_delegate_task_to_claude` | 新規またはSlack送信API拡張 | 選択したタスクをSlack上で `@Claude` にメンションして実行依頼する |

**受け入れ条件**:

- 各ツールに明確な `operationId` とAI向け英語descriptionがある
- ツール入力はZod/OpenAPIで検証される
- ツール出力は音声Agentが扱いやすいJSONとして安定化される
- ツールごとにユニットテストまたは統合テストがある
- OAuth callback、webhook、health、管理用内部APIはMCP公開対象から除外される

### FR-V3-03: ElevenLabs AgentからのMCPツール呼び出し

ElevenLabs Agentの会話フローからSABOROU MCPツールを呼び出せるようにする。

**受け入れ条件**:

- ElevenLabs Agent設定にSABOROU MCP Gateway URLを登録できる
- Agentが `saborou_get_tasks` を呼び、結果を音声で要約できる
- Agentが `saborou_judge_sabori` を呼び、返信ドラフトを提示できる
- Agentがユーザー承認後に `saborou_send_slack_reply` を呼べる
- 拡張側の仮想RESTパス `/mcp/tools/...` と、AgentCore Gatewayの実MCP呼び出し方式の差分が解消される
- ElevenLabs Agentが直接MCPサーバー登録で呼ぶ方式と、拡張の `clientTools` が中継する方式のどちらを採用するかをApplication Designで確定する
- MCP経路が使えない場合の既存Hono APIフォールバック方針が文書化される

### FR-V3-04: `@Claude` タスク実行依頼フロー

音声でタスク一覧から任意のタスクを選び、Slack上で `@Claude` をメンションして実行依頼できる。

**SABOROU側の責務**:

- タスク一覧を音声Agentへ渡す
- ユーザーが選択したタスクを特定する
- Claudeに渡す依頼文を生成する
- SlackチャンネルまたはDMへ `@Claude` メンション付きで投稿する
- 投稿結果をユーザーへ音声で報告する

**外部Claude側の責務**:

- Slack上でメンションを受け取り、タスクを実行する
- 実行結果の品質・所要時間はSABOROUの直接責務外とする

**受け入れ条件**:

- ユーザー承認なしに `@Claude` メンション投稿を行わない
- 投稿先チャンネル/DMが明示されていない場合はデフォルト送信先または確認フローを使う
- 投稿文にはタスクタイトル、背景、期待する成果物、必要な制約が含まれる
- Slack送信エラー時は音声Agentへ安全なエラー要約を返す

### FR-V3-05: OpenAPIスキーマ品質強化

AgentCore GatewayがMCPツールを正しく生成できるよう、OpenAPI定義を整備する。

**受け入れ条件**:

- 全MCP対象APIに `operationId` がある
- descriptionはLLMがツール選択しやすい英語で記述される
- request/response schemaに必須項目、型、最大長、enumが定義される
- セキュリティスキームがCognito JWT前提で明記される
- `pkgs/backend/src/config/openapi.ts` と `pkgs/cdk/schemas/saborou-openapi.yaml` の二重管理を解消するか、同期検証テストを追加する
- AgentCore用スキーマに含めるAPIと除外するAPIの allowlist をテストで固定する

### FR-V3-06: AgentCore GatewayからHono APIへの認証経路整備

AgentCore GatewayがMCP tool callを受けた後、Hono APIへ安全にユーザー文脈付きで到達できるようにする。

**現状ギャップ**:

- AgentCore Gateway Targetは `GATEWAY_IAM_ROLE` を使う
- API Gateway HTTP APIのメインルートはCognito JWT Authorizerを要求する
- Hono `authMiddleware` はAPI Gateway JWT claimsから `sub` を読む

**受け入れ条件**:

- Gateway経由の呼び出しでHono APIが `userId` を取得できる
- 既存ブラウザ/拡張のCognito JWT認証を壊さない
- Gateway用の認証バイパスを作る場合は、署名検証、audience、issuer、許可ツール、ユーザーIDの由来を明示する
- IAMだけでユーザー単位の権限を代替しない
- 認証失敗時はトークンや内部パスを返さない

### FR-V3-07: 返信ドラフト生成とサボり判定の意味整理

音声Agentが「サボり判定」として扱う出力を、実装と一致させる。

**現状ギャップ**:

- `POST /api/proposals/judge` は返信ドラフト生成に近く、`saboriScore` は固定値 `0.5`

**受け入れ条件**:

- `saborou_judge_sabori` の説明を「返信ドラフト生成」に寄せるか、実際のサボり判定ロジックを追加する
- 音声Agentが読み上げる `ttsSummary` と、UI表示用 `replyDraft` の責務を明確にする
- スコアを返す場合は固定値ではなく、根拠ある計算またはAI出力にする

---

## 3. 非機能要件

### NFR-V3-S1: 認証・認可

- AgentCore GatewayはCustom JWTでCognitoトークンを検証する
- Hono API側は既存JWT認証を維持する
- ユーザー単位の認可を崩さず、タスク・Slack連携・Google連携のIDORを防ぐ
- Slack送信、`@Claude` メンション投稿、進捗報告などの副作用ツールは明示承認後のみ実行する
- AgentCore GatewayからHono APIへ到達する際も、ユーザーIDの信頼境界を明示し、IAMロールだけでユーザー認可を代替しない

### NFR-V3-S2: 入力検証

- 全MCPツール入力はZod/OpenAPI schemaで検証する
- Slack投稿文、タスクID、チャンネルID、thread timestampには長さ・形式制約を設ける
- HTML/script相当の入力は拒否または無害化する

### NFR-V3-S3: 秘密情報管理

- ElevenLabs APIキー、Slack Bot Token、Google OAuth tokenは拡張機能に保持しない
- Secrets Managerまたは既存の安全な保管方式を使う
- JWTや外部トークンはCloudWatchログ、ブラウザログ、エラー表示に出さない

### NFR-V3-P1: レイテンシ

- 音声会話中のタスク一覧取得は3秒以内を目標にする
- Slack返信ドラフト生成は既存Bedrock呼び出しの遅延を許容するが、Agentには進行中状態を返せる設計にする
- Slack送信系ツールはユーザー承認から5秒以内の完了を目標にする

### NFR-V3-R1: デモ可用性

- 実AWS / AgentCore / ElevenLabs Agentで動作確認する
- AgentCore Gatewayが利用不可の場合のフォールバック手順を保持する
- デモ前にMCP endpoint、Cognito、Slack送信、ElevenLabs Agent設定を確認する手順を用意する
- `enableAgentCore=false` は全体デプロイ用フォールバックとして維持するが、v3完了条件にはAgentCore有効時の実接続確認を含める

### NFR-V3-T1: テスト

- MCP対象APIのschema/operationId/description検証テストを追加する
- AgentCore用OpenAPI schemaの対象operation allowlistテストを追加する
- AgentCore用OpenAPI schemaとバックエンド実ルートの同期テストを追加する
- AgentCore Gateway CDK synthテストを維持・拡張する
- 拡張のclientToolsまたはMCP接続経路のテストを追加する。仮想 `/mcp/tools/...` パスを使う場合は、実Gatewayで成立することを統合テストで確認する
- 実AWS/AgentCore/ElevenLabs接続の手動検証手順を作成する

---

## 4. スコープ

### IN

- AgentCore Gatewayを本命とするMCP公開の完成
- OpenAPIスキーマ整備と二重管理ギャップの解消
- 既存APIの音声向けMCPツール化
- `@Claude` タスク実行依頼ツールの要件化と実装計画化
- AgentCore GatewayからHono APIへの認証経路整理
- ElevenLabs Agentからの実接続検証
- Security Baseline準拠

### OUT

- Slack上のClaudeが実行した成果物の品質保証
- Claude実行結果の自動監視・完了判定
- Chrome Web Store公開
- Property-Based Testing Extensionの導入
- AgentCore以外の独立Node MCPサーバーを本命にする構成

---

## 5. セキュリティ要件対応

Security Baselineは有効。Requirements Analysis時点の適用状況は以下。

| Rule | 状態 | 理由 |
|------|------|------|
| SECURITY-01 | Applicable | OpenAPI schema bucket、既存DynamoDB/Secrets Managerが対象。暗号化とTLSが必要 |
| SECURITY-02 | Blocking Gap | API Gatewayログ確認に加え、AgentCore Gateway経路のアクセスログ/監査の扱いを設計で明確化する必要がある |
| SECURITY-03 | Applicable | MCPツール呼び出しの構造化ログと機密情報マスクが必要 |
| SECURITY-04 | N/A | 今回の主対象はAPI/MCPでありHTML-serving endpoint追加は予定しない |
| SECURITY-05 | Applicable | 全MCPツール入力にZod/OpenAPI validationが必要 |
| SECURITY-06 | Applicable | Gateway role / execute-api権限は最小権限必須。API単位のwildcardはHTTP API全ルート許可が必要なため設計で例外根拠を維持する |
| SECURITY-07 | N/A | 新規VPC/SG変更は予定しない |
| SECURITY-08 | Blocking Gap | AgentCore IAM経路とHono JWT認可の不整合を解消し、ユーザー別タスク/Slack/Googleリソースの認可を保証する必要がある |
| SECURITY-09 | Applicable | エラー応答で内部詳細・トークンを露出しない |
| SECURITY-10 | Applicable | lockfile維持、依存追加時の固定と監査が必要 |
| SECURITY-11 | Applicable | 副作用ツールの承認、rate limiting、misuse考慮が必要 |
| SECURITY-12 | Applicable | Cognito認証とトークン管理を維持する |
| SECURITY-13 | Applicable | OpenAPIスキーマ/重要データ変更の監査性が必要 |
| SECURITY-14 | Applicable | 認証/認可失敗、Slack送信失敗の監視が必要 |

**Blocking Findings**:

- SECURITY-02: AgentCore Gateway経路のアクセスログ/監査要件が設計未確定。
- SECURITY-08: AgentCore GatewayのIAM呼び出し経路と、Hono/API GatewayのCognito JWT認可維持が現状不整合。Application Designで解消するまで実装開始不可。

---

## 6. トレーサビリティ

| User Answer | 反映先 |
|-------------|--------|
| Q1: B | FR-V3-01 |
| Q2: D | FR-V3-02 |
| Q3: C | NFR-V3-S1 |
| Q4: X | FR-V3-04 |
| Q5: A | セキュリティ要件対応 |
| Q6: C | NFR-V3-T1 / OUT |
| Q7: D | NFR-V3-R1 / NFR-V3-T1 |

---

## 7. 次フェーズ判定

User Storiesは実施する。理由は以下。

- 音声Agentからのユーザー操作フローが変わる
- `@Claude` メンションによるタスク実行依頼という新しいユーザージャーニーが追加される
- Human-in-the-loop承認と副作用ツールの境界をユーザー視点で明確化する必要がある

Application DesignとUnits Generationも実施候補とする。理由は、`pkgs/cdk`、`pkgs/backend`、`pkgs/extension`、OpenAPI schema、実接続手順にまたがる複数パッケージ変更が想定されるため。

---

## 8. 見直し結果サマリ

初版要件は方向性として妥当だったが、実コード照合により次の補正が必要と判定した。

- 「MCP化未実装」ではなく、「AgentCore/CDKと限定OpenAPIスキーマは存在するが、実API全体・認証経路・実MCP呼び出し検証が未完成」と表現する。
- `VITE_AGENTCORE_GATEWAY_URL` へGateway URLを入れるだけでは、拡張側の `/mcp/tools/...` REST呼び出しが実MCPとして成立する保証はない。
- 最大リスクは、AgentCore Gateway Targetの `GATEWAY_IAM_ROLE` と、API GatewayメインルートのCognito JWT Authorizerの不整合。
- `@Claude` 委譲は完全新規API/ツールとして扱う。
- Google文脈取得は既存APIがあるが、AgentCore用OpenAPIスキーマに未収載。
- v3のApplication Designでは、認証経路、MCPツールallowlist、OpenAPI同期方式、ElevenLabs Agent設定方式を先に確定する。
