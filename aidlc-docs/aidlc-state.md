# AI-DLC 状態管理

## プロジェクト情報
- **プロジェクト名**: サボロー（AWS Summit Japan 2026 ハッカソン）
- **プロジェクトタイプ**: Brownfield（v2 スプリント: 2026-06-14 開始）
- **開始日時**: 2026-05-09T07:00:00Z
- **v2 スプリント開始**: 2026-06-14T00:00:00Z
- **現在のステージ**: `travel-itinerary-html-s3-slack` Code Generation 実装・ローカル検証完了（2026-06-21 JST）。旅行プランSlack投稿を直接Markdown本文投稿から、HTML旅のしおりS3格納 + CloudFront公開URL Slack投稿へ変更。backend 471 tests / CDK 97 tests / backend typecheck / backend build / CDK build 全パス。残: デプロイ後のCloudFront URL表示と実Slack投稿E2E確認。
- **ドキュメントバージョン**: v4.5.0（2026-06-21 旅行プランHTMLしおり公開URL Slack投稿機能 実装完了）

---

## 旅行プランHTMLしおり公開URL＋Slack投稿機能（2026-06-21）

### 実装状態
- [x] HTML itinerary renderer — 旅行プランをスタイル付きHTMLの旅のしおりへ整形。HTML escape、HTTP(S)リンクsanitize、credential-like marker redactを実施。
- [x] S3 publisher — `travel-itineraries/YYYY/MM/DD/<uuid>.html` に `text/html; charset=utf-8` としてアップロードし、CloudFront公開URLを返す。
- [x] Slack posting service — 旅行プラン本文ではなく、HTMLしおりURLをSlackへ投稿。User Token優先、Bot Token fallback、`threadTs`対応を維持。
- [x] Clarification safety — 入力不足時はS3アップロードもSlack投稿も行わない。
- [x] Infrastructure — 非公開S3 bucket、CloudFront OAC、CloudFront access logging、response security headers、90日lifecycle、Lambda env、`s3:PutObject` prefix最小権限を追加。
- [x] MCP/OpenAPI metadata — `saborou_plan_trip_and_post_to_slack` の説明をHTMLしおり公開URL投稿へ更新。
- [x] Tests — backend 471 tests、CDK 97 tests、backend typecheck、backend build、CDK build 全パス。

### 成果物
- `pkgs/backend/src/travel/travelItineraryHtml.ts`
- `pkgs/backend/src/travel/TravelItineraryPublisher.ts`
- `pkgs/backend/src/travel/TravelPlanSlackPostService.ts`
- `pkgs/backend/src/travel/schemas.ts`
- `pkgs/backend/src/config/env.ts`
- `pkgs/backend/src/index.ts`
- `pkgs/backend/src/mcp/registry.ts`
- `pkgs/backend/src/routes/mcp-jsonrpc.ts`
- `pkgs/cdk/lib/stacks/data-stack.ts`
- `pkgs/cdk/lib/stacks/api-stack.ts`
- `pkgs/cdk/schemas/saborou-openapi.yaml`
- `aidlc-docs/inception/plans/travel-itinerary-html-s3-slack-plan.md`
- `aidlc-docs/construction/travel-itinerary-html-s3-slack/code/code-generation-summary.md`

### 残作業
- [ ] CDK deploy後にCloudFront URLでHTMLしおりが表示されることを確認
- [ ] 実Slackチャンネルで `saborou_plan_trip_and_post_to_slack` approval付き実行を確認
- [ ] CloudFront/S3ログが想定通り出力されることを確認

---

## 旅行プランMarkdown整形＋Slack投稿機能（2026-06-20）

### 実装状態
- [x] Backend route — `POST /api/travel/plan-and-post-to-slack` を追加。`approved !== true` は403で拒否し、clarification時はSlack投稿しない。
- [x] Slack mrkdwn formatter — タイトル、概要、フライト、ホテル、日別アクティビティ、前提/注意点を整形。Slack特殊文字をエスケープし、credential-like markerをredactし、4000文字に制限。
- [x] Slack posting service — Slack User Token優先、Bot Token fallback、`threadTs`対応、Slack API失敗時は安全な `502 SLACK_API_ERROR`。
- [x] MCP exposure — `saborou_plan_trip_and_post_to_slack` を side-effect / approval required / implemented として registry、schema、REST adapter、JSON-RPC、OpenAPI に追加。
- [x] Tests — backend 464 tests、CDK 93 tests、backend typecheck、backend build、CDK build 全パス。

### 成果物
- `pkgs/backend/src/travel/TravelPlanSlackPostService.ts`
- `pkgs/backend/src/travel/slackMarkdown.ts`
- `pkgs/backend/src/routes/travel.ts`
- `pkgs/backend/src/mcp/registry.ts`
- `pkgs/backend/src/mcp/schemas.ts`
- `pkgs/backend/src/routes/mcp.ts`
- `pkgs/backend/src/routes/mcp-jsonrpc.ts`
- `pkgs/cdk/schemas/saborou-openapi.yaml`
- `aidlc-docs/construction/travel-plan-slack-post/code/code-generation-summary.md`

### 残作業
- [ ] デプロイ環境でSlack User Token優先投稿をE2E確認
- [ ] AgentCore Gateway経由で `saborou_plan_trip_and_post_to_slack` のapproval付き実行を確認

---

## Travelpayouts旅行プラン代行機能（2026-06-20）

### 実装状態
- [x] Backend route — `POST /api/travel/plan` を追加。認証済みユーザー向けに旅行条件からプランを返す。
- [x] Travel planning domain — `TravelPlanningService` / `TravelpayoutsClient` / fixture provider / strict Zod schemas を追加。
- [x] MCP exposure — `saborou_plan_trip` を registry / schema / JSON-RPC tools/list / REST MCP adapter / AgentCore OpenAPI schema に追加。
- [x] CDK secret wiring — `/saborou/travelpayouts/credentials-${environment}` secret、API Lambda env、read権限を追加。
- [x] Schema drift fix — 既存 published tool `saborou_find_task` の OpenAPI operation を追加。
- [x] Tests — backend 451 tests、CDK 93 tests、typecheck/build 全パス。

### 成果物
- `pkgs/backend/src/routes/travel.ts`
- `pkgs/backend/src/travel/`
- `pkgs/backend/src/__tests__/travel/TravelPlanningService.test.ts`
- `pkgs/backend/src/__tests__/routes/travel.test.ts`
- `pkgs/backend/src/__tests__/routes/mcp-jsonrpc.test.ts`
- `pkgs/cdk/schemas/saborou-openapi.yaml`
- `aidlc-docs/construction/travelpayouts-trip-planner/code/code-generation-summary.md`

### 残作業
- [ ] 実AWS環境でTravelpayouts secret JSONを設定: `apiToken`, `marker`, `trs`
- [ ] デプロイ後に既存MCP auth verification scriptを実行

---

## v3 追加開発状態（2026-06-16〜）

### INCEPTION フェーズ（v3: SABOROU MCP Serverization）
- [x] Workspace Detection — 完了（2026-06-16）。Brownfield 判定。既存v2成果物と実装を確認。
- [x] Requirements Analysis — 見直し完了（2026-06-16）。AgentCore Gateway本命、既存API全体のMCPツール化、`@Claude` タスク実行依頼フロー、実AWS/AgentCore/ElevenLabs検証を定義。Serena MCP併用の実コード照合でGAP-V3-01〜08を追加。SECURITY-02/08はApplication Designで解消必須のBlocking Gap。ユーザー承認待ち。
- [x] User Stories — 完了（2026-06-16）。3ペルソナ、9ユーザーストーリー、INVEST確認、要件/ギャップトレーサビリティを作成。ユーザー承認待ち。
- [x] Workflow Planning — 完了（2026-06-16）。高リスクの複数パッケージ変更として、Application Design / Units Generation / Functional Design / NFR Requirements / NFR Design / Infrastructure Design / Code Generation / Build and Testを実施対象に設定。ユーザー承認済み。
- [x] Application Design — 修正完了（2026-06-16）。AgentCore Gateway を入口にしつつ、既存 Hono JWT API を弱めない MCP Tool Adapter / Identity Resolver / allowlist Tool Registry / `@Claude` Slack Delegation を設計。ElevenLabs Dashboard登録制約に合わせ、MCP本線を `streamable_http` 第一候補、`sse` fallbackに修正。SECURITY-02/08 の設計上の解消方針を確定。ユーザー承認済み。
- [x] Units Generation — 完了（2026-06-16）。U-V3-01〜05の5 Unit、依存関係、実装順序、US/FR/GAP/NFRトレーサビリティを作成。ユーザー承認済み。

### CONSTRUCTION フェーズ（v3）

#### U-V3-01: mcp-transport-auth-adapter
- [x] Functional Design — 完了（2026-06-16）。MCP invocation / caller identity / tool context / authorization decision / audit event / safe error shape、既存JWTルート維持、IAMのみでuserId認可しないルール、監査ログ非機密化ルールを定義。ユーザー承認済み。
- [x] Lean Formal Verification — 完了（2026-06-17 JST）。`McpTransportAuthAdapter.lean` で IAM-only拒否、identity未解決時precheck拒否、cross-user access拒否、side-effect approval必須、audit secret/args非依存を `sorry` なしで証明。`lean` 検証成功。
- [x] NFR Requirements — 完了（2026-06-17 JST）。Security Baseline全15ルールを評価し、U-V3-01向けに認証/認可、監査ログ、fail-closed、可用性、テスト、Lean証明維持要件を定義。ユーザー承認済み。
- [x] NFR Design — 完了（2026-06-17 JST）。Verified Identity Gate、Fail-Closed Adapter Pipeline、Safe Audit Event Envelope、Route Preservation Boundary、Schema-First Adapter Input、Least-Privilege Gateway Hop、Safe Error Mapper、Lean Evidence Lock、Adapter Latency Budgetを定義。ユーザー承認済み。
- [x] Infrastructure Design — 完了（2026-06-17 JST）。既存JWT route preservation、MCP adapter route boundary、application-level Cognito JWT verification、API Gateway access logs、90日ログ保持、CloudWatch metric filters/alarms、AgentCore Gateway role scoping、CDK assertionsを設計。ユーザー承認済み。
- [x] Code Generation — 完了（2026-06-17 JST）。MCP domain types / Cognito JWT identity resolver / safe audit logger / fail-closed precheck / `/api/mcp/tools/{toolName}` route / CDK access logs・90日保持・MCP alarms・AgentCore IAM scope / tests / code summaryを生成。Backend 412 tests + typecheck、CDK 84 tests + build、Lean検証が通過。ユーザー承認済み。

#### U-V3-02: mcp-tool-registry-schema
- [x] Functional Design — 完了（2026-06-17 JST）。MCP tool allowlist、side-effect分類、approval requirements、excluded routes、schema drift report、runtime invocation model、schema publication model、`saborou_judge_sabori`意味整理を定義。ユーザー承認済み。
- [x] NFR Requirements — 完了（2026-06-17 JST）。Allowlist-only publication、schema-first validation、output data minimization、side-effect approval enforcement、schema drift prevention、registry performance、demo availability、test coverage、maintainabilityを定義。Security Baseline applicable rulesはblocking findingsなし。ユーザー承認済み。
- [x] NFR Design — 完了（2026-06-17 JST）。Registry As Policy Boundary、Schema-First Tool Invocation、Approval Metadata Gate、Safe Voice Output Envelope、Drift Detector Build Gate、Static Registry Warm-Path、Explicit Exclusion List、Legacy OperationId Migration、Reserved Tool Contractを定義。ユーザー承認済み。
- [x] Infrastructure Design — 完了（2026-06-17 JST）。既存AgentCore Stack constructsを維持し、schema artifact、S3 schema deployment、GatewayTarget、registry/schema tests、drift validation gates、`/api/mcp/tools/{toolName}` publication boundaryを設計。ユーザー承認済み。
- [x] Code Generation — 完了（2026-06-17 JST）。Registry/schema/precheck/route/OpenAPI drift gate/code summaryを生成。Backend 425 tests + typecheck、CDK 89 tests + build、targeted security checksが通過。ユーザー承認済み。

#### U-V3-03: slack-claude-delegation
- [x] Functional Design — 完了（2026-06-17 JST）。`saborou_delegate_to_claude` contract、approval gating、task ownership、delegation message、safe Slack error handling、audit boundariesを定義。ユーザー承認済み。
- [x] NFR Requirements — 完了（2026-06-17 JST）。Slack side effect、secret handling、safe logging、authorization、safe error handling、performance、reliability、testability要件とtech stack decisionsを定義。ユーザー承認済み。
- [x] NFR Design — 完了（2026-06-17 JST）。Approval-first guard、context-derived identity、schema-first input、deterministic message builder、secret-safe Slack boundary、safe error mapper、safe audit envelope、registry reserved-to-implemented transitionを定義。ユーザー承認済み。
- [x] Infrastructure Design — スキップ（2026-06-17 JST）。新規AWSリソース、IAM、env、Secrets Manager secret、queue/cache/table/API Gateway construct、network componentが不要なため。再オープン条件をdecision artifactに記録。
- [x] Code Generation — 完了（2026-06-17 JST）。SlackDelegationService、`POST /api/slack/delegations`、`saborou_delegate_to_claude` schema/registry/dispatch/OpenAPI/tests/code summaryを生成。Backend 437 tests + typecheck、CDK 89 tests + build、targeted security checksが通過。ユーザー承認済み。

#### U-V3-04: elevenlabs-registration-fallback
- [x] Functional Design — 完了（2026-06-17 JST）。ElevenLabs Dashboard remote MCP registrationをprimary pathとして定義し、`streamable_http` first、`sse` verification-only fallback、browser `clientTools` fallback/UI support、direct Hono fallback、pseudo `/mcp/tools/...` neutralization、secret-safe setup stateを設計。ユーザー承認済み。
- [x] NFR Requirements — 完了（2026-06-17 JST）。Secret-safe browser configuration、primary/fallback boundary integrity、authorization preservation、demo availability、latency/user feedback、observability/troubleshooting、maintainability、test coverage、tech stack decisionsを定義。Security Baseline applicable rulesはblocking findingsなし。ユーザー承認済み。
- [x] NFR Design — 完了・承認待ち（2026-06-17 JST）。Remote MCP primary registration、conditional SSE fallback gate、explicit fallback mode boundary、secret-safe config view、server-side authorization preservation、bounded failure and retry policy、safe diagnostic taxonomy、registry-backed setup artifact、verification handoff contractを定義。Security Baseline applicable rulesはblocking findingsなし。
- [x] Infrastructure Design — 完了・承認済み（2026-06-17 JST）。McpToolsBaseUrl CfnOutput追加、SSEブリッジ延期決定、ElevenLabs Dashboard streamable_http登録設定、フォールバックアーキテクチャ設計を実施。新規AWSリソース・IAM・ネットワーク変更なし。ユーザーBで承認済み。
- [x] Code Generation — 完了・承認済み（2026-06-17 JST）。McpToolsBaseUrl CfnOutput追加（api-stack.ts）、CDKテスト追加（+1）、mcpFallback.ts新規作成（FallbackMode5値/SafeDiagnosticCode6コード/SafeConfigView/getMcpFallbackMode/getSafeConfigView）、agentClient.ts疑似AgentCoreパス除去・Hono API常時呼び出し統一・mcpFallback再エクスポート、agentClient.test.ts更新（+6テスト）、mcpFallback.test.ts新規作成（+15テスト）、ELEVENLABS_MCP_SETUP.md新規作成（シークレット非記載）。Extension 187テスト全パス（旧168）、CDK 90テスト全パス（旧79）。ユーザーBで承認済み。

#### U-V3-05: real-integration-verification
- [x] Functional Design — スキップ（新規ドメインロジック追加なし。統合検証Unitのため）
- [x] NFR Requirements — 完了（2026-06-17 JST）。信頼性（R1〜R4）・観測性（O1〜O3）・手動E2E証拠（E1〜E4）・デモ可用性（A1〜A2）・保守性（M1〜M2）の15要件を定義。Security Baseline適用ルール確認・ブロッキングファインディングなし。ユーザー承認済み（B）。
- [x] NFR Design — 完了・承認済み（2026-06-17 JST）。Verification Evidence Pattern / Safe Script Pattern / Troubleshooting Matrix Pattern / Fallback Runbook Pattern / Demo Reset Script Pattern の5パターンと論理コンポーネント（verification-scripts/evidence-store/demo-reset/troubleshooting-matrix/demo-runbook）を定義。ユーザーBで承認済み。
- [x] Infrastructure Design — スキップ（2026-06-17 JST）。U-V3-05 は検証スクリプト・ドキュメント群のみで新規 AWS リソース・IAM・CDK変更・ネットワーク変更なし。decision artifact を作成。
- [x] Code Generation — 完了・承認済み（2026-06-17 JST）。13 ステップ全生成完了。verify-build-test.sh / verify-cdk-synth.sh / verify-agentcore.sh / verify-mcp-auth.sh / verify-cloudwatch.sh / verify-secret-scan.sh / demo-reset.sh（scripts/）/ evidence/README.md + 13サブディレクトリ / TROUBLESHOOTING.md（6サービス×3+シナリオ）/ DEMO_RUNBOOK.md（15分デモ手順書 + 3段フォールバック + Q&A）/ .gitignore 更新 / package.json verify スクリプト追加 / code-generation-summary.md 生成。全スクリプト chmod +x 済み。ユーザーBで承認済み。

#### v3 Build and Test（全 Unit 完了後）
- [x] Build and Test — 完了（2026-06-18 JST）。v3 全 5 Unit（U-V3-01〜05）対象。成果物: build-instructions.md（v3 セクション追記）/ unit-test-instructions.md（v3 セクション追記）/ integration-test-instructions.md（v3 セクション追記）/ performance-test-instructions.md（v3 セクション追記）/ build-and-test-summary.md（v3 セクション追記）。ユーザー承認済み（B）。

### Extension Configuration（v3）
| Extension | Enabled | Decided At |
|---|---|---|
| Security Baseline | Yes | Requirements Analysis |
| Property-Based Testing | No | Requirements Analysis |

### v3 成果物ディレクトリ
- `aidlc-docs/inception/v3/requirements/requirement-verification-questions.md`
- `aidlc-docs/inception/v3/requirements/requirements.md`
- `aidlc-docs/inception/v3/plans/user-stories-assessment.md`
- `aidlc-docs/inception/v3/plans/story-generation-plan.md`
- `aidlc-docs/inception/v3/plans/execution-plan.md`
- `aidlc-docs/inception/v3/plans/application-design-plan.md`
- `aidlc-docs/inception/v3/plans/unit-of-work-plan.md`
- `aidlc-docs/inception/v3/user-stories/personas.md`
- `aidlc-docs/inception/v3/user-stories/stories.md`
- `aidlc-docs/inception/v3/application-design/components.md`
- `aidlc-docs/inception/v3/application-design/component-methods.md`
- `aidlc-docs/inception/v3/application-design/services.md`
- `aidlc-docs/inception/v3/application-design/component-dependency.md`
- `aidlc-docs/inception/v3/application-design/application-design.md`
- `aidlc-docs/inception/v3/units/unit-of-work.md`
- `aidlc-docs/inception/v3/units/unit-of-work-dependency.md`
- `aidlc-docs/inception/v3/units/unit-of-work-story-map.md`
- `aidlc-docs/construction/plans/u-v3-01-mcp-transport-auth-adapter-functional-design-plan.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/functional-design/domain-entities.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/functional-design/business-rules.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/functional-design/business-logic-model.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/formal-verification/McpTransportAuthAdapter.lean`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/formal-verification/README.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/formal-verification/review.json`
- `aidlc-docs/construction/plans/u-v3-01-mcp-transport-auth-adapter-nfr-requirements-plan.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/nfr-requirements/nfr-requirements.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/nfr-requirements/tech-stack-decisions.md`
- `aidlc-docs/construction/plans/u-v3-01-mcp-transport-auth-adapter-nfr-design-plan.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/nfr-design/nfr-design-patterns.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/nfr-design/logical-components.md`
- `aidlc-docs/construction/plans/u-v3-01-mcp-transport-auth-adapter-infrastructure-design-plan.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/infrastructure-design/infrastructure-design.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/infrastructure-design/deployment-architecture.md`
- `aidlc-docs/construction/plans/u-v3-01-mcp-transport-auth-adapter-code-generation-plan.md`
- `aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/code/code-generation-summary.md`
- `aidlc-docs/construction/plans/u-v3-02-mcp-tool-registry-schema-functional-design-plan.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/functional-design/domain-entities.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/functional-design/business-rules.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/functional-design/business-logic-model.md`
- `aidlc-docs/construction/plans/u-v3-02-mcp-tool-registry-schema-nfr-requirements-plan.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/nfr-requirements/nfr-requirements.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/nfr-requirements/tech-stack-decisions.md`
- `aidlc-docs/construction/plans/u-v3-02-mcp-tool-registry-schema-nfr-design-plan.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/nfr-design/nfr-design-patterns.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/nfr-design/logical-components.md`
- `aidlc-docs/construction/plans/u-v3-02-mcp-tool-registry-schema-infrastructure-design-plan.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/infrastructure-design/infrastructure-design.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/infrastructure-design/deployment-architecture.md`
- `aidlc-docs/construction/plans/u-v3-02-mcp-tool-registry-schema-code-generation-plan.md`
- `aidlc-docs/construction/u-v3-02-mcp-tool-registry-schema/code/code-generation-summary.md`
- `aidlc-docs/construction/plans/u-v3-03-slack-claude-delegation-functional-design-plan.md`
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/functional-design/domain-entities.md`
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/functional-design/business-rules.md`
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/functional-design/business-logic-model.md`
- `aidlc-docs/construction/plans/u-v3-03-slack-claude-delegation-nfr-requirements-plan.md`
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/nfr-requirements/nfr-requirements.md`
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/nfr-requirements/tech-stack-decisions.md`
- `aidlc-docs/construction/plans/u-v3-03-slack-claude-delegation-nfr-design-plan.md`
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/nfr-design/nfr-design-patterns.md`
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/nfr-design/logical-components.md`
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/infrastructure-design/infrastructure-design-decision.md`
- `aidlc-docs/construction/plans/u-v3-03-slack-claude-delegation-code-generation-plan.md`
- `aidlc-docs/construction/u-v3-03-slack-claude-delegation/code/code-generation-summary.md`
- `aidlc-docs/construction/plans/u-v3-04-elevenlabs-registration-fallback-functional-design-plan.md`
- `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/functional-design/domain-entities.md`
- `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/functional-design/business-rules.md`
- `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/functional-design/business-logic-model.md`
- `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/functional-design/frontend-components.md`
- `aidlc-docs/construction/plans/u-v3-04-elevenlabs-registration-fallback-nfr-requirements-plan.md`
- `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/nfr-requirements/nfr-requirements.md`
- `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/nfr-requirements/tech-stack-decisions.md`
- `aidlc-docs/construction/plans/u-v3-04-elevenlabs-registration-fallback-nfr-design-plan.md`
- `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/nfr-design/nfr-design-patterns.md`
- `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/nfr-design/logical-components.md`
- `aidlc-docs/construction/plans/u-v3-04-elevenlabs-registration-fallback-infrastructure-design-plan.md`
- `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/infrastructure-design/infrastructure-design.md`
- `aidlc-docs/construction/u-v3-04-elevenlabs-registration-fallback/infrastructure-design/deployment-architecture.md`
- `aidlc-docs/construction/plans/u-v3-05-real-integration-verification-nfr-requirements-plan.md`
- `aidlc-docs/construction/u-v3-05-real-integration-verification/nfr-requirements/nfr-requirements.md`
- `aidlc-docs/construction/u-v3-05-real-integration-verification/nfr-requirements/tech-stack-decisions.md`
- `aidlc-docs/construction/plans/u-v3-05-real-integration-verification-nfr-design-plan.md`
- `aidlc-docs/construction/u-v3-05-real-integration-verification/nfr-design/nfr-design-patterns.md`
- `aidlc-docs/construction/u-v3-05-real-integration-verification/nfr-design/logical-components.md`
- `aidlc-docs/construction/u-v3-05-real-integration-verification/infrastructure-design/infrastructure-design-decision.md`
- `aidlc-docs/construction/plans/u-v3-05-real-integration-verification-code-generation-plan.md`
- `aidlc-docs/construction/u-v3-05-real-integration-verification/code/code-generation-summary.md`
- `scripts/verify-build-test.sh`（NFR-V305-R1 Critical）
- `scripts/verify-cdk-synth.sh`（NFR-V305-R2 Critical）
- `scripts/verify-agentcore.sh`（NFR-V305-R3 High）
- `scripts/verify-mcp-auth.sh`（NFR-V305-E4 Critical）
- `scripts/verify-cloudwatch.sh`（NFR-V305-O1/O2 High/Critical）
- `scripts/verify-secret-scan.sh`（NFR-V305-M2 Critical）
- `scripts/demo-reset.sh`（NFR-V305-A2 High）
- `evidence/README.md` + 13 サブディレクトリ（証拠ストア）
- `TROUBLESHOOTING.md`（6サービス×3+シナリオ NFR-V305-M1）
- `DEMO_RUNBOOK.md`（15分デモ手順書 + 3段フォールバック NFR-V305-R4/A2）

---

## v2 スプリント状態（2026-06-14〜2026-06-26）

### INCEPTION フェーズ（v2）
- [x] Workspace Detection — 完了（2026-06-14）。Brownfield 判定（v1 全 Unit 完了済み）。
- [x] Reverse Engineering — 完了（2026-06-14）。v1 流用資産サマリ作成。実コード照合済み。
- [x] Requirements Analysis — 完了（2026-06-14）。Comprehensive 深度。FR-V2-01〜11 / NFR-V2-P1〜T1 定義。Security Baseline 有効化判断。
- [x] User Stories — 完了（2026-06-14）。E-V2-01〜05 / US-V2-01〜10 / DS-V2-01（デモストーリー）作成。
- [x] Workflow Planning — 完了（2026-06-14）。execution-plan.md 作成。9 Unit 分解・タイムライン・カットライン設計。
- [x] Application Design — 完了（2026-06-14）。全体アーキテクチャ / AgentCore Gateway CDK 設計 / ElevenLabs SDK Hook 設計 / content script 設計 / シーケンス図 作成。
- [x] Units Generation — 完了（2026-06-14）。U-V2-01〜09 の 9 Unit 定義。依存関係・実装順序・v1 との関係を明記。

### CONSTRUCTION フェーズ（v2）— ✅ 完了（2026-06-15）
- [x] U-V2-01: extension-scaffold（pkgs/extension 新規）— build/tsc/test10/biome 全通過
- [x] U-V2-02: content-script（Slack DOM 監視）— slackDom/selectors/index、test144、自動入力二段構え
- [x] U-V2-03: voice-agent-hook（ElevenLabs SDK）— @11labs/client@0.2.0、useVoiceApproval、MCP/API フォールバック
- [x] U-V2-04: agentcore-gateway（AgentCore CDK スタック）— L1 CfnGateway/CfnGatewayTarget、synth成功、test9、enableAgentCore フラグ
- [x] U-V2-05: sabori-proposer-v2（SaboriProposerAgent 拡張）— SaboriProposerAgentV2(新規)、reply_draft/decline_draft、renderForVoice、v1非破壊
- [x] U-V2-06: slack-reply-endpoint（Hono 新 Route）— POST /api/slack/reply、operationId sendSlackReply
- [x] U-V2-07: progress-report（EventBridge Scheduler 追加）— POST /api/tasks/:id/report、Schedule(17:00JST/DISABLED)
- [x] U-V2-08: extension-auth（Cognito PKCE Chrome 拡張対応）— cognitoAuth(PKCE S256/getValidToken/refresh)、test45
- [x] U-V2-09: integration-and-demo（統合・検証）— 全6パッケージ約1,528テスト全パス、typecheck全0、Chrome拡張dist完全構成(icons含む)、v2-setup-and-demo-guide.md 作成
- [x] U-V2-10: chrome-notifications（追加 Unit）— タスク検知/返信完了OS通知、Side Panel抑制、保留復元、設定UI、通知クリック復帰。extension 168テスト・typecheck・Biome・build通過
- [x] Build and Test — 全パッケージ統合検証完了。v1完全非破壊(frontend464テスト維持)

**v2 Construction 成果サマリ**:
- pkgs/extension（新規）: Manifest V3 / Side Panel / content script / ElevenLabs音声 / Cognito PKCE認証 — 144テスト
- pkgs/agent: SaboriProposerAgentV2 + reply/decline draft + renderForVoice — 306テスト
- pkgs/backend: slack/reply + tasks/report エンドポイント — 386テスト
- pkgs/cdk: AgentCore Gateway(L1) + 進捗報告Schedule — 79テスト
- 外部依存（ElevenLabs Agent ID / AgentCore実デプロイ）は手順書に集約。キー登録で動作する状態
- 詳細手順: `aidlc-docs/construction/v2/v2-setup-and-demo-guide.md`

## Extension 設定（v2 で更新）
- **Security Baseline**: **有効（v2 で変更）** — Chrome 拡張・AgentCore Gateway・ElevenLabs SDK の新規攻撃面増加のため
- **Property-Based Testing**: 無効（継続）

## v2 成果物ディレクトリ
- `aidlc-docs/inception/v2/reverse-engineering/v1-asset-summary.md`
- `aidlc-docs/inception/v2/requirements/requirements.md`
- `aidlc-docs/inception/v2/user-stories/personas.md`
- `aidlc-docs/inception/v2/user-stories/user-stories.md`
- `aidlc-docs/inception/v2/plans/execution-plan.md`
- `aidlc-docs/inception/v2/application-design/application-design.md`
- `aidlc-docs/inception/v2/units/unit-of-work.md`

---

## ワークスペース状態
- **既存コード**: なし
- **リバースエンジニアリング要否**: 不要（Greenfield）
- **ワークスペースルート**: /Users/shineikikkawa/dev/hackson/AWS-SummitHackathon-2026

## コード配置ルール
- **アプリケーションコード**: ワークスペースルート（aidlc-docs/ 内には配置しない）
- **ドキュメント**: aidlc-docs/ のみ
- **構造パターン**: code-generation.md の Critical Rules を参照

## ステージ進捗

### INCEPTION フェーズ
- [x] Workspace Detection（完了: 2026-05-09T07:00:00Z）
- [x] Reverse Engineering（スキップ: Greenfield のため不要）
- [x] Requirements Analysis（完了: 2026-05-09T10:00:00Z）
- [x] User Stories（完了: 2026-05-09T12:00:00Z）
- [x] Workflow Planning（完了: 2026-05-09T13:00:00Z）
- [x] Application Design（完了: 2026-05-09T14:30:00Z）
- [x] Units Generation（完了: 2026-05-09T15:00:00Z）

### CONSTRUCTION フェーズ

#### U-01: shared
- [x] Functional Design — 完了・承認済み（2026-05-17T06:00:00Z）。domain-entities.md / business-rules.md / business-logic-model.md 生成済み。ユーザー承認取得。
- [x] NFR Requirements — 完了・承認済み（2026-05-17T08:00:00Z）。nfr-requirements.md / tech-stack-decisions.md 生成済み。品質最大化方針確定（プロダクション品質優先）。ユーザー承認（[B] Continue to Next Stage）。
- [x] NFR Design — 完了（2026-05-17T08:30:00Z）。nfr-design-patterns.md / logical-components.md 生成済み。質問なし・ファストトラック自動進行。
- [x] Infrastructure Design — スキップ（N/A: @saboru/shared はランタイムなしの純粋 TypeScript ライブラリ。AWS リソースを直接使用しないため Infrastructure Design の対象なし）
- [x] Code Generation — 完了（2026-05-17T10:15:00Z）。pkgs/shared/ 生成済み（93テスト全パス・カバレッジ100%・ESM/CJS/DTS ビルド成功）

#### U-02: infra
- [x] Functional Design — 完了（2026-05-17T11:15:00Z）。functional-design.md 生成済み。6スタック責務・Props設計・RemovalPolicy・タグ付け・CfnOutput定義。質問なしファストトラック自動進行。
- [x] NFR Requirements — 完了（2026-05-17T11:30:00Z）。nfr-requirements.md 生成済み。NFR-I1〜I6（セキュリティ/コスト/テスト/IaC再現性/可観測性/cdk-nag）定義。
- [x] NFR Design — 完了（2026-05-17T11:45:00Z）。nfr-design.md 生成済み。8設計パターン（Grant Method Chain / ARN Injection / OAC / ARM64 / CDK Assertions / Context-Based Config / CloudWatch アラーム自動生成 / AwsSolutionsChecks）定義。
- [x] Infrastructure Design — 完了（2026-05-17T12:00:00Z）。infrastructure-design.md 生成済み。6スタック詳細実装仕様・テストファイル仕様・デプロイ手順・CfnOutput 一覧・Well-Architected 6本柱準拠確認。
- [x] Code Generation — 完了（2026-05-17T15:30:00Z）。6スタック + 1コンストラクト + 6テストファイル（33テスト全パス）。cdk synth 成功（Errors=0 / cdk-nag 全Rule対応）。aidlc-docs/construction/infra/code/code-generation-summary.md 生成済み。

#### U-03a: task-extractor
- [x] Functional Design — 完了（2026-05-17T16:10:00Z）。functional-design.md 生成済み。データモデル・Tool Use スキーマ・ビジネスロジック・パッケージ構成定義。質問なしファストトラック自動進行。
- [x] NFR Requirements — 完了（2026-05-17T16:15:00Z）。nfr-requirements.md 生成済み。性能・セキュリティ・信頼性・コスト・テスト容易性・可観測性 NFR 定義。
- [x] NFR Design — 完了（2026-05-17T16:20:00Z）。nfr-design.md 生成済み。8設計パターン定義（Adapter / ToolChoice強制 / Zodダブルバリデーション / 生データ破棄 / 冪等性PutItem / SecretsManagerキャッシュ / 構造化ログ / maxTokens固定）。
- [x] Infrastructure Design — 完了（2026-05-17T16:25:00Z）。infrastructure-design.md 生成済み。U-02既存リソース活用・AgentStack修正点特定（code パス / SLACK_TOKEN_SECRET_NAME / grantRead追加）。
- [x] Code Generation — 完了（2026-05-17T01:50:00Z UTC）。pkgs/agent 新規作成（32テスト全パス・カバレッジ Statements 98.36% / Branches 84.21% / Functions 90.9%）。pkgs/cdk既存33テスト継続パス確認。AgentStack修正完了。

#### U-03b: sabori-proposer
- [x] Functional Design — 完了（2026-05-17T03:10:00Z）。functional-design.md 生成済み。3フェーズ設計・Tool Use スキーマ・心理学5理論シグナル・SSE ストリーミング設計・IBedrockClient 拡張定義。質問なしファストトラック自動進行。
- [x] NFR Requirements — 完了（2026-05-17T03:15:00Z）。nfr-requirements.md 生成済み。NFR-P1〜P4（パフォーマンス）/S1〜S4（セキュリティ）/R1〜R4（信頼性）/C1〜C2（コスト）/T1〜T2（テスト容易性）/O1〜O3（可観測性）全19件定義。
- [x] NFR Design — 完了（2026-05-17T03:20:00Z）。nfr-design.md 生成済み。10設計パターン定義（IBedrockClient拡張/ToolChoice強制/Zodダブルバリデーション/rawSummaryスコープ制限/DynamoDB冪等性/SecretsManagerキャッシュ再利用/構造化ログ/maxTokens2段階/PersonaRendererフォールバック/Slack APIタイムアウト）。
- [x] Infrastructure Design — 完了（2026-05-17T03:25:00Z）。infrastructure-design.md 生成済み。AgentStack修正点特定（handler パス/codeパス/timeout=90s/memorySize=1024MB/SLACK_TOKEN_SECRET_NAME/Haiku IAM ARN追加）。
- [x] Code Generation — 完了（2026-05-17T02:20:00Z UTC）。新規10ファイル・変更6ファイル。pkgs/agentビルド成功（ESM+CJS+DTS）。104テスト全パス（Statements 88.79% / Branches 85.45%）。pkgs/cdk 35テスト全パス（agent-stack.test.ts U-03b仕様2件追加）。code-generation-summary.md 生成済み。

#### U-04: api
- [x] Functional Design — 完了（2026-05-17T05:10:00Z）。domain-entities.md / business-rules.md / business-logic-model.md 生成済み。BR-API-01〜10定義。15エンドポイント仕様・SSEフロー・Webhook受信フロー確定。質問なしファストトラック自動進行。
- [x] NFR Requirements — 完了（2026-05-17T05:15:00Z）。nfr-requirements.md / tech-stack-decisions.md 生成済み。NFR-P1〜P3/S1〜S5/R1〜R3/C1〜C2/T1〜T2/O1〜O3 全17件定義。
- [x] NFR Design — 完了（2026-05-17T05:20:00Z）。nfr-design.md 生成済み。8設計パターン定義（Hono Variables / Zod二重防衛 / Slack HMAC / Secrets Manager キャッシュ / streamSSE / エラーハンドラ / EventBridge fire-and-forget / esbuild ARM64）。
- [x] Infrastructure Design — 完了（2026-05-17T05:25:00Z）。infrastructure-design.md 生成済み。2Lambda エントリポイント構成・CDK変更点（環境変数追加・IAM権限修正）・ビルドスクリプト設計確定。
- [x] Code Generation — 完了（2026-05-17T13:07:00Z）。新規23ファイル（types/errors/middleware 3/config 2/services 2/repositories 6/routes 7/webhook-handler）・変更6ファイル（index/handler/openapi/package.json/tsconfig/vitest.config）・CDK api-stack.ts 更新。build: dist/index.js 286.7kb + dist/webhook.js 76.7kb 成功。test: 117テスト all pass（Statements 72.96% / Branches 67.06% / Functions 72.04% / Lines 72.99%）。CDK jest 35テスト継続パス。code-summary.md 生成済み。

#### U-05: web
- [x] Functional Design — 完了（2026-05-17T14:00:00Z）。domain-entities.md / business-rules.md / business-logic-model.md / frontend-components.md 生成済み。モックUI（01-login/02-tasklist/03-detail/04-settings）参照済み。質問なしファストトラック自動進行。
- [x] NFR Requirements — 完了（2026-05-17T14:10:00Z）。nfr-requirements.md / tech-stack-decisions.md 生成済み。NFR-WEB-P1〜P4/S1〜S5/R1〜R4/A1〜A2/U1〜U3/T1〜T4/O1〜O2 全20件定義。質問なしファストトラック自動進行。
- [x] NFR Design — 完了（2026-05-17T14:20:00Z）。nfr-design-patterns.md（10パターン）/ logical-components.md 生成済み。質問なしファストトラック自動進行。
- [x] Infrastructure Design — 完了（2026-05-17T14:30:00Z）。infrastructure-design.md 生成済み。環境変数定義・ビルド・デプロイ手順・CDK変更点（DistributionId追加/CORS開発許可）確定。
- [x] Code Generation — 完了（2026-05-17T14:45:00Z）。53テスト全pass / tsc エラーゼロ / vite build 成功。E2Eテストファイル作成（tests/e2e.spec.ts）。

#### 全Unit完了後
- [x] Build and Test（完了: 2026-05-17T14:20:00Z）— 542テスト全パス / E2E 5テスト全パス / Biome 0エラー / tsc 全パッケージ成功 / CONSTRUCTION フェーズ完了

#### U-06: ui-redesign
- [x] Functional Design — 完了・**改訂版**（2026-05-20T07:00:00Z）。**方針変更**: Three.js 全廃止 → **Three.js 併用 + Mid レベル仕上げ** へ。HTML 2D 世界観に「3D ヒーロー」をログイン+詳細の2箇所に局所投入する相乗効果設計に転換。成果物（7本）:
  - `ui-redesign-spec.md`（7画面構成 + 2D/3D 配置マトリクス + 既存 Three.js リメイク方針）
  - `design-tokens.md`（Tailwind 設定・CSS 変数・フォント戦略 + **11章「3Dシーン設定」追加**：マテリアル/3点ライト/Environment/ContactShadows/呼吸アニメ/verdict 連動色）
  - `component-mapping.md`（HTML vs 現フロント対応表 + Three.js 廃止撤回 → `SaborouCharacter2D`/`SaborouCharacter3D` 併存設計）
  - `migration-plan.md`（7フェーズ・Phase 3 を「Three.js リメイク Mid 仕上げ 6-8h」に変更・合計 20-29h）
  - `api-html-gap-analysis.md`（9ギャップ分析・対応方針／変更なし）
  - **新規** `2d-3d-coexistence-rules.md`（憲法6条・配置マトリクス・PRレビューチェックリスト・アンチパターン10件）
  - **新規** `character-design-sheet.md`（2D/3D 共通の顔・色・比率設計図・SVGパス・3D再現方法）
  - **ユーザー承認取得（2026-05-20T08:00:00Z）。実装開始。**
- [ ] NFR Requirements — スキップ（既存フロント NFR を流用）
- [ ] NFR Design — スキップ（既存フロント NFR を流用）
- [ ] Infrastructure Design — スキップ（フロントエンドのみ変更、インフラ変更なし）
- [x] Code Generation — **完了**（2026-05-20T08:15:00Z）。Phase 1〜7 の7フェーズ全て完了。成果物:
  - Phase 1: `index.css` を Tailwind v4 `@theme` で全面書き換え・`@utility` で card-brutal/btn-brutal-*/input-brutal 定義、`index.html` で Google Fonts プリコネクト
  - Phase 2: `SaborouCharacter2D` (HTML SVG 完全移植) / `SaborouAvatar` (チャット 28-48px 用) / `verdictMeta.ts` (VERDICT_META/VERDICT_SVG_CONFIG/QUICK_REPLY_LABELS) を新規作成、テスト 13/13 パス
  - Phase 3: `SaborouCharacter3D` (RoundedBox squircle + 雲 + 表情 + 呼吸 + verdict連動) / `SaborouScene3D` (Canvas + 3点ライト + Environment sunset + ContactShadows + Suspense/ErrorBoundary fallback に 2D) / `saboruColors.ts` を新規作成、旧 SaborouCanvas/SaborouCharacter 削除
  - Phase 4: `AppShell` 改修（max-w-md + BottomNav 組込）/ `Logo` / `PageHeader` / `BottomNav` (NavLink + safe-area-inset) / `SectionLabel` を新規作成、旧 Header 削除
  - Phase 5: `TaskCard`/`CandidateCard` (ネオブルータリズム + 2D アバター) / `VerdictBox` / `EvidenceList` / `ChatMessage` / `ChatPane` / `QuickReplyButtons` / `FreeTextInput` 改修、`PsychSignalsCard` / `ContextCollectingAnim` 新規、LoginPage (3Dヒーロー 280px) / TaskListPage (今日バナー + 2Dアバター) / TaskDetailPage (3Dヒーロー 320px + PsychSignals + ContextCollectingAnim) / SettingsPage 全面刷新
  - Phase 6: `ManualPage` (取扱説明書) / `PersonaPage` (ペルソナ選択 + localStorage 永続化) / `RoadmapPage` (タイムライン UI) 新規、`staticContent.ts` (MANUAL_TRAITS/PERSONAS/ROADMAP_ITEMS) 集約、App.tsx に /manual /settings/persona /roadmap ルート追加
  - Phase 7: 全テスト 126/126 パス / typecheck エラーゼロ / build 成功 / Three.js は別チャンク (919KB / gzip 249KB) に分離・初期バンドル 219KB / shared 103 + backend 172 + cdk 35 + frontend 126 = 全436テストパス

#### U-08: passkey-auth
- [x] Functional Design — 完了（2026-05-24T05:30:00Z）。functional-design.md 生成済み。方針: パスキー追加・パスワードフォールバック維持。コスト注記（Essentials MAU 1,000 まで無料）。ユーザー承認済み（確定方針として指示済み）。
- [x] NFR Requirements — 完了（2026-05-24T05:30:00Z）。nfr-requirements.md 生成済み。NFR-PK-S1〜S4（セキュリティ）/ P1（CDK synth）/ T1〜T2（テスト）定義。
- [ ] NFR Design — スキップ（既存 CDK NFR パターンを流用。新規パターンなし）
- [x] Infrastructure Design — 完了（2026-05-24T05:30:00Z）。infrastructure-design.md 生成済み。使用 L2 API 確認（aws-cdk-lib 2.232.1 実在確認済み）・デプロイ手順・RP ID 注意点・E2E テスト前提。
- [x] Code Generation — 完了（2026-05-24T05:30:00Z）。変更ファイル: cognito-stack.ts（featurePlan/passkey/authFlows/ManagedLogin）/ cdk.ts（passkeyRelyingPartyId注入）/ cognito-stack.test.ts（4件追加）。フロントエンド変更なし。CDK 47/47 / 全パッケージテスト維持 / CDK synth 成功。

#### U-07: google-integration
- [x] Functional Design — 完了（2026-05-24T02:00:00Z）。functional-design.md / component-design.md / sequence-diagrams.md 生成済み。データモデル（GoogleCalendarCache / ServiceConnection拡張 / enums拡張）・ビジネスロジック（BR-G-01〜06: OAuth / トークンリフレッシュ / Calendar取り込み / Gmail取り込み / SaboriProposerへのContext注入 / ナラティブ生成）・エンドポイント6件・Mermaidシーケンス図5件。ユーザー承認待ち。
- [x] NFR Requirements — 完了（2026-05-24T02:00:00Z）。nfr-requirements.md 生成済み。NFR-G-P1〜P2（パフォーマンス）/ S1〜S4（セキュリティ）/ R1〜R2（信頼性）/ C1〜C2（コスト）/ T1〜T2（テスト）/ O1（可観測性）全11件定義。ユーザー承認待ち。
- [x] NFR Design — 完了（2026-05-24T02:00:00Z）。nfr-design.md 生成済み。設計パターン10件（Slack OAuth踏襲 / SM保管スキーム / トークンリフレッシュ2段構え / Zodバリデーション / raw破棄 / SMキャッシュ / CalendarCache upsert / 構造化ログ / Google credential管理 / フロント鮮度表示）。ユーザー承認待ち。
- [x] Infrastructure Design — 完了（2026-05-24T02:00:00Z）。infrastructure-design.md 生成済み。DataStack変更（GoogleCalendarCacheTable TTL有効・GoogleClientSecret）/ ApiStack変更（環境変数3件追加・IAM権限追加）/ SSM手動設定項目・Google Cloud Console設定・CDKテスト追加点・Well-Architectedチェック。ユーザー承認待ち。
- [x] Code Generation — **完了**（2026-05-24T10:00:00Z）。U-07b（Calendar/Gmail取り込み + サボり判定連携）全実装完了。成果物:
  - `pkgs/agent`: TaskExtractorAgent汎用化（GenericExtractInput/extractTaskFromSource）、CalendarContext追加、contextUtils Calendar対応、新規テスト追加（196テスト全パス・カバレッジ100%維持）
  - `pkgs/backend`: DynamoGoogleCalendarCacheRepository新規、google.ts（POST/calendar/fetch・GET/calendar/status・POST/gmail/fetch）、proposals.tsへのCalendarContext注入
  - `pkgs/cdk`: data-stackにGoogleCalendarCacheTable追加（TTL有効）、api-stackにenv var追加、テスト43件全パス
  - `pkgs/frontend`: SettingsPage.tsxにカレンダー/Gmail取り込みボタンUI追加（連携済み時のみ表示・最終取得件数表示）
  - 全品質ゲート通過（typecheck・Biome・全テスト）

#### U-09: gamification（フロントエンドゲーミフィケーション強化・PR#23 由来。元 U-07 表記だが google-integration と番号衝突のため U-09 に振り直し）
- [ ] Functional Design — スキップ（gamification-strategy-20260523.md が要件ドキュメントとして機能）
- [ ] NFR Requirements — スキップ（既存フロント NFR を流用）
- [ ] NFR Design — スキップ（既存フロント NFR を流用）
- [ ] Infrastructure Design — スキップ（フロントエンドのみ変更、インフラ変更なし）
- [x] Code Generation — **完了**（2026-05-23T08:30:00Z）。Tier 1〜2 施策 + Tier 4 A/B 施策実装。成果物:
  - `pkgs/frontend/src/lib/gamificationUtils.ts` — 称号・フェーズ・グレード・コンボ計算ロジック
  - `pkgs/frontend/src/hooks/useSaboriGamification.ts` — ゲーミフィケーション状態管理フック
  - `pkgs/frontend/src/components/ui/DependencyScoreDisplay.tsx` — 称号表示・フェーズ色対応（育成ゲーム型 0→100）
  - `pkgs/frontend/src/components/verdict/SaboriScoreCard.tsx` — A〜Eグレード即時フィードバック
  - `pkgs/frontend/src/components/ui/GrowthJourneyBanner.tsx` — 称号解除演出 + TitleDisplayCard
  - `pkgs/frontend/src/components/ui/ComboCounter.tsx` — コンボカウンター表示
  - `pkgs/frontend/src/components/ui/JackpotOverlay.tsx` — A+ジャックポット全画面演出
  - `pkgs/frontend/src/pages/TaskDetailPage.tsx` — 全要素統合改修
  - `pkgs/frontend/src/__tests__/gamification.test.ts` — 27テスト追加（162/162 全パス）
  - ビルド成功（tsc エラーゼロ / vite build 成功）

  **Tier 2 追加実装（2026-05-23T17:50:00Z）**:
  - `pkgs/frontend/src/components/ui/SaboriStreakBadge.tsx` — 連続サボり記録（施策3）。ストリーク状態管理・3/7/14日マイルストーン・損失回避メッセージ・StreakDetailCard
  - `pkgs/frontend/src/components/ui/ManualProgressCard.tsx` — 本音取扱説明書の完成度ゲージ（施策4）。5ステージ（0/30/60/90/100%）・アニメーション増加・useManualProgress フック・ManualProgressInline
  - `pkgs/frontend/src/lib/achievementSystem.ts` — サボり実績システム（施策5）。9種実績（common/uncommon/rare/legendary）・checkNewAchievements・unlockAchievement
  - `pkgs/frontend/src/components/ui/AchievementBadge.tsx` — 実績バッジ・トースト通知・コレクション一覧（施策5）。useAchievements フック
  - `pkgs/frontend/src/hooks/useSaboriGamification.ts` — streak・manualProgress 状態・recordHonneSubmit を追加
  - `pkgs/frontend/src/__tests__/gamification-tier2.test.ts` — 49テスト追加
  - 合計テスト: 211/211 全パス / tsc エラーゼロ / vite build 成功

  **Tier 4 残施策 + Tier 5 実装（2026-05-24T01:02:00Z）**:
  - `pkgs/frontend/src/lib/soundManager.ts` — Web Audio API 音響設計（施策D）。7種SoundType（tap/scoreUp/jackpot/titleUnlock/comboUp/streakLoss/honneSend）・SoundManagerConfig・localStorage設定永続化
  - `pkgs/frontend/src/components/ui/WeeklyChallengeCard.tsx` — 週次チャレンジUI（施策E）。5種チャレンジ・週番号ローテーション・進捗バー・達成演出・localStorage永続化
  - `pkgs/frontend/src/components/ui/SeasonBanner.tsx` — シーズンテーマ表示（施策E）。12ヶ月シーズン定義・限定称号チャレンジ表示
  - `pkgs/frontend/src/components/ui/GuildMockCard.tsx` — サボりギルドUIモック（施策C-1）。メンバーリスト・アクティビティフィード・リアクションボタン・COMING SOONバッジ
  - `pkgs/frontend/src/components/ui/PvPMockCard.tsx` — PvP対決モックUI（施策C-2）。チャレンジ通知・対決内容・受諾/拒否UX・COMING SOONバッジ
  - `pkgs/frontend/src/components/OnboardingModal.tsx` — サボり適性クイズ追加（施策F）。5問クイズ・スコア計算（0〜100%）・平均比較テキスト・既存スライドと統合
  - `pkgs/frontend/src/pages/TaskListPage.tsx` — SeasonBanner・WeeklyChallengeCard 統合（施策E）
  - `pkgs/frontend/src/__tests__/gamification-tier4.test.ts` — 35テスト追加（WeeklyChallengeCard/SeasonBanner/SoundManager）
  - `pkgs/frontend/src/__tests__/gamification-tier5.test.ts` — 37テスト追加（OnboardingModal クイズ/統合テスト）
  - 合計テスト: 283/283 全パス / tsc エラーゼロ / vite build 成功

### OPERATIONS フェーズ
- [x] CDK操作ガイド（aidlc-docs/operations/cdk-operations.md）
- [x] バックエンド操作ガイド（aidlc-docs/operations/backend-operations.md）
- [x] フロントエンド操作ガイド（aidlc-docs/operations/frontend-operations.md）

### UPDATE-PLAN: 3バンドガントチャート + ゲーミフィケーション土台再編（2026-05-26〜）
- [x] 計画書作成（aidlc-docs/update-plans/update-plan-20260526-gantt-gamification.md）
- [ ] U-G01: shared-schedule-types（pkgs/shared）
- [ ] U-G02: calendar-timeslot-route（pkgs/backend）
- [ ] U-G03: schedule-planner-agent（pkgs/agent）
- [ ] U-G04: schedule-api-endpoint（pkgs/backend）
- [ ] U-G05: gantt-chart-component（pkgs/frontend）
- [ ] U-G06: gantt-game-score-logic（pkgs/frontend）
- [ ] U-G07: ui-primitives（pkgs/frontend）
- [ ] U-G08: task-detail-3pane（pkgs/frontend）
- [ ] U-G09: tests-and-integration（全pkgs）

## Extension 設定
- **Security Baseline**: 無効（Q23=B — PoC・プロトタイプ扱い。基本セキュリティは実装する）
- **Property-Based Testing**: 無効（Q24=C — シンプルな CRUD・統合レイヤーが主）

## 適用済みスキル
- **aws-well-architected**: 2026-05-16 適用 → `aidlc-docs/inception/application-design/well-architected-review.md` 生成
- **lean-formal-verification**: 2026-05-16 適用 → `execution-plan.md` §10 にクリティカルパス検証・カットライン定義を追記
- **hackathon-strategist**: 2026-05-16 参照 → 14日計画・カットラインの戦略的フレームワーク

## Execution Plan Summary（v2.0.0 — 2026-05-16 予選向け全面改訂）

- **実行計画書**: `aidlc-docs/inception/plans/execution-plan.md`（v2.0.0）
- **総合リスクレベル**: Medium（Slack単独化・converse API直接実装で新興性リスクを解消）
- **推奨実装順序**: shared → infra → task-extractor → sabori-proposer → api → web
- **実行ステージ数**: Construction 5 ステージ × 6 Unit（U-03c は v1.1.0 除外）
- **スキップステージ**: Reverse Engineering（Greenfield）/ U-03c task-organizer（予選スコープ外）/ Operations（プレースホルダー）
- **マイルストーン**:
  - M1: 書類審査（2026-05-10）— **完了（通過済み）**
  - M2: MVP デモ（2026-05-30）— 動作する MVP（Slack+Dual-Agent+Three.js）
  - M3: 決勝（2026-06-26）— AWS デプロイ済み完成品

## v1.3.0 モノレポ実装反映（2026-05-16）

**変更内容**: モノレポベース実装完了に伴う Inception ドキュメント全面更新

| 変更点 | 旧（設計書） | 新（実装） |
|--------|------------|----------|
| ワークスペースルート | `packages/`, `apps/`, `infra/` | `pkgs/` |
| フロントエンド | `apps/web/` | `pkgs/frontend/`（ベース実装済み） |
| バックエンド | `apps/api/` | `pkgs/backend/`（ベース実装済み） |
| インフラ | `infra/` | `pkgs/cdk/`（ベース実装済み） |
| 共有パッケージ | `packages/shared/` | `pkgs/shared/`（Construction で作成） |
| エージェント | `packages/agent/` | `pkgs/agent/`（Construction で作成） |
| パッケージマネージャー | npm workspaces | pnpm@10.33.0 workspaces |
| React | React 18 | React 19.2.6 |
| コード品質 | ESLint / Prettier | Biome 1.9.4 |
| Node.js | 未記載 | v23（.nvmrc） |

**更新ファイル**:
- `inception/units/unit-of-work.md`: 全ユニットのディレクトリパス・モノレポ構成ツリー更新
- `operations/README.md`: モノレポ構成・技術スタックテーブル更新
- `inception/plans/execution-plan.md`: ディレクトリ参照・実装済みパッケージ注記追加
- `inception/application-design/application-design.md`: ディレクトリ参照更新
- `operations/cdk-operations.md` / `backend-operations.md` / `frontend-operations.md`: パス・コマンド更新

---

## v1.2.1 追加クリーンアップ（2026-05-16 第3次）

コンテキスト復元後のグレップ検証で発見した残存参照を修正:
- `AG-02-sabori-proposer-agent.md`: TaskContext から gmailContext/calendarContext を削除
- `component-methods/README.md`: AG-04 依存関係図を Slack API のみに更新
- `shared-utils.md`: EXTERNAL_API_FAILED コメントを Slack のみに
- `infra-components.md`: IN-05 WebhookStack を Slack のみに
- `BE-02-task-handler.md`: FR-01 記述を Slack のみに
- `components.md`: ServiceType 型 / FE-04 責務 / INF-06 EventBridge ルールを Slack のみに
- `design-rules.md`: Gmail/Calendar エラーハンドリング / PII 保護 / レイテンシ設計を v1.0 実態に合わせ更新
- `application-design.md`: ServiceConnections SK / sourceType を v1.0 Slack のみに
- `sequence-diagrams.md`: Gmail/Calendar シーケンス全ステップを `[v1.1.0]` Mermaid コメントに変換。InvokeAgent/InvokeModel → converse API に修正
- `services.md`: exchangeGoogleToken Gmail/Calendar スコープ記述を v1.1.0 scope に移動
- `component-methods.md`: v1.2.0 廃止通知ヘッダーを追加（旧統合ファイル・実装時参照禁止）

**検証結果**: `application-design/` 配下で非意図的な Gmail/Calendar/AgentCore 参照ゼロ確認済み。

---

## v1.2.0 主要変更サマリ（2026-05-16）

| 変更 | 変更前 | 変更後 |
|------|--------|--------|
| 外部連携 | Slack / Gmail / Google Calendar | Slack のみ（他は v1.1.0）|
| エージェント実装 | Bedrock AgentCore | converse API + Tool Use（IBedrockClient インタフェース維持）|
| Three.js | README 記載のみ | M2 MVP スコープに明示（U-05 工数 6-8h → 8-12h）|
| U-03c 優先度 | 高 | 低（v1.1.0）— 予選スコープ外に移動 |
| NFR-01a レイテンシ | 10秒以内 | ウォームアップ時10秒 / コールドスタート時15秒 |
| SSE実装方式 | API Gateway | Lambda Response Streaming + Function URL |
| タイムライン | 旧（崩壊済み）| 14日詳細計画（5/16〜5/30）+ カットライン定義 |
| デプロイ計画 | 未定義 | AWSデプロイ手順・Slack設定・URL確保 追加 |

## User Stories 成果物
- **personas.md**: `aidlc-docs/inception/user-stories/personas.md`（完了）— プライマリペルソナ1名（34歳・フリーランスデザイナー）の詳細定義
- **stories.md**: `aidlc-docs/inception/user-stories/stories.md`（完了）— Epic 5件・ストーリー17件（MUST: 15 / SHOULD: 2）
- **demo-stories.md**: `aidlc-docs/inception/user-stories/demo-stories.md`（完了）— 5分デモシナリオ（審査員向け）
- **future-stories.md**: `aidlc-docs/inception/user-stories/future-stories.md`（完了）— 将来展望ストーリー4件（MVP スコープ外）
- **Epic 数**: 5（E-01〜E-05）
- **Story 数**: 17（US-01〜US-17）

## Requirements Analysis 成果物
- **requirements.md**: `aidlc-docs/inception/requirements/requirements.md`（完了・v1.1.0 更新: 2026-05-10T09:00:00Z）
- **requirement-verification-questions.md**: `aidlc-docs/inception/requirements/requirement-verification-questions.md`（完了・24問全回答）
- **FR 件数**: 9件（FR-01 / FR-01b★新規 / FR-02〜FR-08）
- **NFR 件数**: 11件（NFR-01〜NFR-11）
- **将来展望**: 追加済み（§9: ABテスト人格 / 1対Nプラットフォーム）

## 入力資料
以下のファイルが aidlc-inputs/ に配置済み:
- `README.md` - プロジェクト概要
- `00-business-brief.md` - サボロー企画書（モック反映済み）
- `01-tech-stack-decisions.md` - 技術スタック方針
- `02-development-policy.md` - 開発ポリシー
- `03-aws-architecture-policy.md` - AWSアーキテクチャ方針
- `mockups/01-task-list.png` / `02-task-detail-chat.png` / `README.md` - ビジネス側提供のUIモック

## Units Generation 成果物
- **unit-of-work.md**: `aidlc-docs/inception/units/unit-of-work.md`（完了・v1.1.0 更新: 2026-05-10T09:00:00Z）
- **unit-dependencies.md**: `aidlc-docs/inception/units/unit-dependencies.md`（完了）
- **unit-story-map.md**: `aidlc-docs/inception/units/unit-story-map.md`（完了）
- **Unit 数**: 7（U-01: shared / U-02: infra / U-03a: task-extractor / U-03c: task-organizer★新規 / U-03b: sabori-proposer / U-04: api / U-05: web）
- **実装順序**: shared → infra → task-extractor → task-organizer → sabori-proposer → api → web
- **規模**: S（U-01）/ M（U-02）/ M（U-03a）/ M（U-03c）/ M（U-03b）/ L（U-04）/ M（U-05）
- **次ステージ**: CONSTRUCTION フェーズ — U-01: shared から開始
- **INCEPTION フェーズ完了**: 2026-05-09T15:00:00Z
- **INCEPTION 文書更新（チーム追加要件）**: 2026-05-10T09:00:00Z

## Application Design 成果物
- **application-design.md**: `aidlc-docs/inception/application-design/application-design.md`（完了・v1.1.0 更新: 2026-05-10T09:00:00Z）
- **components.md**: `aidlc-docs/inception/application-design/components.md`（完了・v1.1.0 更新: AG-05追加 / PersonaRenderer人格A/B追加）
- **component-methods.md**: `aidlc-docs/inception/application-design/component-methods.md`（完了）
- **services.md**: `aidlc-docs/inception/application-design/services.md`（完了）
- **component-dependency.md**: `aidlc-docs/inception/application-design/component-dependency.md`（完了）
- **コンポーネント総数**: 25（フロントエンド: 8 / バックエンド: 6 / エージェント: 5★AG-05追加 / インフラ: 6）
- **DynamoDB テーブル数**: 8（Users / ServiceConnections / TaskCandidates / Tasks / TaskOrganization★新規 / Proposals / HonneData / Personas）
- **API エンドポイント数**: 14
- **シーケンス図数**: 7（タスク自動抽出 / サボり提案生成 / 本音データ記録 / バックグラウンド再評価 / 認証 / 外部サービス連携 / エラーハンドリング）
- **想定 Unit 数**: 7（shared → infra → task-extractor → task-organizer★新規 → sabori-proposer → api → web）

## 書類審査レビュー
- **レビュー実施日時**: 2026-05-09T16:30:00Z
- **レビュアー**: AI-DLC Specialist（aws-summit-hackathon-reviewer skill使用）
- **レビュー深度**: 包括的（Comprehensive）
- **総合評価**: B+ (3.69/5.0)
- **提出準備状況**: 要修正（3つの重大な欠陥 + 5つの改善推奨事項あり）
- **競争力評価**: 150チーム中 上位30%圏内（現状）→ 修正後は上位10%圏内を狙える
- **レビューレポート**: `aidlc-docs/review-report-20260509.md`
- **重大な欠陥**:
  1. ✅ 技術スタック変更（Vercel Chat SDK）の主要ドキュメント反映を完了（2026-05-09T18:20:00Z）
  2. ✅ AWS全体アーキテクチャ図（Mermaid）を作成済み（2026-05-09T17:30:00Z）
  3. ✅ シーケンス図を4件→7件に拡張済み（2026-05-09T17:30:00Z）
- **最優先修正項目（24時間以内）**:
  1. ✅ Vercel Chat SDK を requirements.md / application-design.md / unit-of-work.md に反映（完了: 2026-05-09T18:20:00Z）
  2. ✅ AWS全体アーキテクチャ図（Mermaid）を生成（完了: 2026-05-09T17:30:00Z）
  3. ✅ README.md にプロジェクト概要を記載（完了: 2026-05-09T18:20:00Z）
- **シーケンス図更新**: 4 → 7 に増加（認証・外部連携・エラーハンドリング追加完了）
- **次回レビュー**: 予選直前（2026-05-28）— Construction成果物の品質チェック

## AWS全体アーキテクチャ図
- **ファイル**: `aidlc-docs/inception/application-design/aws-architecture.md`（作成完了: 2026-05-09T17:30:00Z）
- **形式**: Mermaid
- **内容**: CloudFront / S3 / API Gateway / Lambda / DynamoDB / Cognito / Bedrock / Secrets Manager / EventBridge / CloudWatch の配置と関係性
- **追加情報**: 6つのCDKスタック構成・セキュリティ境界・データフロー・コスト見積り（月額$30.94）

## 特記事項
- ハッカソン書類審査締切: 2026年5月10日
- テーマ: 「人をダメにするサービス」
- AWSリージョン: ap-northeast-1（東京）
