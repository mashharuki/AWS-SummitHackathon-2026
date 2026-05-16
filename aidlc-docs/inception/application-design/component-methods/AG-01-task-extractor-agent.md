# AG-01: TaskExtractorAgent — コンポーネントメソッド定義

**レイヤー**: エージェント（packages/agent）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § AG-01  
**Unit**: U-03a（task-extractor）

---

## インターフェース定義

```typescript
interface ITaskExtractorAgent {
  extractTask(input: ExternalEvent): Promise<TaskCandidate>
}

// ExternalEvent の種別（v1.0.0: Slack のみ）
// v1.1.0 以降で Gmail / Google Calendar イベントを追加予定
type ExternalEvent =
  | { source: 'slack'; message: SlackMessage }

// 抽出結果
interface TaskCandidate {
  title: string
  deadline?: string
  requester?: string
  description?: string
  sourceType: 'slack' | 'manual'
  sourceRef: string  // 元メッセージの参照ID（生データは保存しない）
}
```

## 処理フロー

1. EventBridge から `ExternalEvent` を受信
2. Amazon Bedrock（Claude Sonnet）でタスク要素を抽出（title / deadline / requester）
3. `TaskCandidate` として DynamoDB TaskCandidates テーブルに保存
4. 生データ（メッセージ本文）はメモリ上でのみ処理し、保存しない（NFR-07）

## 依存サービス

- **Amazon EventBridge** — タスク抽出イベントの受信トリガー
- **Amazon Bedrock（Claude Sonnet 3.5）** — タスク情報の自然言語抽出
- **DynamoDB TaskCandidates テーブル** — 抽出済み候補の保存

## 関連要件

- FR-01: Slack からのタスク自動抽出（v1.0.0）
- NFR-07: プライバシー保護（生データ非保存）

## シーケンス参照

`application-design.md` § 7.1（タスク自動抽出フロー）
