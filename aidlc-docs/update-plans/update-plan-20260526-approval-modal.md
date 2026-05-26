# 更新計画書: タスク承認前の確認・編集モーダル（ガント精度向上）

**作成日時**: 2026-05-26T08:00:00Z
**ドキュメントバージョン**: v1.0.0
**対象ブランチ**: feature/approval-confirmation-modal（作成済み）
**関連 Unit**: 既存 Construction 完了済み全 Unit への横断改修
**ステータス**: ✅ 実装完了（2026-05-27） — 全 11 ステップ実装・全パッケージ typecheck/test/biome/build PASS。commit と実 AWS 動作確認は未実施。詳細は audit.md 参照。

---

## 1. 目的・背景

ガントチャートの精度が低下している主因は、承認時点で候補タスクの情報が曖昧なまま
SchedulePlannerAgent に渡されることにある。具体的には以下の状況が発生していた。

- `deadline` が null のまま承認 → ガント窓が不正確になる
- `description` が薄い → Bedrock のステップ分解精度が低下する
- ステップ分解がガント生成直前まで確認不可 → ユーザーが内容を把握できない

**解決策**: 「承認する」ボタン押下後にモーダルを開き、ユーザーが内容を確認・編集し
「確定して承認」することで、タスク内容を明確化してからガントを生成する。

さらに、**確定済みステップを Task に保存し、ガント生成時は Bedrock 再呼び出しを
スキップする**ことで「ユーザーが確認した内容 = ガント」を保証し、精度を最大化する。

---

## 2. 確定仕様

### A. 承認フロー
- 候補カードの「承認する」を押すと **必ず確認モーダルが開く**（即承認は廃止）
- モーダルで内容確認・編集 → 「確定して承認」でガント生成へ
- クイック承認（モーダルをスキップする方式）との併存はしない

### B. モーダルの4欄
| 欄 | 対応フィールド | 操作 |
|---|---|---|
| タスクの内容 | `title` / `description` | 編集可 |
| 締切 | `deadline`（ISO 8601） | 編集可・date input |
| やること | `plannedSteps`（後述C） | 下書き表示・編集可 |
| 誰が言っているか | `requester` / `sourceType` | 表示のみ（後述注意参照） |

**requester 表示方針**: `requester` は SHA-256 ハッシュ済みのため生表示できない。
`sourceType`（例: `slack` / `gmail`）と組み合わせて「Slack のメンバー」のような
マスク表示とする。ハッシュ値そのままは表示しない。

### C. 「やること」欄 = Bedrockステップ下書き → ユーザー編集
- モーダルを開いた瞬間に、Bedrock がステップ案を生成して「やること」欄に下書き表示する
- 既存の `SchedulePlannerAgent.runPlanPhase`（`pkgs/agent/src/schedule-planner/SchedulePlannerAgent.ts:96-166`）が行うステップ分解処理と同等のものを承認前に前倒しで呼ぶ
- 新エンドポイント `POST /tasks/candidates/:id/plan-steps` を作成し、モーダルオープン時に呼ぶ
- ユーザーがステップを手直しできる（ステップの追加・削除・ラベル編集・所要時間編集）
- 確定したステップは approve API のリクエストに含めて Task に保存する

### D. 保存方式
- `POST /tasks/candidates/:id/approve` の **リクエストボディに `overrides` を追加**する方式
- `overrides` の構成: `title` / `deadline` / `description` / `plannedSteps`（確定済みステップ配列）
- 候補を先に PATCH する方式ではない

```typescript
// approve リクエストボディ（新規）
interface ApproveOverrides {
  title?: string;
  deadline?: string | null;
  description?: string;
  plannedSteps?: ScheduleStep[]; // 確定済みステップ
}
```

### E. フル実装（精度最大化の核）
- **確定済みステップを Task に保存し、ガント生成時（`SchedulePlannerAgent.plan`）は
  `task.plannedSteps` があればフェーズ1（Bedrock 再推論）をスキップして、
  そのままフェーズ2の配置計算（`calcSchedule`）に流す**
- これにより「ユーザーが確認した内容 = ガント」が保証され精度が最大化する

---

## 3. 影響を受けるファイル一覧

### shared（型・スキーマ）
| ファイル | 変更内容 |
|---|---|
| `pkgs/shared/src/types/task.ts` | `plannedSteps?: ScheduleStep[]` フィールドを追加 |
| `pkgs/shared/src/schemas/task.ts` | `CreateTaskSchema` / `UpdateTaskSchema` に `plannedSteps` を追加。`ApproveOverridesSchema` を新規追加 |
| `pkgs/shared/src/types/index.ts` | `ApproveOverrides` 型のエクスポート追加（必要に応じて） |

### backend（API・リポジトリ）
| ファイル | 変更内容 |
|---|---|
| `pkgs/backend/src/routes/tasks.ts` | `POST /tasks/candidates/:id/approve` — `overrides` を body から受け取り `approve()` に渡す |
| `pkgs/backend/src/routes/tasks.ts` | `POST /tasks/candidates/:id/plan-steps` — 新規エンドポイント追加（Bedrock でステップ下書き生成） |
| `pkgs/backend/src/repositories/DynamoTaskCandidateRepository.ts` | `approve(userId, candidateId, overrides?)` シグネチャ変更。TransactWriteItems の Put する Task に `plannedSteps` を含める |
| `pkgs/backend/src/schemas/` | `ApproveOverridesSchema`（shared から re-export か backend 独自定義） |

### agent（SchedulePlannerAgent）
| ファイル | 変更内容 |
|---|---|
| `pkgs/agent/src/schedule-planner/SchedulePlannerAgent.ts` | `plan()` のフェーズ1に分岐追加。`task.plannedSteps` があれば `runPlanPhase()` をスキップして `plannedSteps` をそのまま `steps` として使う |

### frontend（UI・フック・APIクライアント）
| ファイル | 変更内容 |
|---|---|
| `pkgs/frontend/src/components/task/TaskApprovalModal.tsx` | **新規作成**。確認・編集モーダル本体。`TaskAddModal.tsx` の HTML `<dialog>` + フォーカストラップ + Esc パターンを流用 |
| `pkgs/frontend/src/components/task/StepEditor.tsx` | **新規作成**。「やること」欄のステップ一覧編集 UI（追加・削除・ラベル/時間編集） |
| `pkgs/frontend/src/components/task/TaskCard.tsx` | `CandidateCard` の承認ボタン `onClick` をモーダル開閉に変更（即承認廃止） |
| `pkgs/frontend/src/hooks/useTasks.ts` | `approveCandidate` を `approveWithOverrides(candidateId, overrides)` に変更。楽観的更新のシグネチャも追随 |
| `pkgs/frontend/src/lib/apiClient.ts` | `approveCandidate(candidateId)` → `approveCandidate(candidateId, overrides)` に変更。`fetchPlanSteps(candidateId)` を新規追加 |
| `pkgs/frontend/src/pages/TaskListPage.tsx` | モーダル状態管理（`openApprovalModal` / `closingCandidateId` など）の追加 |

---

## 4. 実装ステップ（チェックボックス付き）

以下の順序で実装する。型変更を最初に行い、downstream を順番に修正することで
型エラーを早期に検出できる。

### Step 1: shared — 型・スキーマ変更
- [x] `pkgs/shared/src/types/task.ts` に `plannedSteps?: ScheduleStep[]` を追加
  - `ScheduleStep` 型は `pkgs/agent/src/schedule-planner/tools.ts` で定義済み
  - shared に re-export するか、型定義を shared 側に移動するかを判断する
    （推奨: `ScheduleStep` 型を shared の `types/schedule.ts` か新ファイルに移動して
    agent / backend / frontend が共有できるようにする）
- [x] `pkgs/shared/src/schemas/task.ts` に `ApproveOverridesSchema` を追加
- [x] shared のユニットテスト更新・追加（`pkgs/shared/src/types/__tests__/`）
- [x] `pnpm -F @saboru/shared build` が通ることを確認

### Step 2: backend — リポジトリ変更
- [x] `DynamoTaskCandidateRepository.ts` の `approve()` シグネチャに `overrides?` を追加
- [x] `overrides.title / deadline / description` があれば候補値を上書きして Task を生成
- [x] `overrides.plannedSteps` があれば Task の `plannedSteps` に保存
- [x] `pkgs/backend/src/repositories/__tests__/DynamoTaskCandidateRepository.test.ts` を更新
  （overrides あり / なし の2パターン）

### Step 3: backend — approve エンドポイント変更
- [x] `routes/tasks.ts` の `POST /candidates/:id/approve` に `ApproveOverridesSchema` でのバリデーション追加
- [x] バリデーション済み overrides を `candidateRepository.approve()` に渡す
- [x] エンドポイントのテスト追加（`pkgs/backend/src/routes/__tests__/tasks.test.ts`）

### Step 4: backend — plan-steps エンドポイント新規作成
- [x] `routes/tasks.ts` に `POST /candidates/:id/plan-steps` を追加
  - 候補を取得 → `SchedulePlannerAgent.runPlanPhase(task)` 相当の Bedrock 呼び出し
  - レスポンス: `{ steps: ScheduleStep[] }`
  - 候補が存在しない場合は 404
  - Bedrock 呼び出し失敗時は 503（フロント側でモーダルは開いたままリトライ可能）
- [x] `SchedulePlannerAgent` に `generateStepDraft(task)` メソッドを切り出すか、
  既存の `runPlanPhase` を `public` にして routes から直接呼ぶかを検討
  （推奨: `generateStepDraft` として `public` メソッドを追加し、テスト容易性を確保）
- [x] テスト追加

### Step 5: agent — フェーズ1スキップ分岐
- [x] `SchedulePlannerAgent.plan()` に分岐を追加
  ```typescript
  const steps = task.plannedSteps && task.plannedSteps.length > 0
    ? task.plannedSteps   // ユーザー確認済みステップを使用（Bedrock スキップ）
    : await this.runPlanPhase(task); // 従来通り Bedrock 呼び出し
  ```
- [x] `pkgs/agent/src/schedule-planner/__tests__/SchedulePlannerAgent.test.ts` に
  `plannedSteps` あり / なし のテストを追加
- [x] `pnpm -F @saboru/agent test` が全パスすることを確認

### Step 6: frontend — APIクライアント変更
- [x] `pkgs/frontend/src/lib/apiClient.ts` の `approveCandidate()` シグネチャ変更
- [x] `fetchPlanSteps(candidateId: string): Promise<{ steps: ScheduleStep[] }>` を新規追加

### Step 7: frontend — useTasks フック変更
- [x] `approveCandidate` を `approveWithOverrides(candidateId, overrides)` にリネーム
- [x] 楽観的更新ロジックを保持しつつ overrides を POST body に含める
- [x] フックの型定義（`types/ui.ts` など）を確認・更新

### Step 8: frontend — StepEditor コンポーネント新規作成
- [x] `pkgs/frontend/src/components/task/StepEditor.tsx` を新規作成
- [x] ステップ一覧の表示・追加・削除・ラベル編集・所要時間編集 UI
- [x] ローディング状態（Bedrock 呼び出し中）の skeleton 表示
- [x] エラー状態（Bedrock 失敗時）の表示と手動入力へのフォールバック

### Step 9: frontend — TaskApprovalModal コンポーネント新規作成
- [x] `pkgs/frontend/src/components/task/TaskApprovalModal.tsx` を新規作成
- [x] `TaskAddModal.tsx` の HTML `<dialog>` + フォーカストラップ + Esc パターンを流用
- [x] 4欄フォーム実装（タスクの内容 / 締切 / やること / 誰が言っているか）
- [x] モーダルオープン時に `fetchPlanSteps()` を呼び出し、「やること」欄に下書きセット
- [x] 「確定して承認」ボタンで `approveWithOverrides()` を呼び出す
- [x] Vitest テスト追加

### Step 10: frontend — TaskCard・TaskListPage 変更
- [x] `TaskCard.tsx` の `CandidateCard` 承認ボタン `onClick` をモーダル開閉に変更
  （`onApprove` のシグネチャを `onApproveClick(candidateId)` に変更して即承認廃止）
- [x] `TaskListPage.tsx` にモーダル状態管理を追加
  （どの候補が選択中か、モーダルの開閉状態）
- [x] 既存テスト（`TaskCard.test.tsx` / `TaskListPage.test.tsx`）を更新

### Step 11: 統合テスト・最終確認
- [x] `pnpm -F @saboru/shared build && pnpm -F @saboru/backend test && pnpm -F @saboru/agent test && pnpm -F @saboru/frontend test` が全パス
- [x] MSW handlers に `POST /api/tasks/candidates/:id/plan-steps` モックを追加
- [x] フロントエンドの楽観的更新ロールバックが正しく機能することを確認
- [x] `pnpm biome check` エラー 0 を確認
- [x] `pnpm tsc --noEmit`（全パッケージ）を確認

---

## 5. 新規・変更 API 仕様

### 5-1. 既存 API 変更: POST /api/tasks/candidates/:id/approve

**変更点**: リクエストボディに `overrides` を追加（省略可）

```typescript
// Request Body（新規フィールド追加）
{
  overrides?: {
    title?: string;          // max 200
    deadline?: string | null; // ISO 8601 or null
    description?: string;    // max 1000
    plannedSteps?: Array<{
      stepId: string;        // max 30
      stepLabel: string;     // max 60
      durationMinutes: number; // int, 5-480
      bandType: "work" | "decision";
      rationale?: string;    // max 200
    }>;
  }
}

// Response: Task（既存と同じ）
// Status: 201

// Backward compat: overrides 省略時は従来動作（候補のフィールドをそのまま使用）
```

### 5-2. 新規 API: POST /api/tasks/candidates/:id/plan-steps

モーダルオープン時に呼ぶ。Bedrock でステップ下書きを生成して返す。

```typescript
// Request: body なし（candidateId は path parameter）

// Response 200
{
  steps: Array<{
    stepId: string;
    stepLabel: string;
    durationMinutes: number;
    bandType: "work" | "decision";
    rationale?: string;
  }>
}

// Response 404: 候補が存在しない
// Response 503: Bedrock 呼び出し失敗
//   フロント側はエラー時にスケルトンを消して手動入力欄に切り替え

// 認証: 既存 authMiddleware を通す（cognitoSub でユーザー確認）
```

---

## 6. テスト方針

### shared
- `ScheduleStep` 型が shared に移動した場合、既存の agent テストが引き続きパスすることを確認
- `ApproveOverridesSchema` のバリデーションテスト（正常系・異常系）

### backend
| テスト対象 | 追加テスト内容 |
|---|---|
| `DynamoTaskCandidateRepository.test.ts` | overrides あり承認・overrides なし承認（後方互換確認）・plannedSteps 保存確認 |
| `tasks.test.ts`（routes） | `POST /candidates/:id/approve` の overrides バリデーション正常系/異常系 |
| `tasks.test.ts`（routes） | `POST /candidates/:id/plan-steps` の正常系 / 候補 404 / Bedrock 503 |

### agent
| テスト対象 | 追加テスト内容 |
|---|---|
| `SchedulePlannerAgent.test.ts` | `plannedSteps` あり → Bedrock 呼び出しなし（IBedrockClient モックが呼ばれないことを確認） |
| `SchedulePlannerAgent.test.ts` | `plannedSteps` なし → 従来通り Bedrock 呼び出し（後方互換） |
| `SchedulePlannerAgent.test.ts` | `generateStepDraft()` の正常系・Bedrock 失敗時のエラー伝播 |

### frontend
| テスト対象 | 追加テスト内容 |
|---|---|
| `TaskApprovalModal.test.tsx`（新規） | モーダルオープン時のステップ下書き取得・4欄の編集・「確定して承認」送信・Esc クローズ・フォーカストラップ |
| `StepEditor.test.tsx`（新規） | ステップ追加・削除・編集・ローディング状態・エラー状態 |
| `TaskCard.test.tsx` | 承認ボタンで `onApproveClick` が呼ばれること（即承認しないこと） |
| `useTasks.test.ts` | `approveWithOverrides` の楽観的更新・ロールバック動作 |
| MSW handlers | `POST .../plan-steps` ハンドラ追加 |

---

## 7. リスク・考慮点

### R-1: Bedrockコスト増（重要度: 中）
モーダルを開く度に Bedrock 推論が走る（`POST /candidates/:id/plan-steps`）。
ガント生成時は `plannedSteps` があれば Bedrock をスキップするため、トータルの
Bedrock 呼び出し回数は「承認数 × 1 回」で変わらない。ただし、モーダルを開いて
キャンセルした場合は無駄な推論コストが発生する。
**対策**: モーダルは候補 1 件につき 1 回しか plan-steps を呼ばない設計とする
（再呼び出しボタンは実装しない。Bedrock 失敗時は手動入力にフォールバック）。

### R-2: 後方互換性（重要度: 高）
`plannedSteps` を持たない既存 Task が DynamoDB に存在する。
`SchedulePlannerAgent.plan()` は `task.plannedSteps` が undefined または
空配列の場合は従来通り Bedrock を呼ぶ分岐にする（フォールバック保証）。

### R-3: PII・requesterハッシュ表示（重要度: 高）
`requester` は SHA-256 ハッシュ済み。そのままモーダルに表示すると
ユーザーが意味を理解できないうえ、推測攻撃のリスクがある。
`sourceType` と組み合わせた「{sourceType} のメンバー」形式のマスク表示とする。
ハッシュ値を UI に表示しない。

### R-4: 楽観的更新との整合（重要度: 中）
現在の `approveCandidate` は「モーダルなしで即時楽観削除」する設計になっている。
モーダル確認フローに変わるため、楽観的更新のタイミングが変わる。
「確定して承認」ボタン押下時点で楽観削除することで UX を維持する。
モーダルを開いただけではリストから候補を消さない。

### R-5: ScheduleStep 型の所有権（重要度: 中）
現在 `ScheduleStep` 型は `pkgs/agent/src/schedule-planner/tools.ts` にある。
フロントエンドでこの型を使うには agent パッケージへの依存が必要になるか、
shared への移動が必要になる。
**方針**: `ScheduleStep` 型と `ScheduleStepSchema` を `pkgs/shared/src/types/schedule.ts`
（既存）または新規 `pkgs/shared/src/types/step.ts` に移動し、agent は shared から
re-import する。frontend / backend も shared から使う。

### R-6: モーダルの i18n（重要度: 低）
プロジェクトルール（`japanese-output.md`）により日本語ハードコード方針。
既存モーダルと同じ方針で実装する。

---

## 8. デプロイ・動作確認方針

### ローカル確認（実装完了後）
1. `pnpm dev`（全パッケージ起動）でモーダルの開閉・編集・承認フローを手動確認
2. MSW モックで Bedrock 呼び出しなしでのモーダル動作確認
3. 全テストパスを確認（shared / backend / agent / frontend）

### 実 AWS 確認タイミング
- ガント機能が実 AWS でも動作確認済みである（mainブランチマージ済み）ため、
  本改修は **全 Step 完了後にまとめて実 AWS 確認**を行う
- `pnpm cdk deploy` は Step 11 後に実施
- 確認項目:
  - `POST /api/tasks/candidates/:id/plan-steps` が API Gateway / Lambda で正常に動くこと
  - DynamoDB の Tasks テーブルに `plannedSteps` が保存されること
  - ガント生成時に CloudWatch ログで `"plannedSteps used"` または類似ログが出ること
  - モーダルの UX が実環境でも意図通りに動くこと（Bedrock レイテンシ許容確認）

---

## 付録: ファイル変更サマリー

| 種別 | ファイル | 変更種別 |
|---|---|---|
| shared | `pkgs/shared/src/types/task.ts` | 変更（フィールド追加） |
| shared | `pkgs/shared/src/types/step.ts` | 新規作成（ScheduleStep型を移動） |
| shared | `pkgs/shared/src/schemas/task.ts` | 変更（スキーマ追加） |
| backend | `pkgs/backend/src/routes/tasks.ts` | 変更（overrides受け取り + plan-stepsエンドポイント追加） |
| backend | `pkgs/backend/src/repositories/DynamoTaskCandidateRepository.ts` | 変更（approve シグネチャ） |
| agent | `pkgs/agent/src/schedule-planner/SchedulePlannerAgent.ts` | 変更（フェーズ1スキップ分岐 + generateStepDraft） |
| agent | `pkgs/agent/src/schedule-planner/tools.ts` | 変更（ScheduleStep 型を shared に移動後 re-import） |
| frontend | `pkgs/frontend/src/components/task/TaskApprovalModal.tsx` | 新規作成 |
| frontend | `pkgs/frontend/src/components/task/StepEditor.tsx` | 新規作成 |
| frontend | `pkgs/frontend/src/components/task/TaskCard.tsx` | 変更（承認ボタン動作） |
| frontend | `pkgs/frontend/src/hooks/useTasks.ts` | 変更（approveWithOverrides） |
| frontend | `pkgs/frontend/src/lib/apiClient.ts` | 変更（シグネチャ変更 + fetchPlanSteps追加） |
| frontend | `pkgs/frontend/src/pages/TaskListPage.tsx` | 変更（モーダル状態管理） |
| frontend | `pkgs/frontend/src/mocks/handlers.ts` | 変更（plan-steps ハンドラ追加） |
