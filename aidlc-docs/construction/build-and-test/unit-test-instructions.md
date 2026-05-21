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
