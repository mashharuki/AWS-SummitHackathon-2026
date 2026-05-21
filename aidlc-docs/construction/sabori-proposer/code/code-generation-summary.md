# コード生成サマリ — U-03b: sabori-proposer

**Unit**: U-03b: sabori-proposer
**ステージ**: CONSTRUCTION / Code Generation
**実施日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. 生成・変更ファイル一覧

### 新規ファイル（pkgs/agent/src/sabori-proposer/）

| ファイル | 説明 |
|---------|------|
| `types.ts` | U-03b 固有型定義（TaskContext / SlackContext / LLMJudgment / ContextSignals / ProposalDelta / RenderInput / RenderOutput） |
| `saboriJudgmentTool.ts` | Phase 2 Bedrock Tool Use スキーマ + LLMJudgmentSchema（Zod）+ SABORI_SYSTEM_PROMPT |
| `personaRenderTool.ts` | Phase 3 Bedrock Tool Use スキーマ + RenderOutputSchema（Zod）+ SABORU_OTTORI_SYSTEM_PROMPT + VERDICT_META |
| `contextUtils.ts` | Phase 1 コンテキストアセンブリ（心理学5理論シグナル導出 / narrativeText 生成 / calcNextCheckAt） |
| `PersonaRenderer.ts` | Phase 3 Haiku 口調変換エージェント（graceful degradation fallback 付き） |
| `SaboriProposerAgent.ts` | 3フェーズ判定エンジン（propose() / proposeStream()） |
| `SaboriProposerLambdaHandler.ts` | Lambda エントリポイント（Zod バリデーション / SlackContext 収集 / 応答組み立て） |
| `__tests__/contextUtils.test.ts` | contextUtils 単体テスト（34テスト）— 心理学5理論・narrative・calcNextCheckAt |
| `__tests__/SaboriProposerAgent.test.ts` | SaboriProposerAgent 単体テスト（17テスト）— propose() / proposeStream() |
| `__tests__/PersonaRenderer.test.ts` | PersonaRenderer 単体テスト（11テスト）— 正常系 / fallback |

### 新規ファイル（pkgs/agent/src/repositories/）

| ファイル | 説明 |
|---------|------|
| `DynamoProposalRepository.ts` | IProposalRepository 実装（save() / findLatestByTaskId()）― GSI-TaskLatest 対応 |
| `__tests__/DynamoProposalRepository.test.ts` | DynamoProposalRepository 単体テスト（10テスト）— PK/SK 構築 / 冪等性 / クエリ検証 |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/bedrock/IBedrockClient.ts` | `converseStream()` メソッドを追加（SSE ストリーミング対応） |
| `src/bedrock/BedrockClientAdapter.ts` | `converseStream()` の実装を追加（ConverseStreamCommand） |
| `src/index.ts` | sabori-proposer 関連クラス・型を新規エクスポート追加 |
| `tsup.config.ts` | `sabori-proposer/SaboriProposerLambdaHandler` エントリポイント追加 |
| `pkgs/cdk/lib/stacks/agent-stack.ts` | saboriProposerFn の handler / code / timeout / memorySize / env vars / IAM 修正 |
| `pkgs/cdk/test/agent-stack.test.ts` | U-03b 仕様に合わせたテスト更新（1024MB/90s 検証追加） |

---

## 2. 主要実装ポイント

### 心理学5理論 psychSignals 導出ロジック（contextUtils.ts）

| 理論 | 文献 | 実装 |
|------|------|------|
| CEM | Karau & Williams (1993) | `determineContextCoverage()`: Slack + deadline で full/partial/minimal |
| Identifiability | Williams et al. (1981) | requesterStatus = online → high, away/offline → low |
| Sucker Effect | Kerr (1983) | requesterStatus = online → high, away/offline → low |
| SDT | Ryan & Deci (2000) | reminderCount >= 2 or urgencyKeywords > 0 → high, count=0 and no urgency → low |
| Expectancy Theory | Vroom (1964) | deadline > 24h → high, deadline < 4h → low, null → unknown |

### モデル使い分け（2フェーズ Bedrock 呼び出し）

| フェーズ | モデル | maxTokens | temperature | 用途 |
|---------|--------|-----------|-------------|------|
| Phase 2（判定） | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | 1024 | 0 | sabori_judgment Tool Use |
| Phase 3（口調変換） | `anthropic.claude-haiku-3-5-20241022-v1:0` | 256 | 0.3 | persona_render Tool Use |

### エラーハンドリング・graceful degradation

- **PersonaRenderer 失敗時**: rawChatMessage をそのまま使用（非スロー）
- **Bedrock Tool Use パース失敗**: Zod ValidationError → Lambda DLQ 転送
- **proposeStream ストリーム失敗**: 同期 converse() にフォールバック
- **DynamoDB ConditionalCheckFailed**: 既存レコードを返し警告ログのみ

---

## 3. ビルド結果

```
pkgs/agent build: ESM + CJS 両フォーマット成功
  dist/sabori-proposer/SaboriProposerLambdaHandler.cjs  1.26 MB
  dist/sabori-proposer/SaboriProposerLambdaHandler.js   1.26 MB
  dist/index.cjs / index.js                             1.28 MB
DTS ビルド成功（型定義ファイル生成）
```

---

## 4. テスト結果

### pkgs/agent（初回実装）

```
Test Files: 9 passed
Tests:      104 passed (104)

カバレッジ（新規追加分）:
  contextUtils.ts:     Statements 96.57% / Branches 93.1%
  PersonaRenderer.ts:  Statements 97%    / Branches 85.71%
  SaboriProposerAgent.ts: Statements 92% / Branches 77.77%
  DynamoProposalRepository.ts: Statements 97.83%

全体:
  Statements: 88.79%
  Branches:   85.45%
```

### pkgs/agent（カバレッジ補強後）

**追加テストケース: 24件（合計128テスト）**

追加テストファイル・内容:

| ファイル | 追加テストケース数 | 補強内容 |
|---------|-------------------|---------|
| `SaboriProposerAgent.test.ts` | +10 | proposeStream ストリームエラー経路 / non-Error throw / 不正JSON fallback / valid stream chunk / Zod validation fallback |
| `SaboriProposerLambdaHandler.test.ts` | +9（新規作成） | 400バリデーション / Slack token取得成功・失敗 / propose()呼び出し検証 / エラー伝播 |
| `DynamoProposalRepository.test.ts` | +2 | ConditionalCheck後の findByPkSk null経路（空Items / undefinedItems） |
| `contextUtils.test.ts` | +3 | deadline 4-24h ボーダーライン / reminderCount=1 externalPressure / pastDeadline narrative |
| `PersonaRenderer.test.ts` | +2 | non-Error throw fallback / VERDICT_META 不存在 verdict のデフォルト絵文字 |

```
Test Files: 10 passed（新規: SaboriProposerLambdaHandler.test.ts 追加）
Tests:      128 passed (128)

補強後カバレッジ:
  SaboriProposerAgent.ts:      Statements 100% / Branches 96.15%
  SaboriProposerLambdaHandler.ts: Statements 100% / Branches 100%
  PersonaRenderer.ts:          Statements 100% / Branches 100%
  DynamoProposalRepository.ts: Statements 100% / Branches 88.88%
  contextUtils.ts:             Statements 98.63% / Branches 95.16%

全体（pkgs/agent）:
  Statements: 98.89%（目標 95%+ 達成）
  Branches:   92.10%（目標 90%+ 達成）

残存の未カバーブランチ（到達不能コード）:
  - SaboriProposerAgent.ts L209: proposeStream parse catch の non-Error 分岐
    （JSON.parse は常に Error を throw するため実質到達不能）
  - contextUtils.ts L229-230: formatDeadlineLocal catch ブランチ
    （toLocaleString は throw しないため実質到達不能）
  - DynamoProposalRepository.ts: L125-126, L203 は DynamoTaskCandidateRepository（U-03a）のブランチ
```

### pkgs/cdk

```
Test Suites: 6 passed
Tests:       35 passed (35)（継続パス確認）
```

---

## 5. Well-Architected / aws-constraints.md 準拠確認

| 項目 | 状態 |
|------|------|
| Lambda ARM64（Graviton2） | OK（既存設定継続） |
| IAM 最小権限（grantRead/grantReadWriteData） | OK |
| Secrets Manager（secretName 利用） | OK（SLACK_TOKEN_SECRET_NAME） |
| DynamoDB PAY_PER_REQUEST | OK（U-02設定済み） |
| adaptive retry（maxAttempts=5） | OK（BedrockClientAdapter） |
| DLQ 設定 | OK（saboriProposerDlq継続） |
| tokenCount 記録（コスト追跡） | OK（Proposal.tokenCount） |
| Haiku 活用によるコスト削減 | OK（Phase 3 口調変換のみ Haiku） |
