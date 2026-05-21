# ビジネスロジックモデル定義 — packages/shared

**Unit**: U-01: shared  
**ステージ**: CONSTRUCTION / Functional Design  
**作成日**: 2026-05-17  
**バージョン**: 1.0.0  
**参照**:
- `domain-entities.md`（本ディレクトリ）
- `business-rules.md`（本ディレクトリ）
- `aidlc-docs/inception/application-design/dynamodb-access-patterns.md`
- Q7 回答（2026-05-17 ユーザー確定）

---

## 1. 概要

`packages/shared` のビジネスロジックモデルでは、DynamoDB アクセスを抽象化するリポジトリインタフェースと、
アプリケーション全体で使用されるユーティリティ関数の型・仕様を定義する。

Q7 回答に従い、**CRUD 操作 + GSI クエリ操作を含む**完全なリポジトリインタフェースを提供する。
各インタフェースは `dynamodb-access-patterns.md` に定義されたアクセスパターンに対応する。

---

## 2. リポジトリインタフェース一覧

| インタフェース | 対象エンティティ | 実装場所 |
|-------------|---------------|---------|
| `IUserRepository` | User | pkgs/backend/src/repositories/ |
| `IServiceConnectionRepository` | ServiceConnection | pkgs/backend/src/repositories/ |
| `ITaskCandidateRepository` | TaskCandidate | pkgs/backend/src/repositories/ |
| `ITaskRepository` | Task | pkgs/backend/src/repositories/ |
| `IProposalRepository` | Proposal | pkgs/backend/src/repositories/ |
| `IHonneRepository` | HonneData | pkgs/backend/src/repositories/ |

---

## 3. リポジトリインタフェース詳細

### 3.1 IUserRepository

```typescript
// packages/shared/src/repositories/IUserRepository.ts

import type { User } from '../types';

export interface IUserRepository {
  /**
   * ユーザーを取得する
   * DynamoDB: GetItem PK=USER#<cognitoSub> SK=PROFILE
   *
   * @returns ユーザー情報、存在しない場合は null
   */
  findById(cognitoSub: string): Promise<User | null>;

  /**
   * ユーザーを作成または上書きする（初回ログイン時）
   * DynamoDB: PutItem PK=USER#<cognitoSub> SK=PROFILE
   */
  upsert(user: Omit<User, 'PK' | 'SK'>): Promise<User>;
}
```

---

### 3.2 IServiceConnectionRepository

```typescript
// packages/shared/src/repositories/IServiceConnectionRepository.ts

import type { ServiceConnection, ServiceType } from '../types';

export interface IServiceConnectionRepository {
  /**
   * ユーザーの全サービス連携一覧を取得する
   * DynamoDB: Query PK=USER#<userId> SK begins_with CONN#
   * アクセスパターン: GET /api/connections
   */
  findAllByUserId(userId: string): Promise<ServiceConnection[]>;

  /**
   * 特定サービスの連携情報を取得する
   * DynamoDB: GetItem PK=USER#<userId> SK=CONN#<service>
   */
  findByUserAndService(
    userId: string,
    service: ServiceType,
  ): Promise<ServiceConnection | null>;

  /**
   * サービス連携情報を保存する（OAuth コールバック時）
   * DynamoDB: PutItem PK=USER#<userId> SK=CONN#<service>
   * セキュリティ: secretArn のみ保存（トークン実体は Secrets Manager 管理、BR-08）
   */
  save(connection: Omit<ServiceConnection, 'PK' | 'SK'>): Promise<ServiceConnection>;

  /**
   * サービスを切断する（status=disconnected に更新）
   * DynamoDB: UpdateItem PK=USER#<userId> SK=CONN#<service>
   */
  disconnect(userId: string, service: ServiceType): Promise<void>;
}
```

---

### 3.3 ITaskCandidateRepository

```typescript
// packages/shared/src/repositories/ITaskCandidateRepository.ts

import type { TaskCandidate } from '../types';

export interface ITaskCandidateRepository {
  /**
   * タスク候補一覧を取得する（新着順）
   * DynamoDB: Query PK=USER#<userId> SK begins_with TASK_CAND#
   * GSI-UserCreatedAt を使用した createdAt 降順ソート
   * アクセスパターン: GET /api/tasks（candidates）
   */
  findAllByUserId(userId: string): Promise<TaskCandidate[]>;

  /**
   * タスク候補を単件取得する
   * DynamoDB: GetItem PK=USER#<userId> SK=TASK_CAND#<candidateId>
   */
  findById(userId: string, candidateId: string): Promise<TaskCandidate | null>;

  /**
   * タスク候補を作成する（Webhook 受信時）
   * DynamoDB: PutItem PK=USER#<userId> SK=TASK_CAND#<ulid>
   * ULID は generateUlid() で生成（BR-04）
   * requester は pseudonymize() で仮名化済みであること（BR-05）
   * TTL は作成日から 30 日後を設定（BR-13）
   */
  create(candidate: Omit<TaskCandidate, 'PK' | 'SK'>): Promise<TaskCandidate>;

  /**
   * タスク候補を承認し、Tasks テーブルへ原子的に移行する
   * DynamoDB: TransactWriteItems（Delete TaskCandidates + PutItem Tasks）
   * 承認済み Task は新しい ULID を持つ（BR-04）
   * アクセスパターン: POST /api/tasks/candidates/:id/approve
   *
   * @returns 作成された承認済み Task
   * @throws DynamoWriteFailedError TransactWriteItems 失敗時
   */
  approve(userId: string, candidateId: string): Promise<import('./ITaskRepository').ApprovedTask>;

  /**
   * タスク候補を削除する（ユーザーが却下した場合）
   * DynamoDB: DeleteItem PK=USER#<userId> SK=TASK_CAND#<candidateId>
   */
  delete(userId: string, candidateId: string): Promise<void>;
}
```

---

### 3.4 ITaskRepository

```typescript
// packages/shared/src/repositories/ITaskRepository.ts

import type { Task } from '../types';

/** approve() の戻り値型 */
export type ApprovedTask = Task;

export interface ITaskRepository {
  /**
   * 承認済みタスク一覧を取得する
   * DynamoDB: Query GSI-UserStatus userId=USER#<userId> status=approved
   * アクセスパターン: GET /api/tasks（approved）
   */
  findApprovedByUserId(userId: string): Promise<Task[]>;

  /**
   * タスクを単件取得する
   * DynamoDB: GetItem PK=USER#<userId> SK=TASK#<taskId>
   * アクセスパターン: GET /api/tasks/:id
   */
  findById(userId: string, taskId: string): Promise<Task | null>;

  /**
   * タスクを手動作成する（status=approved で即承認）
   * DynamoDB: PutItem PK=USER#<userId> SK=TASK#<ulid>
   * ULID は generateUlid() で生成（BR-04）
   * アクセスパターン: POST /api/tasks
   */
  create(task: Omit<Task, 'PK' | 'SK' | 'taskId' | 'status' | 'approvedAt' | 'updatedAt'>): Promise<Task>;

  /**
   * タスクを更新する（インライン編集）
   * DynamoDB: UpdateItem PK=USER#<userId> SK=TASK#<taskId>
   * updatedAt を自動更新する
   * アクセスパターン: PATCH /api/tasks/:id
   */
  update(
    userId: string,
    taskId: string,
    updates: Partial<Pick<Task, 'title' | 'deadline' | 'description'>>,
  ): Promise<Task>;

  /**
   * タスクを論理削除する（status=deleted に変更、物理削除しない、BR-03）
   * DynamoDB: UpdateItem PK=USER#<userId> SK=TASK#<taskId>
   * アクセスパターン: DELETE /api/tasks/:id
   */
  softDelete(userId: string, taskId: string): Promise<void>;

  /**
   * TaskCandidateRepository.approve() から内部呼び出しされる
   * TransactWriteItems の Put 操作をラップ（ITaskCandidateRepository 経由で使用）
   * 直接呼び出し禁止（候補承認フローを bypass するため）
   */
  putFromTransaction(task: Task): Promise<void>;
}
```

---

### 3.5 IProposalRepository

```typescript
// packages/shared/src/repositories/IProposalRepository.ts

import type { Proposal } from '../types';

export interface IProposalRepository {
  /**
   * 指定タスクの最新提案を取得する
   * DynamoDB: Query GSI-TaskLatest PK=TASK#<taskId> ScanIndexForward=false LIMIT=1
   * アクセスパターン: GET /api/tasks/:id/proposal
   *
   * @returns 最新提案、存在しない場合は null
   */
  findLatestByTaskId(taskId: string): Promise<Proposal | null>;

  /**
   * サボり提案を保存する（SaboriProposerAgent が呼び出す）
   * DynamoDB: PutItem PK=TASK#<taskId> SK=PROPOSAL#<ISO8601>
   * SK の ISO8601 は evaluatedAt の値を使用（GSI-TaskLatest のソートキー）
   */
  save(proposal: Omit<Proposal, 'PK' | 'SK'>): Promise<Proposal>;
}
```

---

### 3.6 IHonneRepository

```typescript
// packages/shared/src/repositories/IHonneRepository.ts

import type { HonneData } from '../types';

export interface IHonneRepository {
  /**
   * 本音データを保存する
   * DynamoDB: PutItem PK=USER#<userId> SK=HONNE#<ISO8601>
   * アクセスパターン: POST /api/tasks/:id/honne（FR-05）
   */
  save(honneData: Omit<HonneData, 'PK' | 'SK'>): Promise<HonneData>;

  /**
   * ユーザーの本音履歴を取得する（将来ビジョン: 自分の取扱説明書生成用）
   * DynamoDB: Query GSI-UserCreatedAt PK=USER#<userId>
   * MVP v1.0.0 では UI に表示しない（AG-05 スコープ外）
   */
  findAllByUserId(userId: string): Promise<HonneData[]>;
}
```

---

## 4. ユーティリティ関数仕様まとめ

`packages/shared` がエクスポートするすべてのユーティリティ関数の仕様を一覧化する。

| 関数 | ファイル | 引数 | 戻り値 | ビジネスルール |
|------|--------|------|-------|-------------|
| `generateUlid()` | utils/generateUlid | なし | `string`（ULID 26文字） | BR-04: ulidx パッケージ使用 |
| `pseudonymize(name)` | utils/pseudonymize | `name: string` | `string`（SHA-256 hex） | BR-05, BR-06: ソルト必須 |
| `countTokens(text)` | utils/guardTokenLimit | `text: string` | `number` | BR-12: 日本語1文字≒1.5トークン |
| `guardTokenLimit(prompt, limit?)` | utils/guardTokenLimit | `prompt: string`, `limit?: number` | `string` | BR-07, BR-12: 環境変数優先 |
| `formatDeadline(isoDate)` | utils/datetime | `isoDate: string \| null` | `string` | JST 換算、null→「締切なし」 |
| `minutesUntil(isoDate)` | utils/datetime | `isoDate: string` | `number` | 正=未来、負=超過 |
| `isOverdue(isoDate)` | utils/datetime | `isoDate: string` | `boolean` | `minutesUntil < 0` |
| `toIsoString(date?)` | utils/datetime | `date?: Date` | `string`（ISO 8601） | 未指定時は `new Date()` |

---

## 5. 定数定義

```typescript
// packages/shared/src/constants/index.ts

/** Verdict（サボり判定）定数 */
export const VERDICT_TYPE = {
  CAN_SABORU: 'can_saboru',
  BORDERLINE: 'borderline',
  MUST_DO: 'must_do',
} as const;

/** データソース種別定数 */
export const SOURCE_TYPE = {
  SLACK: 'slack',
  MANUAL: 'manual',
} as const;

/** 外部サービス種別定数 */
export const SERVICE_TYPE = {
  SLACK: 'slack',
} as const;

/** クイック返信種別定数（FR-05） */
export const QUICK_REPLY_TYPE = {
  TRULY_TIRED: 'truly_tired',
  ACTUALLY_IMPORTANT: 'actually_important',
  AGREE_WITH_AI: 'agree_with_ai',
  DISAGREE_WITH_AI: 'disagree_with_ai',
} as const;

/**
 * デフォルトトークン上限（Q8 回答）
 * 環境変数 MAX_TOKEN_LIMIT で上書き可能
 */
export const DEFAULT_MAX_TOKEN_LIMIT = 8000;

/** DynamoDB SK プレフィックス定義 */
export const DDB_PREFIX = {
  USER: 'USER#',
  TASK_CAND: 'TASK_CAND#',
  TASK: 'TASK#',
  CONN: 'CONN#',
  PERSONA: 'PERSONA#',
  PROPOSAL: 'PROPOSAL#',
  HONNE: 'HONNE#',
} as const;

/** MVP 固定ペルソナ ID */
export const DEFAULT_PERSONA_ID = 'saboru_ottori';

/** TaskCandidate TTL 日数（DynamoDB 自動削除） */
export const TASK_CANDIDATE_TTL_DAYS = 30;
```

---

## 6. ビジネスロジックフロー

### 6.1 TaskCandidate → Task 変換フロー（BR-02, BR-04）

```
[Slack Webhook 受信]
      |
      v
[AG-01 TaskExtractorAgent]
      |
      v
[ITaskCandidateRepository.create()]
  - generateUlid() で TASK_CAND#<ulid> を生成
  - pseudonymize(requester) で仮名化
  - status: 'pending'、TTL: 30日後 を設定
  - DynamoDB PutItem
      |
      v
[ユーザーが「承認」ボタンを押す]
      |
      v
[ITaskCandidateRepository.approve()]
  - generateUlid() で新しい TASK#<ulid> を生成（BR-04）
  - TransactWriteItems:
      Delete: TaskCandidates[TASK_CAND#<oldUlid>]
      Put:    Tasks[TASK#<newUlid>] status=approved
  - EventBridge.PutEvents (SaboriProposerAgent トリガー)
      |
      v
[Task 作成完了]
```

### 6.2 Bedrock 呼び出し前ガードフロー（BR-07, BR-12）

```
[Agent がプロンプトを構築]
      |
      v
[countTokens(prompt)]
      |
      +-- limit 以内 --> [Bedrock converse API 呼び出し]
      |
      +-- limit 超過 --> [guardTokenLimit(prompt, limit) で末尾切り捨て]
                              |
                              v
                        [Bedrock converse API 呼び出し]
                        (切り捨て後のプロンプトで実行)
```

### 6.3 仮名化フロー（BR-05, BR-06）

```
[Slack API から user_id / username を取得]
      |
      v
[pseudonymize(name)]
  - process.env.PSEUDONYMIZE_SALT を確認
  - 未設定: AppError('INVALID_INPUT', ..., 500) を throw
  - 設定済み: SHA-256(salt + name) を返す
      |
      v
[TaskCandidate.requester / Task.requester に保存]
（元の氏名・user_id は DynamoDB に保存しない）
```

---

## 7. パッケージ構成（実装時の参考）

```
pkgs/shared/
  src/
    types/
      index.ts          # 全型の re-export
      user.ts
      service-connection.ts
      task-candidate.ts
      task.ts
      proposal.ts
      honne-data.ts
      persona.ts
      enums.ts          # Verdict / QuickReplyType / SourceType 等
    errors/
      AppError.ts       # 基底エラークラス
      index.ts          # 特化エラーサブクラス + re-export
    repositories/
      IUserRepository.ts
      IServiceConnectionRepository.ts
      ITaskCandidateRepository.ts
      ITaskRepository.ts
      IProposalRepository.ts
      IHonneRepository.ts
      index.ts          # 全インタフェースの re-export
    utils/
      generateUlid.ts
      pseudonymize.ts
      guardTokenLimit.ts
      datetime.ts
      index.ts          # 全ユーティリティの re-export
    schemas/
      task.ts           # CreateTaskSchema / UpdateTaskSchema
      honne.ts          # CreateHonneSchema
      index.ts
    constants/
      index.ts          # VERDICT_TYPE / QUICK_REPLY_TYPE / DDB_PREFIX 等
  index.ts              # パッケージルートのエクスポートポイント
  package.json
  tsconfig.json
```

---

## 8. 依存関係

`packages/shared` は他の packages に依存しない（循環依存防止）。

```
packages/shared
  外部依存:
    - ulidx              # ULID 生成（Q4 回答）
    - zod                # バリデーションスキーマ
    - (crypto)           # Node.js 標準モジュール（pseudonymize）
  
  内部依存: なし（他パッケージへの依存禁止）
  
  被依存（以下から import される）:
    - pkgs/backend
    - pkgs/agent
    - pkgs/frontend（型のみ）
```
