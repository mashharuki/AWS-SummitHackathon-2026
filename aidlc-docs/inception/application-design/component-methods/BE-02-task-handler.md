# BE-02: TaskHandler — コンポーネントメソッド定義

**レイヤー**: バックエンド API（apps/api）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § BE-02

---

## メソッド定義

```typescript
// タスク一覧取得（候補 + 承認済み）
GET /api/tasks
Query:    { status?: 'pending' | 'approved' }
Response: Task[]

// タスク取得（単一）
GET /api/tasks/:id
Response: Task

// 手動タスク追加
POST /api/tasks
Request:  { title: string, deadline?: string, description?: string }
Response: Task

// タスク更新（インライン編集）
PATCH /api/tasks/:id
Request:  Partial<{ title: string, deadline: string, description: string }>
Response: Task

// タスク削除
DELETE /api/tasks/:id
Response: { deleted: true }

// タスク候補承認（pending → approved）
POST /api/tasks/candidates/:id/approve
Response: Task  // status: 'approved'
```

## 依存サービス

- **DynamoDB** — Tasks テーブル（承認済み） / TaskCandidates テーブル（候補）
- **AG-01 TaskExtractorAgent** — 候補を正規タスクに変換する際に参照

## 関連要件

- FR-01: Slack/Gmail/Calendar からのタスク自動抽出
- FR-02: タスク候補の承認フロー
- FR-06: タスク手動追加・編集

## シーケンス参照

`application-design.md` § 7.1（タスク自動抽出フロー）
