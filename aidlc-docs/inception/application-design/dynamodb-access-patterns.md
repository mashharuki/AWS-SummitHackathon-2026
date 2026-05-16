# DynamoDB アクセスパターン定義 — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-16
**バージョン**: 1.0.0
**対応ステージ**: INCEPTION - Application Design 補足

---

## 1. キー設計方針

SABOROU では **Single Table 非採用**（テーブル分離）方針を採用する。理由は以下のとおり。

| 採用しない理由 | 詳細 |
|-------------|------|
| ハッカソンスコープの可読性 | Single Table はアクセスパターンが確定している場合に効果的。MVP 段階では可読性と保守性を優先する |
| チーム規模（1人開発）| GSI や SK フォーマットの複雑さをシンプルに保つ |
| 将来のスキーマ変更対応 | テーブル分離により変更影響範囲を局所化できる |

### テーブル一覧

| テーブル名 | スコープ | 備考 |
|----------|--------|------|
| Users | MVP v1.0.0 | ユーザープロファイル |
| ServiceConnections | MVP v1.0.0 | Slack OAuth トークン管理 |
| TaskCandidates | MVP v1.0.0 | Webhook 受信後の未承認タスク |
| Tasks | MVP v1.0.0 | 承認済みタスク |
| Proposals | MVP v1.0.0 | サボり提案ログ |
| HonneData | MVP v1.0.0 | 本音データ |
| Personas | MVP v1.0.0 | AI 人格テンプレート |
| TaskOrganization | v1.1.0 追加 | タスク依存関係・手順最適化（AG-05 使用）|

---

## 2. テーブル完全定義

---

### テーブル: Users

**PK**: `USER#<cognitoSub>` (String)
**SK**: `PROFILE` (String)

| 属性 | 型 | 役割 |
|------|-----|------|
| PK | String | `USER#<cognitoSub>` |
| SK | String | `PROFILE` |
| email | String | メールアドレス |
| name | String | 表示名 |
| createdAt | String | ISO 8601 |
| updatedAt | String | ISO 8601 |

**GSI**: なし
**TTL**: なし（永続保持）

---

### テーブル: ServiceConnections

**PK**: `USER#<cognitoSub>` (String)
**SK**: `CONN#<service>` (String) — 例: `CONN#slack`

| 属性 | 型 | 役割 |
|------|-----|------|
| PK | String | `USER#<cognitoSub>` |
| SK | String | `CONN#<service>` |
| status | String | `connected` / `disconnected` / `token_expired` |
| secretArn | String | Secrets Manager ARN |
| connectedAt | String | ISO 8601 |
| expiresAt | String | ISO 8601（トークン有効期限）|

**GSI**: なし
**TTL**: なし

---

### テーブル: TaskCandidates（タスク候補）

**PK**: `USER#<cognitoSub>` (String)
**SK**: `TASK_CAND#<ulid>` (String)

| 属性 | 型 | 役割 |
|------|-----|------|
| PK | String | `USER#<cognitoSub>` |
| SK | String | `TASK_CAND#<ulid>` |
| title | String | タスク名 |
| deadline | String | 締切（ISO 8601 / null）|
| requester | String | 依頼者名（仮名化）|
| description | String | 作業内容サマリ |
| sourceType | String | `slack` / `manual` |
| sourceRef | String | 元メッセージ参照 ID（生データは保存しない）|
| createdAt | String | ISO 8601 |
| ttl | Number | Unix タイムスタンプ（30日後）|

**GSI**:
- `GSI-UserCreatedAt` (PK: userId, SK: createdAt) — 新着順取得用

**TTL**: `ttl` 属性（30日後に自動削除）

---

### テーブル: Tasks（承認済みタスク）

**PK**: `USER#<cognitoSub>` (String)
**SK**: `TASK#<ulid>` (String)

| 属性 | 型 | 役割 |
|------|-----|------|
| PK | String | `USER#<cognitoSub>` |
| SK | String | `TASK#<ulid>` |
| userId | String | ユーザー ID（GSI 用）|
| status | String | `approved` / `deleted` |
| title | String | タスク名 |
| deadline | String | 締切（ISO 8601 / null）|
| requester | String | 依頼者名 |
| description | String | 作業内容 |
| sourceType | String | `slack` / `manual` |
| approvedAt | String | ISO 8601 |
| updatedAt | String | ISO 8601 |

**GSI**:
```
GSI-UserStatus:
  PK: userId（String）
  SK: status（String）
  status の値: 'approved' / 'deleted'
  Query: userId = 'USER#xxx', status = 'approved'
  ※ SK に固定値 'STATUS#approved' は使用しない（フルスキャンになるため）
```

**TTL**: なし（永続保持）

---

### テーブル: Proposals（サボり提案ログ）

**PK**: `TASK#<taskId>` (String)
**SK**: `PROPOSAL#<ISO8601>` (String)

| 属性 | 型 | 役割 |
|------|-----|------|
| PK | String | `TASK#<taskId>` |
| SK | String | `PROPOSAL#<ISO8601>` |
| taskId | String | タスク ID（GSI 用）|
| userId | String | ユーザー ID |
| verdict | String | `can_saboru` / `caution` / `danger` |
| summaryText | String | 1行サマリ（タスク一覧用）|
| reasoning | StringSet | 判断材料箇条書き（最大10件）|
| chatMessage | String | サボローのチャットメッセージ |
| personaId | String | `saboru_ottori`（固定）|
| evaluatedAt | String | ISO 8601 |
| nextCheckAt | String | ISO 8601（次回再評価タイミング）|
| tokenCount | Number | 使用トークン数（コスト追跡用）|

**GSI**:
```
GSI-TaskLatest:
  PK: taskId（String）
  SK: evaluatedAt（String, ISO 8601）
  ScanIndexForward: false（降順 = 最新が先頭）
  LIMIT 1 で最新提案を効率的に取得
```

**TTL**: なし（永続保持）

---

### テーブル: HonneData（本音データ）

**PK**: `USER#<cognitoSub>` (String)
**SK**: `HONNE#<ISO8601>` (String)

| 属性 | 型 | 役割 |
|------|-----|------|
| PK | String | `USER#<cognitoSub>` |
| SK | String | `HONNE#<ISO8601>` |
| taskId | String | 関連タスク ID |
| type | String | `quick_reply` / `free_text` |
| content | String | 反応内容（クイック返信 ID またはフリーテキスト）|
| proposalVerdict | String | 当時のサボり判定 |
| createdAt | String | ISO 8601 |

**GSI**:
- `GSI-UserCreatedAt` (PK: userId, SK: createdAt) — ユーザー本音履歴取得用

**TTL**: なし（永続保持 — 将来の取扱説明書生成の原料）

---

### テーブル: Personas（ペルソナテンプレート）

**PK**: `PERSONA#<personaId>` (String)
**SK**: `DEFINITION` (String)

| 属性 | 型 | 役割 |
|------|-----|------|
| PK | String | `PERSONA#<personaId>` |
| SK | String | `DEFINITION` |
| name | String | 表示名（例: 「おっとりサボロー」）|
| promptTemplate | String | Bedrock プロンプトテンプレート |
| tone | String | 口調定義（語尾・スタイル）|
| emojis | StringSet | 使用絵文字セット |
| version | Number | テンプレートバージョン |

**TTL**: なし

---

## 3. エンドポイント × アクセスパターン マッピング表

全 14 エンドポイントのアクセスパターンを定義する。

| エンドポイント | テーブル | 操作 | Key 条件 | メモ |
|---|---|---|---|---|
| `GET /api/tasks` (candidates) | TaskCandidates | Query | PK=USER#{userId}, SK begins_with TASK_CAND# | createdAt 降順 |
| `GET /api/tasks` (approved) | Tasks | Query GSI-UserStatus | userId={userId}, status=approved | ステータスフィルタ |
| `POST /api/tasks` | Tasks | PutItem | PK=USER#{userId}, SK=TASK#{ulid} | status=approved（手動追加は即承認）|
| `GET /api/tasks/:id` | Tasks | GetItem | PK=USER#{userId}, SK=TASK#{taskId} | |
| `PATCH /api/tasks/:id` | Tasks | UpdateItem | PK=USER#{userId}, SK=TASK#{taskId} | |
| `DELETE /api/tasks/:id` | Tasks | UpdateItem | PK=USER#{userId}, SK=TASK#{taskId} | status=deleted に変更（物理削除しない）|
| `POST /api/tasks/candidates/:id/approve` | TaskCandidates + Tasks | TransactWriteItems | Delete+Put の原子操作 | EventBridge.PutEvents も同時実行 |
| `GET /api/tasks/:id/proposal` | Proposals | Query GSI-TaskLatest | taskId=TASK#{taskId}, LIMIT 1, ScanIndexForward=false | |
| `POST /api/tasks/:id/honne` | HonneData | PutItem | PK=USER#{userId}, SK=HONNE#{iso8601} | |
| `GET /api/connections` | ServiceConnections | Query | PK=USER#{userId}, SK begins_with CONN# | |
| `POST /api/connections/slack/callback` | ServiceConnections | PutItem | PK=USER#{userId}, SK=CONN#slack | Secrets Manager.PutSecretValue も同時実行 |
| `DELETE /api/connections/:service` | ServiceConnections | UpdateItem | PK=USER#{userId}, SK=CONN#{service} | status=disconnected |
| `POST /webhooks/slack` | TaskCandidates | PutItem | PK=USER#{userId}, SK=TASK_CAND#{ulid} | AG-01 Lambda 内で実行（EventBridge 経由）|
| `POST /api/auth/exchange-token` | Users | PutItem（初回）/ GetItem | PK=USER#{cognitoSub}, SK=PROFILE | 初回ログイン時にユーザーレコード作成 |

---

## 4. トランザクション操作定義

### タスク候補承認（`POST /api/tasks/candidates/:id/approve`）

候補タスクの削除と承認済みタスクの追加を原子操作で実行する。

```typescript
TransactWriteItems([
  {
    Delete: {
      TableName: TaskCandidates,
      Key: {
        PK: `USER#${userId}`,
        SK: `TASK_CAND#${candidateId}`
      }
    }
  },
  {
    Put: {
      TableName: Tasks,
      Item: {
        PK: `USER#${userId}`,
        SK: `TASK#${newUlid}`,
        userId: userId,
        status: 'approved',
        title: candidate.title,
        deadline: candidate.deadline,
        requester: candidate.requester,
        description: candidate.description,
        sourceType: candidate.sourceType,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      ConditionExpression: 'attribute_not_exists(PK)'
    }
  }
])
```

トランザクション成功後に `EventBridge.PutEvents` で SaboriProposerAgent をトリガーする。
EventBridge の呼び出しはトランザクション外だが、DynamoDB トランザクション成功後に実行することで整合性を確保する。

---

## 5. Slack Webhook エラーリトライ戦略

| フロー | 戦略 | 詳細 |
|--------|------|------|
| Lambda タイムアウト設定 | 60秒 | Bedrock 呼び出しを含む AG-01 の最大実行時間 |
| EventBridge → AG-01 Lambda | 最大3回自動リトライ | EventBridge デフォルト設定 |
| AG-01 失敗時 | Dead Letter Queue（SQS）に送信 | DLQ 保持期間: 1日（ハッカソンスコープ） |
| CloudWatch Alarm | AG-01 エラー率 > 10% で通知 | SNS 経由でアラート |

### DLQ 設定

```typescript
// AgentStack（infra/lib/stacks/agent-stack.ts）
const dlq = new sqs.Queue(this, 'AG01Dlq', {
  retentionPeriod: cdk.Duration.days(1),
})

taskExtractorFunction.addEventSourceMapping('AG01EventSource', {
  eventSourceArn: eventBusRule.ruleArn,
  // EventBridge からの失敗イベントを DLQ に送信
})
```

---

## 6. GSI 設計根拠まとめ

| テーブル | GSI 名 | 設計根拠 |
|---------|-------|---------|
| TaskCandidates | GSI-UserCreatedAt (PK: userId, SK: createdAt) | ユーザーごとに承認待ちタスクを時系列で取得するため |
| Tasks | GSI-UserStatus (PK: userId, SK: status) | ユーザーごとに承認済みタスクをステータスでフィルタするため。SK を固定値にしないことでフルスキャンを防ぐ |
| Proposals | GSI-TaskLatest (PK: taskId, SK: evaluatedAt) | 特定タスクの最新提案を O(1) で取得するため。ScanIndexForward=false + LIMIT 1 で効率化 |
| HonneData | GSI-UserCreatedAt (PK: userId, SK: createdAt) | 将来の取扱説明書生成でユーザー単位の本音データを集計するため |

---

## 参照文書

| 文書 | パス |
|------|------|
| アプリケーション設計書 | `aidlc-docs/inception/application-design/application-design.md` |
| コンポーネント定義 | `aidlc-docs/inception/application-design/components.md` |
| Unit of Work 定義書 | `aidlc-docs/inception/units/unit-of-work.md` |
| 要件定義書 | `aidlc-docs/inception/requirements/requirements.md` |

---

*本文書は Application Design ステージの補足成果物（v1.0.0）です。DynamoDB アクセスパターンを網羅的に定義し、GSI 設計の根拠と TransactWriteItems の詳細を明示しています。*
