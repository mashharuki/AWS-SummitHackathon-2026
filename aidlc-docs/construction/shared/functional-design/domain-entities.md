# ドメインエンティティ定義 — packages/shared

**Unit**: U-01: shared  
**ステージ**: CONSTRUCTION / Functional Design  
**作成日**: 2026-05-17  
**バージョン**: 1.0.0  
**参照設計書**:
- `aidlc-docs/inception/application-design/dynamodb-access-patterns.md`
- `aidlc-docs/inception/application-design/components.md` § SH-01
- `aidlc-docs/inception/application-design/component-methods/shared-utils.md`
- `aidlc-docs/inception/requirements/requirements.md` FR-01〜FR-08
- Q1〜Q10 回答（2026-05-17 ユーザー確定）

---

## 1. 設計方針（回答確認事項）

| 質問 | 決定内容 |
|------|---------|
| Q1: Task / TaskCandidate | 別型として定義。TaskCandidate は承認前候補ライフサイクルを `status` で表現し、承認時に Task へ変換する |
| Q2: Verdict 型 | `'can_saboru'` / `'borderline'` / `'must_do'` の3値 enum |
| Q3: QuickReplyType | `'truly_tired'` / `'actually_important'` / `'agree_with_ai'` / `'disagree_with_ai'` の4値 |
| Q4: ULID 生成 | `ulidx` npm パッケージを使用 |
| Q5: pseudonymize | SHA-256 ハッシュ化、Node.js `crypto` 標準モジュール |
| Q6: エラークラス | `AppError` を基底クラスとし、各エラーサブクラスが継承 |
| Q7: リポジトリインタフェース | CRUD + GSI クエリ操作を含む。`dynamodb-access-patterns.md` のアクセスパターンを型に反映 |
| Q8: MAX_TOKEN_LIMIT | 環境変数 `MAX_TOKEN_LIMIT` で上書き可能。デフォルト定数 `DEFAULT_MAX_TOKEN_LIMIT = 8000` |
| Q9: Persona 型 | `PersonaType = 'saboru' \| 'amayakashi'`。`Persona` 型を shared に定義 |
| Q10: ServiceConnection | `secretArn` のみ保持（トークン実体は Secrets Manager 管理） |

---

## 2. エンティティ一覧

| エンティティ | DynamoDB テーブル | 概要 |
|------------|----------------|------|
| `User` | Users | ユーザープロファイル |
| `ServiceConnection` | ServiceConnections | 外部サービス OAuth 接続状態 |
| `TaskCandidate` | TaskCandidates | Webhook 受信後の未承認タスク候補 |
| `Task` | Tasks | 承認済みタスク |
| `Proposal` | Proposals | サボり提案ログ |
| `HonneData` | HonneData | ユーザーの本音反応データ |
| `Persona` | Personas | AI ペルソナテンプレート |

---

## 3. エンティティ詳細定義

### 3.1 User

```typescript
/**
 * DynamoDB: Users テーブル
 * PK: USER#<cognitoSub>
 * SK: PROFILE
 */
export interface User {
  /** DynamoDB PK: USER#<cognitoSub> */
  PK: string;
  /** DynamoDB SK: PROFILE（固定値） */
  SK: 'PROFILE';
  /** Cognito Sub（UUID） */
  cognitoSub: string;
  /** メールアドレス */
  email: string;
  /** 表示名 */
  name: string;
  /** 作成日時（ISO 8601） */
  createdAt: string;
  /** 更新日時（ISO 8601） */
  updatedAt: string;
}
```

**アクセスパターン**:
- `GetItem` PK=`USER#<cognitoSub>` SK=`PROFILE` — ログイン時プロファイル取得
- `PutItem` PK=`USER#<cognitoSub>` SK=`PROFILE` — 初回ログイン時レコード作成

---

### 3.2 ServiceConnection

```typescript
/**
 * DynamoDB: ServiceConnections テーブル
 * PK: USER#<cognitoSub>
 * SK: CONN#<service>
 *
 * セキュリティ方針（Q10 回答・aws-constraints.md 遵守）:
 * - Slack Bot Token は AWS Secrets Manager に格納
 * - このエンティティは secretArn のみ保持（トークン実体を DynamoDB に書かない）
 */
export type ServiceType = 'slack';

export type ConnectionStatus = 'connected' | 'disconnected' | 'token_expired';

export interface ServiceConnection {
  /** DynamoDB PK: USER#<cognitoSub> */
  PK: string;
  /** DynamoDB SK: CONN#<service>（例: CONN#slack） */
  SK: string;
  /** サービス種別 */
  service: ServiceType;
  /** 連携状態 */
  status: ConnectionStatus;
  /**
   * Secrets Manager ARN（Q10 回答）
   * トークン実体はここには保存せず Secrets Manager で管理
   */
  secretArn: string;
  /** 連携日時（ISO 8601） */
  connectedAt: string;
  /** トークン有効期限（ISO 8601 / null: 期限なし） */
  expiresAt: string | null;
}
```

**アクセスパターン**:
- `Query` PK=`USER#<userId>` SK `begins_with` `CONN#` — 連携一覧取得
- `PutItem` — Slack OAuth コールバック時に接続情報保存
- `UpdateItem` — 切断時 `status=disconnected` に更新

---

### 3.3 TaskCandidate

```typescript
/**
 * DynamoDB: TaskCandidates テーブル
 * PK: USER#<cognitoSub>
 * SK: TASK_CAND#<ulid>（ulidx パッケージ、Q4 回答）
 *
 * 設計方針（Q1 回答）:
 * - TaskCandidate は承認前候補の独立型
 * - 承認時は TransactWriteItems で TaskCandidates.Delete + Tasks.PutItem を原子実行
 * - TTL: 30日後に DynamoDB 側で自動削除
 */
export type TaskCandidateStatus = 'pending' | 'approved' | 'rejected';

export type SourceType = 'slack' | 'manual';

export interface TaskCandidate {
  /** DynamoDB PK: USER#<cognitoSub> */
  PK: string;
  /** DynamoDB SK: TASK_CAND#<ulid> */
  SK: string;
  /** 候補 ID（ULID、SK から抽出） */
  candidateId: string;
  /** タスク名（Bedrock 抽出済み） */
  title: string;
  /** 締切（ISO 8601 / null: 不明） */
  deadline: string | null;
  /**
   * 依頼者名（仮名化済み、Q5 回答）
   * SHA-256 ハッシュ化して保存。Node.js crypto 標準モジュール使用
   */
  requester: string;
  /** 作業内容サマリ */
  description: string;
  /** 元データソース */
  sourceType: SourceType;
  /**
   * 元メッセージ参照 ID
   * 生データ（メッセージ本文）は保存しない（プライバシー設計）
   */
  sourceRef: string;
  /** 候補ライフサイクル状態 */
  status: TaskCandidateStatus;
  /** 作成日時（ISO 8601） */
  createdAt: string;
  /** TTL（Unix タイムスタンプ、30日後） */
  ttl: number;
}
```

**アクセスパターン**:
- `Query` PK=`USER#<userId>` SK `begins_with` `TASK_CAND#` — 候補一覧（新着順）
- `PutItem` — Slack Webhook 受信時に候補保存
- `TransactWriteItems` Delete — 承認時に候補を削除（Tasksへ原子的に移行）

**GSI**:
- `GSI-UserCreatedAt` (PK: userId, SK: createdAt) — 新着順取得用

---

### 3.4 Task

```typescript
/**
 * DynamoDB: Tasks テーブル
 * PK: USER#<cognitoSub>
 * SK: TASK#<ulid>（ulidx パッケージ、Q4 回答）
 *
 * 設計方針（Q1 回答）:
 * - Task は承認済みタスクの独立型
 * - TaskCandidate からの変換時は新しい ULID を付与
 * - 物理削除はせず status=deleted に論理削除
 */
export type TaskStatus = 'approved' | 'deleted';

export interface Task {
  /** DynamoDB PK: USER#<cognitoSub> */
  PK: string;
  /** DynamoDB SK: TASK#<ulid> */
  SK: string;
  /** タスク ID（ULID、SK から抽出） */
  taskId: string;
  /** GSI 用ユーザー ID */
  userId: string;
  /** タスク状態 */
  status: TaskStatus;
  /** タスク名 */
  title: string;
  /** 締切（ISO 8601 / null: 不明） */
  deadline: string | null;
  /**
   * 依頼者名（仮名化済み、Q5 回答）
   * SHA-256 ハッシュ化済み
   */
  requester: string;
  /** 作業内容 */
  description: string;
  /** 元データソース */
  sourceType: SourceType;
  /** 承認日時（ISO 8601） */
  approvedAt: string;
  /** 更新日時（ISO 8601） */
  updatedAt: string;
}
```

**アクセスパターン**:
- `Query GSI-UserStatus` userId=`USER#<userId>` status=`approved` — 承認済みタスク一覧
- `GetItem` PK=`USER#<userId>` SK=`TASK#<taskId>` — タスク単体取得
- `PutItem` — 手動追加 / 候補承認時の新規作成
- `UpdateItem` — インライン編集 / 論理削除（`status=deleted`）
- `TransactWriteItems` Put — TaskCandidate 承認時の原子操作

**GSI**:
- `GSI-UserStatus` (PK: userId, SK: status) — ステータスフィルタクエリ用

---

### 3.5 Proposal

```typescript
/**
 * DynamoDB: Proposals テーブル
 * PK: TASK#<taskId>
 * SK: PROPOSAL#<ISO8601>
 *
 * サボり判定の履歴ログ。最新提案は GSI-TaskLatest で効率的に取得。
 */
export type Verdict = 'can_saboru' | 'borderline' | 'must_do';
// Q2 回答: 'can_saboru'（今サボれる）/ 'borderline'（グレーゾーン）/ 'must_do'（やらないとまずい）

export interface Proposal {
  /** DynamoDB PK: TASK#<taskId> */
  PK: string;
  /** DynamoDB SK: PROPOSAL#<ISO8601> */
  SK: string;
  /** タスク ID（GSI 用） */
  taskId: string;
  /** ユーザー ID */
  userId: string;
  /** サボり判定（Q2 回答） */
  verdict: Verdict;
  /** 1行サマリテキスト（タスク一覧画面用） */
  summaryText: string;
  /** 判断材料（箇条書き、最大10件） */
  reasoning: string[];
  /** サボローのチャットメッセージ（口調変換済み） */
  chatMessage: string;
  /** 使用ペルソナ ID（MVP: 'saboru_ottori' 固定） */
  personaId: string;
  /** 評価日時（ISO 8601） */
  evaluatedAt: string;
  /** 次回再評価タイミング（ISO 8601） */
  nextCheckAt: string;
  /** 使用トークン数（コスト追跡用） */
  tokenCount: number;
}
```

**アクセスパターン**:
- `Query GSI-TaskLatest` taskId=`TASK#<taskId>` ScanIndexForward=false LIMIT=1 — 最新提案取得
- `PutItem` — SaboriProposerAgent が提案生成時に書き込み

**GSI**:
- `GSI-TaskLatest` (PK: taskId, SK: evaluatedAt) — 最新提案を効率的に1件取得

---

### 3.6 HonneData

```typescript
/**
 * DynamoDB: HonneData テーブル
 * PK: USER#<cognitoSub>
 * SK: HONNE#<ISO8601>
 *
 * FR-05 対応: ユーザーの本音反応データを永続保存
 * 将来の「自分の取扱説明書」生成の原料となる（MVP では将来ビジョンとして提示のみ）
 */
export type HonneType = 'quick_reply' | 'free_text';

/**
 * クイック返信種別（Q3 回答）
 * requirements.md FR-05 の本音収集仕様より:
 * - 'truly_tired': 「たしかに、まだ寝かせる」
 * - 'actually_important': 「いや、このタスクは早めにやった方がいい」
 * - 'agree_with_ai': 「15分だけやる」（AIの判断に同意して部分的に着手）
 * - 'disagree_with_ai': 「完全に放置したい」（AIの判断を否定）
 */
export type QuickReplyType =
  | 'truly_tired'
  | 'actually_important'
  | 'agree_with_ai'
  | 'disagree_with_ai';

export interface HonneData {
  /** DynamoDB PK: USER#<cognitoSub> */
  PK: string;
  /** DynamoDB SK: HONNE#<ISO8601> */
  SK: string;
  /** GSI 用ユーザー ID */
  userId: string;
  /** 関連タスク ID */
  taskId: string;
  /** 反応種別 */
  type: HonneType;
  /**
   * 反応内容
   * - type='quick_reply': QuickReplyType 値
   * - type='free_text': ユーザーが入力した自由テキスト
   */
  content: QuickReplyType | string;
  /** 当時のサボり判定（記録時の文脈保持） */
  proposalVerdict: Verdict;
  /** 作成日時（ISO 8601） */
  createdAt: string;
}
```

**アクセスパターン**:
- `PutItem` — 本音データ記録（POST /api/tasks/:id/honne）
- `Query GSI-UserCreatedAt` userId=`USER#<userId>` — ユーザー本音履歴取得（将来ビジョン用）

**GSI**:
- `GSI-UserCreatedAt` (PK: userId, SK: createdAt) — ユーザー別本音履歴取得用

---

### 3.7 Persona

```typescript
/**
 * DynamoDB: Personas テーブル
 * PK: PERSONA#<personaId>
 * SK: DEFINITION（固定値）
 *
 * Q9 回答: PersonaType = 'saboru' | 'amayakashi'
 * MVP v1.0.0 では 'saboru'（おっとりサボロー）のみ使用
 */
export type PersonaType = 'saboru' | 'amayakashi';
// 'saboru': おっとりサボロー（MVP 使用）
// 'amayakashi': あまやかしサボロー（将来展望）

export interface Persona {
  /** DynamoDB PK: PERSONA#<personaId> */
  PK: string;
  /** DynamoDB SK: DEFINITION（固定値） */
  SK: 'DEFINITION';
  /** ペルソナ ID（例: 'saboru_ottori'） */
  personaId: string;
  /** ペルソナ種別（Q9 回答） */
  type: PersonaType;
  /** 表示名（例: 「おっとりサボロー」） */
  name: string;
  /** Bedrock プロンプトテンプレート */
  promptTemplate: string;
  /** 口調定義（語尾・スタイル） */
  tone: string;
  /** 使用絵文字セット */
  emojis: string[];
  /** テンプレートバージョン（整数） */
  version: number;
}
```

**アクセスパターン**:
- `GetItem` PK=`PERSONA#<personaId>` SK=`DEFINITION` — ペルソナ定義取得

---

## 4. 列挙型・共通型まとめ

```typescript
// packages/shared/types/enums.ts

/** サボり判定（Q2 回答） */
export type Verdict = 'can_saboru' | 'borderline' | 'must_do';

/** クイック返信種別（Q3 回答） */
export type QuickReplyType =
  | 'truly_tired'
  | 'actually_important'
  | 'agree_with_ai'
  | 'disagree_with_ai';

/** データソース種別 */
export type SourceType = 'slack' | 'manual';

/** 外部サービス種別 */
export type ServiceType = 'slack';

/** 外部サービス連携状態 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'token_expired';

/** タスク候補ライフサイクル（Q1 回答） */
export type TaskCandidateStatus = 'pending' | 'approved' | 'rejected';

/** 承認済みタスク状態 */
export type TaskStatus = 'approved' | 'deleted';

/** 本音反応種別 */
export type HonneType = 'quick_reply' | 'free_text';

/** ペルソナ種別（Q9 回答） */
export type PersonaType = 'saboru' | 'amayakashi';
```

---

## 5. エンティティ関連図

```
User
 |
 +-- ServiceConnection (1対多: CONN#slack, CONN#gmail, ...)
 |
 +-- TaskCandidate (1対多: 承認前候補)
 |     |
 |     +-- [承認時に TransactWriteItems で変換] --> Task
 |
 +-- Task (1対多: 承認済みタスク)
 |     |
 |     +-- Proposal (1対多: サボり提案履歴)
 |     |
 |     +-- HonneData (1対多: 本音反応ログ)
 |
Persona (独立。User・Task に依存しない参照テーブル)
```

---

## 6. エクスポート構成

```typescript
// packages/shared/src/types/index.ts

// エンティティ型
export type { User } from './user';
export type { ServiceConnection, ServiceType, ConnectionStatus } from './service-connection';
export type { TaskCandidate, TaskCandidateStatus } from './task-candidate';
export type { Task, TaskStatus } from './task';
export type { Proposal } from './proposal';
export type { HonneData, HonneType } from './honne-data';
export type { Persona, PersonaType } from './persona';

// 共通列挙型
export type { Verdict, QuickReplyType, SourceType } from './enums';

// エラークラス（business-rules.md に定義）
export { AppError, BedrockTimeoutError, TokenExpiredError,
         DynamoWriteFailedError, BedrockCostExceededError } from '../errors';

// リポジトリインタフェース（business-logic-model.md に定義）
export type { ITaskCandidateRepository, ITaskRepository,
              IProposalRepository, IHonneRepository,
              IUserRepository, IServiceConnectionRepository } from '../repositories';
```
