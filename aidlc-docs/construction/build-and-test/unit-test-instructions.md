# ユニットテスト実行手順書

## 概要

各パッケージのユニットテスト実行手順。テストフレームワークは vitest（shared/agent/backend/frontend）と jest（cdk）を使用する。

---

## パッケージ別テスト手順

### 1. @saboru/shared（共有ライブラリ）

```bash
pnpm --filter @saboru/shared test
```

テストファイル構成:
```
pkgs/shared/src/
├── utils/__tests__/
│   ├── guardTokenLimit.test.ts  (25件)
│   ├── pseudonymize.test.ts     (9件)
│   ├── generateUlid.test.ts     (6件)
│   └── datetime.test.ts         (15件)
├── errors/__tests__/
│   └── AppError.test.ts         (16件)
└── schemas/__tests__/
    └── schemas.test.ts           (22件)
```

合計: **93テスト / カバレッジ 100%（全指標）**

カバレッジレポート:
```bash
pnpm --filter @saboru/shared test  # --coverage フラグ込み
```

---

### 2. @saboru/agent（Lambda エージェント）

```bash
pnpm --filter @saboru/agent test
```

テストファイル構成:
```
pkgs/agent/src/
├── bedrock/__tests__/
│   └── BedrockClientAdapter.test.ts  (3件)
├── context-collector/__tests__/
│   └── (各コンポーネント)
├── repositories/...
├── sabori-proposer/__tests__/
│   └── (各コンポーネント)
└── task-extractor/__tests__/
    └── TaskExtractorLambdaHandler.test.ts  (5件)
```

合計: **128テスト（10ファイル）**

カバレッジ指標:
| 指標 | 結果 |
|------|------|
| Statements | 98.89% |
| Branches | 92.10% |
| Functions | 93.18% |
| Lines | 98.89% |

---

### 3. backend（API / Webhook Lambda）

```bash
# テストのみ
pnpm --filter backend test

# カバレッジあり
pnpm --filter backend test:coverage
```

テストファイル構成:
```
pkgs/backend/src/__tests__/
├── repositories/
│   ├── DynamoProposalRepository.test.ts
│   ├── DynamoServiceConnectionRepository.test.ts
│   └── DynamoTaskRepository.test.ts
└── routes/
    ├── auth-callback.test.ts
    ├── proposals.test.ts
    ├── tasks.test.ts
    └── webhooks.test.ts
```

合計: **173テスト（22ファイル）**

カバレッジ指標:
| 指標 | 結果 |
|------|------|
| Statements | 98.74% |
| Branches | 91.19% |
| Functions | 97.80% |
| Lines | 98.95% |

---

### 4. frontend（React フロントエンド）

```bash
# テストのみ
pnpm --filter frontend test

# カバレッジあり
pnpm --filter frontend test:coverage
```

テストファイル構成:
```
pkgs/frontend/src/
├── lib/__tests__/
│   ├── cognito.test.ts
│   └── utils.test.ts
└── hooks/__tests__/
    └── useReducedMotion.test.ts
```

合計: **113テスト（5ファイル）**

注意: Teardown時に `TypeError: Cannot delete property 'matchMedia'` が発生するが、
これは jsdom の matchMedia モック削除の既知問題であり、テスト結果には影響しない。

カバレッジ指標（ユニットテスト対象ファイルのみ）:
| ファイル | Statements |
|---------|-----------|
| src/lib/cognito.ts | 98.36% |
| src/lib/utils.ts | 94.11% |
| src/hooks/useReducedMotion.ts | 83.33% |

フロントエンドのコンポーネント（pages/, components/）は E2E テストで検証する。

---

### 5. cdk（AWS CDK インフラ）

```bash
cd pkgs/cdk && npm test
```

テストファイル構成:
```
pkgs/cdk/test/
├── data-stack.test.ts
├── cognito-stack.test.ts
├── api-stack.test.ts
├── agent-stack.test.ts
├── webhook-stack.test.ts
└── frontend-stack.test.ts
```

合計: **35テスト（6スイート）**

テスト種別:
- CDK Assertions ファイングレインドテスト（各スタックのリソース存在・設定確認）
- cdk-nag セキュリティルール準拠確認

---

## 全パッケージ一括テスト

```bash
# vitest 全パッケージ
pnpm --filter @saboru/shared test && \
pnpm --filter @saboru/agent test && \
pnpm --filter backend test && \
pnpm --filter frontend test

# cdk（jest）
cd pkgs/cdk && npm test
```

---

## テスト全体集計

| パッケージ | テスト数 | パス数 | 失敗数 |
|-----------|---------|-------|-------|
| @saboru/shared | 93 | 93 | 0 |
| @saboru/agent | 128 | 128 | 0 |
| backend | 173 | 173 | 0 |
| frontend | 113 | 113 | 0 |
| cdk | 35 | 35 | 0 |
| **合計** | **542** | **542** | **0** |

---

---

# v3 ユニットテスト手順（MCP Serverization — 2026-06-18）

## v3 テスト追加概要

v3 では以下の Unit でテストが追加された。各 Unit ごとの追加テストを以下に記載する。

| Unit | 主要パッケージ | v3 追加後テスト数 |
|------|-------------|----------------|
| U-V3-01 mcp-transport-auth-adapter | backend + cdk | backend: 412, CDK: 84 |
| U-V3-02 mcp-tool-registry-schema | backend + cdk | backend: 425, CDK: 89 |
| U-V3-03 slack-claude-delegation | backend + cdk | backend: 437, CDK: 89 |
| U-V3-04 elevenlabs-registration-fallback | extension + cdk | extension: 187, CDK: 90 |
| U-V3-05 real-integration-verification | 全パッケージ（検証スクリプト） | 既存テスト全通過確認 |

## v3 テスト実行手順

### backend（v3 対応）

```bash
pnpm --filter backend test
```

v3 追加テストファイル:
```
pkgs/backend/src/__tests__/
├── mcp/
│   ├── mcpTypes.test.ts               — MCP ドメイン型テスト
│   ├── cognitoIdentityResolver.test.ts — Identity 解決テスト
│   ├── auditLogger.test.ts             — 監査ログ（秘匿情報除外）テスト
│   ├── mcpPrecheck.test.ts             — fail-closed precheck テスト
│   └── mcpRoute.test.ts                — /api/mcp/tools/{toolName} ルートテスト
├── registry/
│   ├── toolRegistry.test.ts            — allowlist ツールレジストリテスト
│   ├── toolSchema.test.ts              — ツールスキーマ検証テスト
│   └── openApiDriftGate.test.ts        — OpenAPI drift 検出テスト
└── slack/
    └── slackDelegation.test.ts         — @Claude 委譲 approval gating テスト
```

期待される合計テスト数: **437** (v3 完全版)

カバレッジ確認:
```bash
pnpm --filter backend test:coverage
```

重要な検証ポイント:
- `mcpPrecheck` の fail-closed 動作（未認証リクエストが 401 を返すこと）
- `cognitoIdentityResolver` が IAM-only 呼び出しを拒否すること
- `auditLogger` がシークレット・メッセージ本文をログに含まないこと
- `slackDelegation` が approval metadata なしで Slack 投稿しないこと
- `openApiDriftGate` が allowlist 外ツールを検出すること

---

### CDK（v3 対応）

```bash
cd pkgs/cdk && npm test
```

v3 追加テストファイル:
```
pkgs/cdk/test/
├── api-stack.test.ts     — MCP アラーム / アクセスログ / McpToolsBaseUrl CfnOutput
├── agent-stack.test.ts   — AgentCore IAM スコープ制限
└── （既存スタックテストは継続）
```

期待される合計テスト数: **90** (v3 完全版)

重要な検証ポイント:
- API Gateway アクセスログが 90 日保持で設定されていること
- `McpCallsMetricFilter` が存在すること
- `McpUnauthorizedAlarm` が存在し閾値が設定されていること
- AgentCore IAM Role が `execute-api:Invoke` のみ（ワイルドカードなし）

---

### extension（v3 対応）

```bash
pnpm --filter extension test
```

v3 追加テストファイル:
```
pkgs/extension/src/__tests__/
├── lib/
│   ├── mcpFallback.test.ts      — FallbackMode 5値 / SafeDiagnosticCode / 設定ビュー（15テスト）
│   └── agentClient.test.ts      — 疑似 AgentCore パス除去 / Hono 常時呼び出し（+6テスト）
```

期待される合計テスト数: **187** (v3 完全版)

重要な検証ポイント:
- `getMcpFallbackMode()` が 5つの FallbackMode を正しく判定すること
- `getSafeConfigView()` がシークレットを含まないこと
- `agentClient` が疑似 `/mcp/tools/...` パスを呼び出さないこと

---

### agent（v3 対応）

```bash
pnpm --filter @saboru/agent test
```

v3 追加テストファイル:
```
pkgs/agent/src/__tests__/
└── slack/
    └── SlackDelegationService.test.ts — 委譲ロジック / 安全なエラーマッパー
```

期待される合計テスト数: v2 ベース + U-V3-03 追加分

---

## v3 全パッケージ一括テスト

```bash
# 全パッケージユニットテスト（v3 対応）
pnpm --filter @saboru/shared test && \
pnpm --filter @saboru/agent test && \
pnpm --filter backend test && \
pnpm --filter frontend test && \
pnpm --filter extension test && \
cd pkgs/cdk && npm test
```

あるいは package.json の verify スクリプトを使用:
```bash
pnpm run verify
# 内部で verify-build-test.sh を実行（全パッケージビルド + テスト）
```

## v3 テスト全体集計（U-V3-01〜05 完了後）

| パッケージ | v1/v2 基準 | v3 追加後 | 増加数 |
|-----------|-----------|---------|-------|
| @saboru/shared | 93 | 93 | 0（変更なし） |
| @saboru/agent | 306 | 306+ | SlackDelegation 追加分 |
| backend | 386 | 437 | +51 |
| frontend | 464 | 464 | 0（変更なし） |
| extension | 168 | 187 | +19 |
| cdk | 79 | 90 | +11 |
| **合計** | **1,496+** | **1,577+** | **+81+** |

## v3 セキュリティテスト（targeted checks）

U-V3-02 で定義された targeted security checks を実行する:

```bash
# シークレットスキャン
pnpm run verify:secret-scan
# または
bash scripts/verify-secret-scan.sh
```

期待される出力:
- 環境変数参照による設定はすべて `process.env.*` 経由であること
- ハードコードされたシークレット・トークンが 0 件であること
