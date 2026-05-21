# NFR Requirements — U-03b: sabori-proposer

**Unit**: U-03b: sabori-proposer
**ステージ**: CONSTRUCTION / NFR Requirements
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. NFR 一覧

| ID | カテゴリ | 要件 | 測定基準 | 優先度 |
|----|---------|------|---------|--------|
| NFR-P1 | パフォーマンス | SSE 初回チャンク到達 < 3 秒（ウォーム Lambda） | p95 latency | 必須 |
| NFR-P2 | パフォーマンス | propose() 全体完了 < 10 秒（ウォーム）/ < 15 秒（コールドスタート） | p99 latency | 必須 |
| NFR-P3 | パフォーマンス | Bedrock Phase 2（Sonnet）maxTokens = 1024 固定 | コード固定値 | 必須 |
| NFR-P4 | パフォーマンス | Bedrock Phase 3（Haiku）maxTokens = 256 固定 | コード固定値 | 必須 |
| NFR-S1 | セキュリティ | rawSummary（Slack 生データ）はメモリ使用後に変数スコープを抜け即 GC 対象化 | コードレビュー | 必須 |
| NFR-S2 | セキュリティ | DynamoDB Proposals テーブルに rawSummary / Slack 本文を保存しない | ユニットテスト | 必須 |
| NFR-S3 | セキュリティ | Slack OAuth トークンは Secrets Manager から取得（ContextCollector キャッシュ再利用） | コードレビュー | 必須 |
| NFR-S4 | セキュリティ | Bedrock Tool Use 出力を Zod で検証（untrusted output として扱う） | ユニットテスト | 必須 |
| NFR-R1 | 信頼性 | Bedrock ThrottlingException: adaptive retry maxAttempts=5 | BedrockClientAdapter | 必須 |
| NFR-R2 | 信頼性 | Slack API タイムアウト（>10s）は null 返却し、slackContext なしで続行 | ユニットテスト | 必須 |
| NFR-R3 | 信頼性 | PersonaRenderer 失敗時は rawChatMessage を fallback として使用 | ユニットテスト | 必須 |
| NFR-R4 | 信頼性 | DynamoDB ConditionalCheckFailed（重複保存）は警告ログのみ（冪等性保証） | ユニットテスト | 必須 |
| NFR-C1 | コスト | Phase 2 に Claude Sonnet（高精度判定）、Phase 3 に Claude Haiku（低コスト口調変換）を使い分け | コード設定 | 推奨 |
| NFR-C2 | コスト | tokenCount を Proposal に記録し CloudWatch でコスト追跡を可能にする | 実装確認 | 推奨 |
| NFR-T1 | テスト容易性 | MockBedrockClient 経由でテスト（実 Bedrock 呼び出しなし） | テスト実装 | 必須 |
| NFR-T2 | テスト容易性 | MockDynamoDocClient 経由でテスト（実 DynamoDB 呼び出しなし） | テスト実装 | 必須 |
| NFR-O1 | 可観測性 | 全 Lambda 操作で構造化 JSON ログ出力（既存 logger.ts 使用） | コードレビュー | 必須 |
| NFR-O2 | 可観測性 | proposalId / taskId / verdict / durationMs を常にログ出力 | コードレビュー | 必須 |
| NFR-O3 | 可観測性 | X-Ray トレース（U-02 AgentStack 設定済み） | インフラ設定確認 | 推奨 |

---

## 2. パフォーマンス要件の詳細

### 2.1 SSE 初回チャンク到達 < 3 秒

- Phase 2（Bedrock converse）は Claude Sonnet を使用するため平均 3〜5 秒かかる。
- **SSE ストリーミングでは converseStream を使い、最初の contentBlockDelta を受け取り次第即時 yield することで 3 秒以内を実現する。**
- Phase 3（PersonaRenderer）はストリーム完了後に Haiku で非同期実行。

### 2.2 maxTokens 固定

| フェーズ | モデル | maxTokens | 理由 |
|---------|-------|-----------|------|
| Phase 2（判定） | Claude Sonnet 3.5 | 1024 | reasoning 5件 + rawChatMessage 150文字 + summaryText 60文字 + metadata に十分 |
| Phase 3（口調変換） | Claude Haiku 3 | 256 | summaryText 60文字 + chatMessage 150文字のみ |

---

## 3. セキュリティ要件の詳細

### 3.1 rawSummary の生存スコープ制限（NFR-S1）

```typescript
// OK: SlackContext.rawSummary は collectSlackContext() のスコープ内のみで使用
async function collectSlackContext(params): Promise<SlackContext> {
  const rawSummary = messageTexts  // ← この関数スコープで生成
  return { ..., rawSummary }       // ← SlackContext に含まれる
}

// assembleContextNarrative() で使用後、SlackContext オブジェクト自体がスコープを抜けると GC 対象
const narrative = assembleContextNarrative({ task, slackContext })
// slackContext の参照がなくなれば rawSummary も GC 対象
```

### 3.2 Bedrock モデル ID 選定理由（NFR-C1）

| 用途 | モデル ID | 理由 |
|------|----------|------|
| Phase 2（判定） | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | 文脈読解・多因子判定に十分な精度が必要 |
| Phase 3（口調変換） | `anthropic.claude-haiku-3-5-20241022-v1:0` | 単純な口調変換は Haiku で十分。低レイテンシ・低コスト優先 |

---

## 4. 信頼性要件の詳細

### 4.1 Slack タイムアウト処理（NFR-R2）

- Slack API 呼び出しに 10 秒タイムアウトを設定
- タイムアウト時は `slackContext = undefined` として propose() を続行
- `contextCoverage` は `'minimal'` となり、LLM に情報不足を伝える

### 4.2 PersonaRenderer フォールバック（NFR-R3）

```typescript
try {
  const rendered = await personaRenderer.render({ ... })
  // rendered を使用
} catch (err) {
  logWarn({ action: 'persona_render_fallback', err })
  // rawChatMessage をそのまま chatMessage として使用
  chatMessage = judgment.rawChatMessage
  summaryText = judgment.summaryText
}
```

---

## 5. テスト容易性要件の詳細

### 5.1 MockBedrockClient（NFR-T1）

U-03a で実装済みの `MockBedrockClient` パターンを再利用する。

```typescript
// src/bedrock/__tests__/MockBedrockClient.ts（U-03a 実装済みを拡張）
export class MockBedrockClient implements IBedrockClient {
  async converse(input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    return this.converseResponses.shift() ?? defaultConverseResponse()
  }
  async converseStream(input: ConverseStreamCommandInput): Promise<ConverseStreamCommandOutput> {
    return this.streamResponses.shift() ?? defaultStreamResponse()
  }
}
```

### 5.2 テストカバレッジ目標

| ファイル | ステートメント | ブランチ |
|---------|-------------|---------|
| SaboriProposerAgent.ts | 95%+ | 85%+ |
| PersonaRenderer.ts | 95%+ | 85%+ |
| contextUtils.ts | 100% | 100% |
| DynamoProposalRepository.ts | 95%+ | 80%+ |
| saboriJudgmentTool.ts | 100% | N/A |
| types.ts | N/A（型定義のみ） | N/A |
| **全体** | **95%+** | **80%+** |

---

## 6. Well-Architected フレームワーク準拠（全 6 本柱）

| 柱 | 評価 | 対応状況 |
|----|------|---------|
| 運用上の卓越性 | 必須 | 構造化 JSON ログ・X-Ray トレース（U-02設定済み） |
| セキュリティ | 必須 | 最小権限 IAM・Secrets Manager・生データ非保存（NFR-S1〜S4） |
| 信頼性 | 必須 | adaptive retry・タイムアウト処理・fallback（NFR-R1〜R4） |
| パフォーマンス効率 | 必須 | maxTokens 固定・Haiku/Sonnet 使い分け・SSE ストリーミング（NFR-P1〜P4） |
| コスト最適化 | 推奨 | tokenCount 記録・Haiku 活用・ARM64（U-02設定済み）（NFR-C1〜C2） |
| 持続可能性 | 推奨 | ARM64（Graviton2、U-02設定済み）・不要データ非保存（NFR-S1〜S2） |
