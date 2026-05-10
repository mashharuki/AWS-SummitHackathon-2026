# BE-03: ProposalHandler — コンポーネントメソッド定義

**レイヤー**: バックエンド API（apps/api）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § BE-03

---

## メソッド定義

```typescript
// サボり提案取得（オンデマンド再評価含む）
GET /api/tasks/:id/proposal
Query:    { stream?: boolean }
Response: Proposal | SSE stream of Proposal delta
```

## SSE ストリーミング詳細

`stream=true` の場合、以下の形式でリアルタイム配信する:

```
data: {"type":"delta","content":"まだ"}
data: {"type":"delta","content":"寝かせ"}
data: {"type":"delta","content":"てOK ☁️"}
data: {"type":"verdict","verdict":"can_saboru"}
data: {"type":"done","proposalId":"xxx"}
```

## 依存サービス

- **AG-02 SaboriProposerAgent** — サボり判定・提案生成
- **DynamoDB Proposals テーブル** — 提案キャッシュ（nextCheckAt が未来なら再利用）

## 関連要件

- FR-03: サボり提案の生成（リアルタイムストリーミング）
- FR-04: バックグラウンド自動再評価
- NFR-01: レイテンシ 3 秒以内（SSE 初回 chunk）

## シーケンス参照

`application-design.md` § 7.2（サボり提案生成フロー）/ § 7.4（バックグラウンド再評価フロー）
