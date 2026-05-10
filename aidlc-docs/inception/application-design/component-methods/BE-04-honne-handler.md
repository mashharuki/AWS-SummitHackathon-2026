# BE-04: HonneHandler — コンポーネントメソッド定義

**レイヤー**: バックエンド API（apps/api）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § BE-04

---

## メソッド定義

```typescript
// 本音データ記録
POST /api/tasks/:id/honne
Request:  {
  type: 'quick_reply' | 'free_text',
  content: string,    // クイック返信ID or 自由入力テキスト
}
Response: {
  saved: true,
  reply: string,      // サボローの返答メッセージ
  visionText: string  // 「将来の取扱説明書になります」テキスト
}
```

## 依存サービス

- **DynamoDB HonneData テーブル** — 本音データの永続化
- **AG-03 PersonaRenderer** — サボローの返答文を口調変換（オプション）

## 関連要件

- FR-05: 本音データの記録（「本当にやりたくない理由」の入力）
- NFR-07: プライバシー保護（生テキストを別途分析しない）

## シーケンス参照

`application-design.md` § 7.3（本音データ記録フロー）
