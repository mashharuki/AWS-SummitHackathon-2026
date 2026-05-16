# Unit of Work 定義書 — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-09
**バージョン**: 1.2.0
**更新日**: 2026-05-16（AgentCore廃止→converse API + Tool Use / Slack単独化 / Three.js MVPスコープイン / U-03c優先度見直し）
**ステータス**: 承認済み（予選向け確定版）
**対象イベント**: AWS Summit Japan 2026 ハッカソン（予選: 2026-05-30）
**設計深度**: Comprehensive

---

## メタ情報

| 項目 | 内容 |
|------|------|
| 生成ステージ | INCEPTION - Units Generation |
| 参照成果物 | application-design.md / components.md / requirements.md / user-stories.md |
| Unit 総数 | 7（U-01, U-02, U-03a, U-03c, U-03b, U-04, U-05）★v1.1.0 で U-03c 追加 |
| 実装方針 | モノレポ（packages/ + apps/ + infra/）|
| 依存順序 | shared → infra → task-extractor → task-organizer → sabori-proposer → api → web |

---

## 1. Unit 一覧サマリ

| Unit ID | Unit 名 | 責務（1行） | 依存 Unit | 規模 | 優先度 |
|---------|---------|-----------|----------|------|--------|
| U-01 | shared | 全 Unit が共有する型定義・バリデーション・ユーティリティの提供 | なし | S | 最高 |
| U-02 | infra | AWS CDK による全インフラリソースのプロビジョニング | U-01 | M | 高 |
| U-03a | task-extractor | Bedrock converse API + Tool Use を用いたタスク抽出エージェントの実装（AgentCore 不使用） | U-01, U-02 | M | 高 |
| U-03c | task-organizer | タスク依存関係・手順最適化・サボり余地スコア計算エージェントの実装 ★v1.1.0 | U-01, U-02, U-03a | M | **低（v1.1.0）** |
| U-03b | sabori-proposer | Bedrock converse API + Tool Use によるサボり提案・口調変換・再評価エージェントの実装（人格A/B対応）| U-01, U-02, U-03a | M | 高 |
| U-04 | api | Hono on Lambda による REST API + Webhook ハンドラの実装 | U-01, U-02, U-03a, U-03c, U-03b | L | 高 |
| U-05 | web | React + shadcn/ui によるフロントエンド全画面の実装 | U-01, U-04 | M | 中 |

---

## 2. Unit 間依存関係図

```mermaid
graph TD
    U01["U-01: shared<br/>型定義・バリデーション・ユーティリティ"]
    U02["U-02: infra<br/>CDK スタック群（AWS リソース）"]
    U03A["U-03a: task-extractor<br/>タスク抽出エージェント"]
    U03C["U-03c: task-organizer<br/>タスク整理エージェント★新規"]
    U03B["U-03b: sabori-proposer<br/>サボり提案エージェント"]
    U04["U-04: api<br/>Hono REST API + Webhook"]
    U05["U-05: web<br/>React フロントエンド"]

    U01 --> U02
    U01 --> U03A
    U01 --> U03C
    U01 --> U03B
    U01 --> U04
    U01 --> U05
    U02 --> U03A
    U02 --> U03C
    U02 --> U03B
    U02 --> U04
    U03A --> U03C
    U03C --> U03B
    U03A --> U04
    U03C --> U04
    U03B --> U04
    U04 --> U05

    style U01 fill:#E8F5E9,stroke:#2E7D32
    style U02 fill:#FBE9E7,stroke:#BF360C
    style U03A fill:#FFF8E1,stroke:#F57F17
    style U03C fill:#FFF3E0,stroke:#E65100
    style U03B fill:#FFF8E1,stroke:#F57F17
    style U04 fill:#E3F2FD,stroke:#1565C0
    style U05 fill:#F3E5F5,stroke:#6A1B9A
```

### テキスト代替表現

```
レイヤー 0（依存元なし）:
  U-01: shared ─────────────────────────────────────→ 全 Unit が参照

レイヤー 1（U-01 のみ依存）:
  U-02: infra ← U-01

レイヤー 2（U-01 + U-02 依存）:
  U-03a: task-extractor ← U-01, U-02

レイヤー 3（U-01 + U-02 + U-03a 依存）★v1.1.0 追加:
  U-03c: task-organizer ← U-01, U-02, U-03a

レイヤー 4（U-01 + U-02 + U-03a + U-03c 依存）:
  U-03b: sabori-proposer ← U-01, U-02, U-03a, U-03c

レイヤー 5（U-01 + U-02 + U-03a + U-03c + U-03b 依存）:
  U-04: api ← U-01, U-02, U-03a, U-03c, U-03b

レイヤー 6（U-01 + U-04 依存）:
  U-05: web ← U-01, U-04（型契約のみ使用）

実装順序: U-01 → U-02 → U-03a → U-03c → U-03b → U-04 → U-05
並行可能: U-03a 完了後、U-03c の実装を開始。U-03c 完了後に U-03b の実装開始
```

---

## 3. 各 Unit 詳細

---

### U-01: shared（共通基盤）

**Unit ID**: U-01
**Unit 名**: shared
**ディレクトリ**: `packages/shared/`
**規模**: S（Small）
**推定工数**: 2〜3時間

#### 責務

全 Unit が依存する共通の型定義・バリデーションスキーマ・ユーティリティを提供する単一責任 Unit。循環依存の防止のため、他 Unit には依存しない。

#### 含まれるコンポーネント

| コンポーネント | 内容 |
|-------------|------|
| TypeScript 型定義 | `Task` / `TaskCandidate` / `Proposal` / `HonneData` / `Persona` / `User` / `ServiceConnection` / `Verdict` / `QuickReplyType` |
| Zod スキーマ | 全エンティティの入力バリデーションスキーマ |
| DynamoDB リポジトリインタフェース | `ITaskRepository` / `IProposalRepository` / `IHonneRepository` / `IUserRepository` |
| エラークラス | `BedrockTimeoutError` / `TokenExpiredError` / `DynamoWriteFailedError` / `BedrockCostExceededError` |
| ユーティリティ | `generateUlid()` / `toIsoString()` / `guardTokenLimit()` / `pseudonymize()` |
| 定数 | `VERDICT_TYPE` / `SOURCE_TYPE` / `SERVICE_TYPE` / `MAX_TOKEN_LIMIT` |

#### 対応する FR / NFR / Story

| 対応 | 内容 |
|------|------|
| FR | FR-01〜FR-08（全機能要件の型基盤を提供） |
| NFR | NFR-07（仮名化ユーティリティ）/ NFR-06（トークン制限定数） |
| Story | US-01〜US-17（全ストーリーの共通型を提供） |

#### 入力（依存）

なし（ベース層 — 他 Unit には依存しない）

#### 出力（提供）

- TypeScript 型定義（全 Unit が `import type { Task, Proposal, ... } from '@saborou/shared'` で参照）
- Zod バリデーションスキーマ（U-04 api が入力検証に使用）
- リポジトリインタフェース（U-04 api が実装する契約）
- エラークラス（U-03 agent / U-04 api がスロー・補足する）
- ユーティリティ関数（U-03 / U-04 が呼び出す）

#### 使用 AWS サービス

なし（ビジネスロジックなし・AWS SDK 不使用）

#### 想定実装ステップ（Construction 各ステージ）

| ステージ | 担当内容 |
|---------|---------|
| Functional Design | 型ヒエラルキー確定・Zod スキーマ設計・エラークラス階層設計 |
| NFR Requirements | なし（U-01 に NFR 要件なし — スキップ可） |
| NFR Design | なし（スキップ） |
| Infrastructure Design | なし（AWS リソースなし — スキップ可） |
| Code Generation | `types/index.ts` / `schemas/index.ts` / `errors/index.ts` / `utils/index.ts` / `constants/index.ts` / `package.json` / `tsconfig.json` 生成 + 単体テスト |

#### 完了条件（Definition of Done）

- [ ] TypeScript コンパイルエラーなし（`tsc --noEmit`）
- [ ] ESLint / Prettier 通過
- [ ] 全型定義に JSDoc コメントあり
- [ ] Zod スキーマに対する単体テスト（Vitest）作成済み
- [ ] エラークラスのインスタンス確認テスト作成済み
- [ ] `package.json` に `@saborou/shared` パッケージ名設定済み
- [ ] 他 Unit からの `import` が正常に解決されること（ workspace 設定確認）

---

### U-02: infra（AWSインフラ）

**Unit ID**: U-02
**Unit 名**: infra
**ディレクトリ**: `infra/`
**規模**: M（Medium）
**推定工数**: 4〜6時間

#### 責務

AWS CDK v2（TypeScript）による全インフラリソースのプロビジョニング。6つの Stack として構成し、IAM 最小権限・暗号化・コスト最適化を Infrastructure as Code で表現する。

#### 含まれるコンポーネント

| コンポーネント（INF-ID） | 内容 |
|----------------------|------|
| INF-01: CognitoStack | User Pool + App Client + Google ソーシャル IdP / Hosted UI 設定 |
| INF-02: DataStack | DynamoDB 全テーブル（Users / ServiceConnections / TaskCandidates / Tasks / Proposals / HonneData / Personas）+ GSI + TTL 設定 |
| INF-03: ApiStack | API Gateway HTTP API + Hono Lambda + Cognito JWT オーソライザー + Lambda 環境変数注入 |
| INF-04: AgentStack | Bedrock AgentCore エージェント定義 + TaskExtractorAgent Lambda + SaboriProposerAgent Lambda + BackgroundRefreshHandler Lambda |
| INF-05: FrontendStack | S3 バケット（静的ホスティング）+ CloudFront ディストリビューション（OAC 設定）|
| INF-06: WebhookStack | Webhook Lambda + EventBridge カスタムバス + EventBridge Scheduler（定期再評価）|
| IAM ロール群 | 各 Lambda に最小権限ポリシーを個別付与 |
| Secrets Manager 参照 | Slack / Google OAuth トークン格納先定義 |
| CloudWatch アラート | Bedrock コスト監視（$50/月アラート）|

#### 対応する FR / NFR / Story

| 対応 | 内容 |
|------|------|
| FR | FR-01〜FR-08（全機能の実行環境を提供） |
| NFR | NFR-03（可用性）/ NFR-04（CloudFront CDN）/ NFR-06（Bedrock コスト監視）/ NFR-07（Secrets Manager）/ NFR-11（IAM 最小権限・暗号化） |
| Story | 全 Story（インフラが全機能の前提） |

#### 入力（依存）

- U-01 shared: 型定義（Lambda コードのインポート時に参照。CDK コード自体は型に直接依存しない）

#### 出力（提供）

- 全 AWS リソース（ARN / エンドポイント URL を CloudFormation Output として出力）
- 各 Lambda 関数 ARN（U-03 agent / U-04 api がデプロイ先として使用）
- DynamoDB テーブル名（U-03 / U-04 が環境変数経由で参照）
- API Gateway URL（U-05 web の `VITE_API_BASE_URL` に設定）
- CloudFront URL（U-05 web の配信元）

#### 使用 AWS サービス

Cognito / DynamoDB / Lambda / API Gateway HTTP API / S3 / CloudFront / EventBridge / Secrets Manager / Bedrock（AgentCore）/ CloudWatch / IAM

#### 想定実装ステップ（Construction 各ステージ）

| ステージ | 担当内容 |
|---------|---------|
| Functional Design | なし（インフラ Unit は Functional Design スキップ可） |
| NFR Requirements | コスト上限・可用性要件・セキュリティ要件のインフラ側反映を確認 |
| NFR Design | cdk-nag による Well-Architected チェック設計 / CloudWatch アラート設計 |
| Infrastructure Design | スタック分割戦略確定 / スタック間 Cross-Reference 設計 / デプロイ順序定義 |
| Code Generation | `bin/app.ts` / `lib/stacks/*.ts`（6スタック）/ `cdk.json` / `tsconfig.json` / `package.json` / スナップショットテスト生成 |

#### 完了条件（Definition of Done）

- [ ] `npx cdk synth` が全スタックでエラーなく完了
- [ ] `npx cdk diff` が正常動作
- [ ] cdk-nag による Well-Architected チェック通過（WARNING 以上ゼロ）
- [ ] CDK スナップショットテスト（Jest）作成済み
- [ ] 全スタックに `cdk.Tags.of(this).add('Project', 'saborou')` 付与
- [ ] `RemovalPolicy.DESTROY`（dev）/ `RemovalPolicy.RETAIN`（prod）を環境変数で切替
- [ ] `cdk.context.json` が git にコミット済み

---

### U-03a: task-extractor（タスク抽出エージェント）

**Unit ID**: U-03a
**Unit 名**: task-extractor
**ディレクトリ**: `packages/agent/`
**規模**: M（Medium）
**推定工数**: 4〜6時間

#### 責務

**Bedrock converse API + Tool Use** を用いたタスク抽出フローの実装（AgentCore 不使用）。Slack 由来イベントを構造化タスク候補へ変換する AG-01 を中心に、`IBedrockClient` インタフェースによる抽象化ラッパーと TaskExtractor Lambda ハンドラを提供する。将来の AgentCore 移行は `IBedrockClient` 実装を差し替えるだけで対応可能。

#### 含まれるコンポーネント

| コンポーネント（AG-ID） | 内容 |
|----------------------|------|
| AG-01: TaskExtractorAgent | Slack メッセージ → 構造化タスク候補変換。**converse API + Tool Use**（定義済み tool: `extract_task_candidates`）。プロンプト最適化（3,000 トークン以内） |
| IBedrockClient インタフェース | Bedrock クライアントの抽象化レイヤー。`ConverseBedrockClient`（実装クラス）を注入。将来の AgentCore 移行に対応 |
| Lambda ハンドラ | TaskExtractorAgent Lambda エントリポイント |

#### 対応する FR / NFR / Story

| 対応 | 内容 |
|------|------|
| FR | FR-01（タスク自動抽出）|
| NFR | NFR-01（タスク抽出10秒以内）/ NFR-06（Bedrock 月次コスト $50）|
| Story | US-01, US-02, US-03（タスク自動抽出）|

#### 入力（依存）

- U-01 shared: `Task` / `TaskCandidate` / `Proposal` / `Verdict` 型 / `guardTokenLimit()` / `pseudonymize()` / `BedrockTimeoutError`
- U-02 infra: Bedrock AgentCore エンドポイント / Lambda 実行ロール ARN（環境変数）/ DynamoDB テーブル名（環境変数）/ Secrets Manager ARN（環境変数）

#### 出力（提供）

- `extractTasks(event: SlackEvent): Promise<TaskCandidate[]>` — TaskExtractorAgent Lambda エクスポート

#### 使用 AWS サービス

Lambda / **Bedrock converse API**（Tool Use 使用）/ DynamoDB / Secrets Manager / EventBridge（受信トリガー）

#### 想定実装ステップ（Construction 各ステージ）

| ステージ | 担当内容 |
|---------|---------|
| Functional Design | タスク抽出プロンプト設計 / `extract_task_candidates` Tool 定義 / タスク候補スキーマ設計 |
| NFR Requirements | 抽出遅延（ウォームアップ10秒・コールドスタート15秒）/ トークン制限ガード / 月次コスト上限 |
| NFR Design | IBedrockClient インタフェース設計 / 失敗時リトライ戦略 / Cold Start 対策 |
| Infrastructure Design | TaskExtractor Lambda メモリ・タイムアウト設定（60秒）/ Lambda Function URL（SSE用） |
| Code Generation | `src/agents/task-extractor.ts` / `src/bedrock/client.ts`（IBedrockClient + ConverseBedrockClient）/ TaskExtractor Lambda ハンドラ / Vitest 単体テスト |

#### 完了条件（Definition of Done）

- [ ] TypeScript コンパイルエラーなし
- [ ] `guardTokenLimit()` によるプロンプトトリム動作確認済み
- [ ] converse API + Tool Use が正常動作（Slack メッセージ → TaskCandidate[] 変換）
- [ ] IBedrockClient インタフェース経由で実装が差し替え可能な設計になっている
- [ ] Vitest カバレッジ 70% 以上（ビジネスロジック部分）

---

### U-03c: task-organizer（タスク整理エージェント）★v1.1.0 スコープ — 予選スコープ外

**Unit ID**: U-03c
**Unit 名**: task-organizer
**ディレクトリ**: `packages/agent/`
**規模**: M（Medium）
**推定工数**: 3〜5時間（v1.1.0 以降に実施）

> **重要（v1.2.0）**: 本 Unit は requirements.md の FR-01b（SHOULD、v1.1.0 スコープ）に対応する。予選（M2: 2026-05-30）スコープ外。決勝（M3: 2026-06-26）に向けた実装対象。優先度を「高」から「**低（v1.1.0）**」に修正。

#### 責務

TaskExtractorAgent（U-03a）が収集した生タスクリストを受け取り、タスク間の依存関係・実行手順・優先順位を整理・構造化する中間エージェント。「どの順番でタスクを処理すれば最も長くサボれるか」を計算し、SaboriProposerAgent（U-03b）に精度向上のためのコンテキストとして引き渡す。**v1.0.0 MVP では U-03b が U-03c なしで直接動作する**（U-03c の出力は任意入力として設計）。

#### 含まれるコンポーネント

| コンポーネント（AG-ID） | 内容 |
|----------------------|------|
| AG-05: TaskOrganizerAgent | タスク候補リスト → 依存関係グラフ・推奨実行順序・サボり余地スコア（0〜100）の計算。Bedrock AgentCore 使用 |
| Lambda ハンドラ | TaskOrganizerAgent Lambda エントリポイント |

#### 対応する FR / NFR / Story

| 対応 | 内容 |
|------|------|
| FR | FR-01b（タスク構造化・手順整理）|
| NFR | NFR-01（タスク整理30秒以内）/ NFR-06（Bedrock 月次コスト $50 内）|
| Story | US-01, US-02, US-03（タスク自動抽出パイプライン内）|

#### 入力（依存）

- U-01 shared: `TaskCandidate` / `OrganizedTaskPlan` 型 / `guardTokenLimit()` / `BedrockTimeoutError`
- U-02 infra: Bedrock AgentCore エンドポイント / Lambda 実行ロール ARN（環境変数）/ DynamoDB テーブル名（環境変数）
- U-03a task-extractor: TaskExtractorAgent Lambda の出力（TaskCandidate[]）/ Bedrock AgentCore SDK ラッパー（再利用）

#### 出力（提供）

- `organizeTask(candidates: TaskCandidate[]): Promise<OrganizedTaskPlan[]>` — TaskOrganizerAgent Lambda エクスポート
- U-03b sabori-proposer へ: 整理済みタスクプラン（依存関係・実行順序・サボり余地スコア）

#### 使用 AWS サービス

Lambda / Bedrock AgentCore / Bedrock InvokeModel（フォールバック）/ DynamoDB / EventBridge（受信トリガー・送信）

#### 想定実装ステップ（Construction 各ステージ）

| ステージ | 担当内容 |
|---------|---------|
| Functional Design | タスク依存関係分析プロンプト設計 / OrganizedTaskPlan スキーマ設計 / サボり余地スコア算出ロジック |
| NFR Requirements | 整理遅延30秒以内 / トークン制限ガード / 月次コスト |
| NFR Design | Bedrock フォールバック制御 / 失敗時のグレースフルデグラデーション（整理なしで U-03b に渡す）|
| Infrastructure Design | TaskOrganizer Lambda メモリ・タイムアウト設定 / DynamoDB TaskOrganization テーブル追加 |
| Code Generation | `src/agents/task-organizer.ts` / TaskOrganizer Lambda ハンドラ / Vitest 単体テスト |

#### 完了条件（Definition of Done）

- [ ] TypeScript コンパイルエラーなし
- [ ] Bedrock フォールバック（AgentCore → InvokeModel）が正常動作
- [ ] `OrganizedTaskPlan` に `dependsOn` / `recommendedOrder` / `saboruMarginScore` / `parallelTasks` が含まれる
- [ ] タスク整理エラー時にグレースフルデグラデーション（空のプラン）で U-03b に引き渡せる
- [ ] Vitest カバレッジ 70% 以上（ビジネスロジック部分）

---

### U-03b: sabori-proposer（サボり提案エージェント）

**Unit ID**: U-03b
**Unit 名**: sabori-proposer
**ディレクトリ**: `packages/agent/`
**規模**: M（Medium）
**推定工数**: 5〜7時間

#### 責務

サボり提案フローの実装。**Bedrock converse API + Tool Use**（AgentCore 不使用）を使用し、ContextCollector（AG-04）で Slack 文脈を収集し、SaboriProposerAgent（AG-02）が verdict と reasoning を生成、PersonaRenderer（AG-03）が人格A/B の口調へ変換する。**Lambda Response Streaming（Function URL）** による SSE 配信を担当する。BackgroundRefresh による再評価も担当する。v1.0.0 では U-03c（task-organizer）なしで直接動作する。

#### 含まれるコンポーネント

| コンポーネント（AG-ID） | 内容 |
|----------------------|------|
| AG-02: SaboriProposerAgent | 承認済みタスク + Slack コンテキスト統合 → `can_saboru` / `caution` / `danger` 判定 + reasoning 生成。**converse API + Tool Use**（`evaluate_sabori_context` tool 定義）。**Lambda Response Streaming** によるSSE対応 |
| AG-03: PersonaRenderer | 人格A（saboru_ottori: おっとりサボロー）/ 人格B（saboru_nekkyou: 熱血サボロー）の口調変換。Personas テーブルからテンプレートを取得し verdict を会話文に変換。MVP は人格A固定 |
| AG-04: ContextCollector | Slack API を呼び出しチャンネル文脈を収集（最大10秒タイムアウト）。生データを即削除（NFR-07）。v1.1.0 以降で Gmail / Calendar を追加 |
| Lambda ハンドラ | SaboriProposerAgent Lambda エントリポイント（Function URL で SSE）/ BackgroundRefreshHandler Lambda エントリポイント |

#### 対応する FR / NFR / Story

| 対応 | 内容 |
|------|------|
| FR | FR-03（サボり提案生成）/ FR-04（バックグラウンド再評価）|
| NFR | NFR-02（サボり提案10〜20秒 + SSE）/ NFR-06（Bedrock 月次コスト $50）/ NFR-07（生データ不保持）|
| Story | US-08, US-09, US-11, US-15, US-17 |

#### 入力（依存）

- U-01 shared: `Task` / `Proposal` / `Verdict` / `OrganizedTaskPlan` 型 / `guardTokenLimit()` / `pseudonymize()` / `BedrockTimeoutError`
- U-02 infra: Bedrock AgentCore エンドポイント / Lambda 実行ロール ARN（環境変数）/ DynamoDB テーブル名（環境変数）/ Secrets Manager ARN（環境変数）
- U-03a task-extractor: Bedrock AgentCore SDK ラッパー（`src/bedrock/client.ts` を再利用）
- U-03c task-organizer: 整理済みタスクプラン（`OrganizedTaskPlan[]`）— EventBridge 経由またはDynamoDB経由で受け取る

#### 出力（提供）

- `propose(taskId: string, context: AgentContext): AsyncIterable<ProposalDelta>` — SaboriProposerAgent Lambda エクスポート（SSE ストリーミング対応）
- `refreshExpiredProposals(): Promise<void>` — BackgroundRefreshHandler Lambda エクスポート

#### 使用 AWS サービス

Lambda（**Function URL でSSE配信**）/ **Bedrock converse API**（Tool Use 使用）/ DynamoDB / Secrets Manager / EventBridge（Scheduler）

#### 想定実装ステップ（Construction 各ステージ）

| ステージ | 担当内容 |
|---------|---------|
| Functional Design | サボり判定ロジック3状態の詳細設計 / `evaluate_sabori_context` Tool 定義 / next_check_at 計算ルール / プロンプトテンプレート設計 |
| NFR Requirements | Bedrock レイテンシ要件 / Lambda Response Streaming 設計 / 生データ削除タイミング / 月次コスト上限 |
| NFR Design | Lambda Function URL 設定 / API Gateway 29秒制限回避策 / converse Streaming 実装方針 |
| Infrastructure Design | SaboriProposer Function URL 設定 / BackgroundRefresh Lambda タイムアウト設定 |
| Code Generation | `src/agents/sabori-proposer.ts` / `src/renderer/persona-renderer.ts` / `src/collector/context-collector.ts` / Lambda ハンドラ 2本 / Vitest 単体テスト |

#### 完了条件（Definition of Done）

- [ ] TypeScript コンパイルエラーなし
- [ ] Slack コンテキスト収集が10秒タイムアウト内で完了
- [ ] 生データ削除（Lambda メモリからの即時解放）をコードレビューで確認
- [ ] Lambda Response Streaming（Function URL）による SSE 配信が正常動作
- [ ] converse API + Tool Use による判定ロジックが正常動作
- [ ] IBedrockClient インタフェース経由で実装が差し替え可能な設計になっている
- [ ] Vitest カバレッジ 70% 以上（ビジネスロジック部分）
- [ ] プロンプトテンプレートがバージョン管理されている（Personas テーブル初期データ）

---

### U-04: api（バックエンドAPI）

**Unit ID**: U-04
**Unit 名**: api
**ディレクトリ**: `apps/api/`
**規模**: L（Large）
**推定工数**: 8〜12時間

#### 責務

Hono フレームワーク（on Lambda）による REST API + Webhook ハンドラの実装。Cognito JWT 検証ミドルウェア・DynamoDB Repository 実装・SSE（Server-Sent Events）ストリーミング・Vercel Chat SDK による Slack Webhook 処理・統一エラーハンドリングを含む。

#### 含まれるコンポーネント

| コンポーネント（BE-ID） | 内容 |
|----------------------|------|
| BE-01: AuthHandler | Cognito JWT 検証ミドルウェア（`aws-jwt-verify` 使用）。全認証要求ルートに適用 |
| BE-02: TaskHandler | `GET /api/tasks` / `POST /api/tasks` / `GET /api/tasks/:id` / `PATCH /api/tasks/:id` / `DELETE /api/tasks/:id` / `POST /api/tasks/candidates/:id/approve` |
| BE-03: ProposalHandler | `GET /api/tasks/:id/proposal`（SSE ストリーミング）。SaboriProposerAgent Lambda を invoke し delta event をフォワード |
| BE-04: HonneHandler | `POST /api/tasks/:id/honne`。PersonaRenderer を呼び出してサボローの返答を生成 |
| BE-05: ConnectionHandler | `GET /api/connections` / `POST /api/connections/slack/callback` / `POST /api/connections/google/callback` / `DELETE /api/connections/:service` |
| BE-06: WebhookHandler | `POST /webhooks/slack`（Vercel Chat SDK による Slack Signing Secret 署名検証 → EventBridge PutEvents）|
| DynamoDB Repository 実装 | `ITaskRepository` / `IProposalRepository` / `IHonneRepository` / `IUserRepository` を実装するクラス群 |
| 統一エラーハンドリング | Hono ミドルウェアとして実装。`BedrockTimeoutError` → 503 / `TokenExpiredError` → 401 / `DynamoWriteFailedError` → 500 + リトライ |
| Lambda エントリポイント | `@hono/aws-lambda` アダプタ経由でのハンドラ定義 |

#### 対応する FR / NFR / Story

| 対応 | 内容 |
|------|------|
| FR | FR-01〜FR-08（全機能要件のHTTP契約を実装） |
| NFR | NFR-02（SSE ストリーミング）/ NFR-03（API Gateway スロットリング）/ NFR-04（HTTPS 必須）/ NFR-05（本音データ永続化）/ NFR-07（JWT + Signing Secret 検証）/ NFR-08（インライン編集）|
| Story | US-04〜US-17（ほぼ全ストーリーがAPI層を経由） |

#### 入力（依存）

- U-01 shared: 全型定義 / Zod スキーマ / IRepository インタフェース / エラークラス
- U-02 infra: DynamoDB テーブル名 / API Gateway 設定（環境変数）/ Secrets Manager ARN
- U-03a task-extractor: `extractTasks()` Lambda ARN（Lambda SDK 経由で invoke）
- U-03b sabori-proposer: `propose()` Lambda ARN（Lambda SDK 経由で invoke）

#### 出力（提供）

- HTTP エンドポイント 14本（U-05 web の APIClient が呼び出す）
- SSE ストリーム（`GET /api/tasks/:id/proposal`）
- Webhook 受信エンドポイント（Slack Events API が呼び出す）

#### 使用 AWS サービス

Lambda / API Gateway HTTP API / DynamoDB / Secrets Manager / EventBridge / Cognito（JWT 検証）

#### 使用技術

| カテゴリ | 技術 | 用途 |
|---------|------|------|
| フレームワーク | Hono | Lambda 上の軽量 Web フレームワーク |
| 認証検証 | aws-jwt-verify | Cognito JWT トークン検証 |
| Lambda アダプタ | @hono/aws-lambda | Hono を Lambda ハンドラとして実行 |
| チャットSDK | Vercel Chat SDK（chat） | Slack Webhook 受信・署名検証・メッセージパース |
| データアクセス | AWS SDK for JavaScript v3 | DynamoDB / Secrets Manager / EventBridge へのアクセス |

#### 想定実装ステップ（Construction 各ステージ）

| ステージ | 担当内容 |
|---------|---------|
| Functional Design | 全エンドポイントのリクエスト/レスポンス型詳細設計 / SSE プロトコル設計 / エラーコード定義 / タスク承認フロー設計 |
| NFR Requirements | JWT 検証パフォーマンス / SSE タイムアウト設定 / DynamoDB リトライ戦略 / CORS 設定 |
| NFR Design | Hono ミドルウェアスタック設計 / Lambda コールドスタート対策（Provisioned Concurrency）/ 統一エラーレスポンス形式 |
| Infrastructure Design | ApiStack との整合（infra Unit と協調）/ Lambda メモリ・タイムアウト設定 / CORS Origin 設定 |
| Code Generation | `src/app.ts`（Hono アプリ定義）/ `src/routes/*.ts`（6ハンドラ）/ `src/repositories/*.ts`（4リポジトリ実装）/ `src/middleware/*.ts`（認証・エラー）/ Lambda エントリポイント / Vitest 統合テスト（DynamoDB ローカル使用）|

#### 完了条件（Definition of Done）

- [ ] TypeScript コンパイルエラーなし
- [ ] ESLint / Prettier 通過
- [ ] 全 14 エンドポイントに対する統合テスト作成済み（DynamoDB Local 使用）
- [ ] JWT 検証ミドルウェアの単体テスト（有効トークン / 期限切れ / 不正トークン）
- [ ] Slack Signing Secret 検証の単体テスト
- [ ] SSE ストリーミングの動作確認（curl / EventSource）
- [ ] Vitest カバレッジ 70% 以上
- [ ] `hono/cors` による CORS 設定確認（CloudFront ドメインのみ許可）

---

### U-05: web（フロントエンド）

**Unit ID**: U-05
**Unit 名**: web
**ディレクトリ**: `apps/web/`
**規模**: M（Medium）
**推定工数**: 8〜12時間（Three.js実装追加により増加）

#### 責務

React 18 + Vite + shadcn/ui + Tailwind CSS によるフロントエンド全画面の実装。Cognito Hosted UI 経由の Google ログイン・SSE による提案のリアルタイム表示・タスク操作 UI を含む。**@react-three/fiber / drei / postprocessing / uikit を使ったサボローキャラクターの3D演出**（ラスベガス決勝での差別化要素）を M2 MVP スコープとして含む。S3 + CloudFront でホスティングされる SPA。

#### 含まれるコンポーネント

| コンポーネント（FE-ID） | 内容 |
|----------------------|------|
| FE-01: TaskListPage | タスク候補（pending）/ 承認済みタスク（approved）の2セクション表示。承認・編集・削除・手動追加 |
| FE-02: TaskDetailPage | 左ペイン（サボり判定 + 判断材料）/ 右ペイン（サボローチャット + クイック返信 + 自由入力）。SSE によるリアルタイム表示 |
| FE-03: LoginPage | Google ログインボタン（Cognito Hosted UI リダイレクト）|
| FE-04: SettingsPage | Slack / Gmail / Google Calendar 連携管理（接続・解除）|
| FE-05: AppShell | 認証ガード / グローバルナビゲーション / レイアウト |
| FE-06: AuthProvider | Cognito JWT の取得・保持・リフレッシュ。React Context で全コンポーネントに提供 |
| FE-07: APIClient | REST API 呼び出し集約（TanStack Query）/ SSE 受信（EventSource）/ エラーハンドリング |
| FE-08: TaskCard | タスクカード表示コンポーネント（verdict 3状態の色分け）|
| **FE-09: SaborouCharacter3D** | **@react-three/fiber / drei を使ったサボローキャラクターの3Dアニメーション表示。M2 MVP スコープ（ラスベガス差別化要素）** |

#### 対応する FR / NFR / Story

| 対応 | 内容 |
|------|------|
| FR | FR-02（タスク管理 UI）/ FR-03（サボり提案 UI）/ FR-05（本音入力 UI）/ FR-06（サボり判定バッジ）/ FR-07（OAuth 連携 UI）/ FR-08（インライン編集）|
| NFR | NFR-04（CloudFront CDN）/ NFR-09（おっとりサボローキャラクター UI）/ NFR-10（シンプル・清潔感デザイン）|
| Story | US-04（ログイン）/ US-05〜US-07（タスク管理）/ US-08〜US-12（サボり提案閲覧）/ US-13〜US-15（本音入力）/ US-16（インライン編集）/ US-17（手動タスク追加）|

#### 入力（依存）

- U-01 shared: `Task` / `Proposal` / `HonneData` / `Verdict` 型（フロントエンド用型定義として利用）
- U-04 api: HTTP エンドポイント 14本（APIClient 経由）/ SSE ストリーム

#### 出力（提供）

- React SPA 成果物（`dist/` ディレクトリ）→ S3 + CloudFront でホスティング
- ユーザーインタフェース（審査員が操作するデモ画面）

#### 使用 AWS サービス

S3（静的ホスティング）/ CloudFront（CDN + OAC）/ Cognito Hosted UI（認証リダイレクト）

#### 想定実装ステップ（Construction 各ステージ）

| ステージ | 担当内容 |
|---------|---------|
| Functional Design | 画面遷移フロー / 状態管理（TanStack Query のキー設計）/ SSE 受信処理設計 / クイック返信 UI 仕様 / **3Dシーン構成（Canvas・カメラ・照明・サボローモデル）設計** |
| NFR Requirements | Core Web Vitals 目標値 / バンドルサイズ上限 / アクセシビリティ基準 / **Three.js バンドルサイズ対策** |
| NFR Design | コード分割（React.lazy + dynamic import for Three.js）/ 画像最適化 / shadcn/ui テーマカスタマイズ |
| Infrastructure Design | Vite ビルド設定（`VITE_API_BASE_URL` 環境変数）/ S3 デプロイスクリプト / CloudFront キャッシュ無効化 |
| Code Generation | `src/pages/*.tsx`（4画面）/ `src/components/*.tsx`（AppShell / TaskCard）/ **`src/components/SaborouCharacter3D.tsx`（Three.js キャラクター）** / `src/providers/AuthProvider.tsx` / `src/lib/api-client.ts` / `vite.config.ts` / Vitest + Testing Library コンポーネントテスト |

#### 完了条件（Definition of Done）

- [ ] `vite build` エラーなし
- [ ] ESLint / Prettier 通過
- [ ] TypeScript 型エラーなし
- [ ] TaskListPage / TaskDetailPage のコンポーネントテスト作成済み
- [ ] SSE 受信の動作確認（サボり提案がリアルタイムで流れる）
- [ ] Cognito Hosted UI のリダイレクト動作確認
- [ ] レスポンシブデザイン確認（SP / PC）
- [ ] サボり判定3状態の色分け UI 確認（黄 / 白 / 赤みがかり）
- [ ] `VITE_API_BASE_URL` が環境変数から正しく読み込まれる
- [ ] **Three.js / @react-three/fiber によるサボローキャラクター3D表示が動作する**
- [ ] **Three.js のバンドルサイズが動的インポートにより初期ロードに影響しないことを確認**

---

## 4. 実装スケジュール（マイルストーンマトリクス）

### マイルストーン定義

| ID | マイルストーン | 日付 | 目標 |
|----|-------------|------|------|
| M1 | 書類審査 | 2026-05-10 | Inception 全成果物提出 |
| M2 | MVP デモ（予選）| 2026-05-30 | 動作する MVP（コア機能） |
| M3 | 決勝 | 2026-06-26 | AWS デプロイ済み完成品 |

### Unit × マイルストーン マトリクス

| Unit | M1（5/10）| M2（5/30）| M3（6/26）|
|------|-----------|-----------|-----------|
| U-01: shared | 設計書完成（Inception）| 実装完了・テスト完了 | 変更なし（安定） |
| U-02: infra | 設計書完成（Inception）| dev 環境デプロイ完了 | prod 環境デプロイ完了 |
| U-03a: task-extractor | 設計書完成（Inception）| TaskExtractorAgent MVP 動作 | 抽出品質改善・フォールバック最適化 |
| U-03c: task-organizer | 設計書完成（Inception）★新規 | TaskOrganizerAgent MVP 動作（基本的な依存関係分析）| サボり余地スコア精度向上・並行タスク検出強化 |
| U-03b: sabori-proposer | 設計書完成（Inception）| SaboriProposerAgent + PersonaRenderer MVP 動作（人格A固定）| 人格B追加・A/Bテスト基盤 + BackgroundRefresh 完成 |
| U-04: api | 設計書完成（Inception）| コア 10 エンドポイント動作（認証・タスク・提案）| 全 14 エンドポイント完成・統合テスト完了 |
| U-05: web | 設計書完成（Inception）| TaskList / TaskDetail / Login 画面 MVP 動作 | 全4画面完成・CloudFront 公開 |

### M2 MVP スコープ（5/30 デモで動くもの）

```
必須（MUST）:
  - Google ログイン（Cognito Hosted UI）
  - タスク候補の承認・表示（手動追加含む）
  - サボり提案生成・SSE ストリーミング表示
  - サボり判定3状態の色分け UI
  - サボローのクイック返信

条件付き（SHOULD）:
  - Slack Webhook 受信（タスク自動抽出）
  - Gmail / Calendar 連携
  - バックグラウンド再評価（EventBridge Scheduler）
```

---

## 5. リスクと緩和策

| Unit | リスク | 深刻度 | 緩和策 |
|------|--------|--------|--------|
| U-02: infra | Bedrock AgentCore が ap-northeast-1 で GA でない可能性 | 高 | InvokeModel のみで先行実装。AgentCore は後続で追加 |
| U-03a: task-extractor | 抽出プロンプト調整に時間がかかる | 中 | 入力テンプレートを固定化し、抽出対象を必須項目に限定 |
| U-03c: task-organizer | 依存関係分析プロンプトの精度が低い場合、整理結果が不正確になる | 中 | M2 では簡易的な優先順位付けのみ実装。グレースフルデグラデーション（整理失敗時は空プランで U-03b に渡す）を必ず実装 |
| U-03b: sabori-proposer | サボり提案ロジック調整に時間がかかる | 高 | M2 では判定ロジックを簡略化し、段階的に精度向上 |
| U-03b: sabori-proposer | Bedrock コスト上振れ（ハッカソン期間中） | 中 | `guardTokenLimit()` でプロンプトトリム / CloudWatch $50 アラート必須 |
| U-04: api | SSE + Lambda のタイムアウト（デフォルト 29秒）| 中 | Lambda タイムアウトを 60秒に設定。API Gateway のタイムアウトは 29秒が上限なので、ストリーミングには Response Streaming（Lambda + Function URL）を検討 |
| U-04: api | DynamoDB アクセスパターンの設計漏れ | 中 | Application Design の7テーブル設計を Unit-04 Functional Design で再確認 |
| U-05: web | デザインの作り込みに時間超過 | 低 | M2 は shadcn/ui デフォルトコンポーネントを活用。ビジュアル磨きは M3 |
| 全 Unit | ハッカソン時間制約（M2 まで3週間）| 高 | U-01 → U-02 → U-03a を先行完了させ、U-03b / U-04 / U-05 を並行開発 |

---

## 6. GitHub Issue 化方針

### Issue 化の基本方針

各 Unit を GitHub Issue として登録し、プロジェクトボードで進捗管理する。

### Issue タイトル候補

| Unit | Issue タイトル |
|------|-------------|
| U-01 | `[Construction] U-01: shared — 共通型定義・バリデーション・ユーティリティ実装` |
| U-02 | `[Construction] U-02: infra — CDK v2 全スタック実装（Cognito / Data / Api / Agent / Frontend / Webhook）` |
| U-03a | `[Construction] U-03a: task-extractor — タスク抽出エージェント実装（AG-01 + Bedrock wrapper）` |
| U-03c | `[Construction] U-03c: task-organizer — タスク整理エージェント実装（AG-05 + 依存関係分析・サボり余地スコア）` |
| U-03b | `[Construction] U-03b: sabori-proposer — サボり提案エージェント実装（AG-02/03/04 + PersonaA/B + BackgroundRefresh）` |
| U-04 | `[Construction] U-04: api — Hono REST API + Webhook ハンドラ実装（14エンドポイント）` |
| U-05 | `[Construction] U-05: web — React フロントエンド全画面実装（4画面 + shadcn/ui）` |

### ラベル候補

| ラベル名 | 用途 |
|---------|------|
| `unit/shared` | U-01 関連タスク |
| `unit/infra` | U-02 関連タスク |
| `unit/task-extractor` | U-03a 関連タスク |
| `unit/task-organizer` | U-03c 関連タスク |
| `unit/sabori-proposer` | U-03b 関連タスク |
| `unit/api` | U-04 関連タスク |
| `unit/web` | U-05 関連タスク |
| `phase/construction` | Construction フェーズタスク |
| `milestone/m2-mvp` | M2 MVP スコープ |
| `milestone/m3-final` | M3 決勝スコープ |
| `priority/critical` | クリティカルパス上のタスク |

### Issue テンプレートの活用

`.github/ISSUE_TEMPLATE/unit-of-work.md` テンプレートを使用して、各 Unit Issue を登録する。
Unit の「完了条件（Definition of Done）」セクションのチェックボックスをそのまま Issue に貼り付ける。

---

## 7. モノレポ構成

本 Unit 設計に基づくリポジトリ構成は以下の通り。

```
SABOROU/
├── packages/
│   ├── shared/           ← U-01
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── schemas/
│   │   │   ├── errors/
│   │   │   ├── utils/
│   │   │   └── constants/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── agent/            ← U-03a / U-03c / U-03b
│       ├── src/
│       │   ├── agents/        ← task-extractor / task-organizer★ / sabori-proposer
│       │   ├── renderer/
│       │   ├── collector/
│       │   └── bedrock/
│       ├── handlers/
│       └── package.json
│
├── apps/
│   ├── api/              ← U-04
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── repositories/
│   │   │   └── middleware/
│   │   └── package.json
│   │
│   └── web/              ← U-05
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   ├── providers/
│       │   └── lib/
│       └── package.json
│
├── infra/                ← U-02
│   ├── bin/
│   ├── lib/
│   │   └── stacks/
│   └── package.json
│
├── package.json          ← ワークスペースルート（npm workspaces）
└── tsconfig.base.json    ← 共通 TypeScript 設定
```

---

## 8. DynamoDB アクセスパターン定義（v1.2.0 追加）

レビュー指摘（リスク6）への対応として、主要テーブルのアクセスパターンと GSI を定義する。

### 主要テーブル × アクセスパターン

| テーブル名 | PK | SK | GSI | 主なアクセスパターン |
|-----------|----|----|-----|-----------------|
| Users | `userId` | - | - | GetItem by userId（ログイン後の初回取得）|
| ServiceConnections | `userId` | `service` | - | Query by userId（連携済みサービス一覧）|
| TaskCandidates | `taskCandidateId` | - | GSI1: `userId-createdAt-index`（PK: userId, SK: createdAt） | Query by userId で承認待ちタスク一覧 / DeleteItem / PutItem（Webhook受信時）|
| Tasks（承認済み） | `taskId` | - | GSI1: `userId-status-index`（PK: userId, SK: status#createdAt） | Query by userId + status で承認済みタスク一覧 / UpdateItem（編集）/ DeleteItem |
| Proposals | `taskId` | `createdAt` | - | Query by taskId で最新提案取得 / PutItem（提案生成時）|
| HonneData | `taskId` | `createdAt` | GSI1: `userId-createdAt-index` | Query by taskId / Query by userId（将来の取扱説明書生成用）|
| Personas | `personaId` | - | - | GetItem by personaId（`saboru_ottori`）|

### GSI 設計の根拠

- **TaskCandidates GSI1**: ユーザーごとに承認待ちタスクを時系列で取得するため（FR-02）
- **Tasks GSI1**: ユーザーごとに承認済みタスクをステータスと日時でフィルタするため（FR-06 一覧表示）
- **HonneData GSI1**: 将来の取扱説明書生成でユーザー単位の本音データを集計するため（§9 将来展望）

### DynamoDB 設計方針

- PK は ULID（`generateUlid()`）を使用（時系列ソート不要な場合）
- タイムスタンプ込みの SK（例: `status#2026-05-16T00:00:00Z`）を使用してレンジクエリを効率化
- 全テーブル On-Demand（PAY_PER_REQUEST）モード
- TTL は外部ツール生データ（処理後即削除）のみ設定（NFR-07）

---

## 参照文書

| 文書 | パス |
|------|------|
| アプリケーション設計書 | `aidlc-docs/inception/application-design/application-design.md` |
| コンポーネント定義 | `aidlc-docs/inception/application-design/components.md` |
| コンポーネントメソッド | `aidlc-docs/inception/application-design/component-methods.md` |
| サービス定義 | `aidlc-docs/inception/application-design/services.md` |
| Unit 間依存関係 | `aidlc-docs/inception/units/unit-dependencies.md` |
| ストーリーマップ | `aidlc-docs/inception/units/unit-story-map.md` |
| 要件定義書 | `aidlc-docs/inception/requirements/requirements.md` |
| ユーザーストーリー | `aidlc-docs/inception/user-stories/stories.md` |

---

*本文書は Units Generation ステージの成果物です。ユーザーの承認後、CONSTRUCTION フェーズ（U-01: shared から）に進みます。*
