# AI Auto Result Chat Formatting Requirements

## Intent Analysis
- **User request**: 「AI自動欄のタスクの実行結果をチャットに綺麗な形で整形して表示する」
- **Request type**: Enhancement
- **Scope estimate**: Single extension panel flow
- **Complexity estimate**: Simple

## Functional Requirements
- AI自動（`saboru`）サブタスクの実行完了時、余白タブのチャットに実行結果を表示する。
- チャット本文には、完了したサブタスク名、対象ゴール、成果物、所要時間、次の進め方を含める。
- 既存の手動チャット、進捗報告チケット、Slack DOM送信フローは変更しない。
- 同じサブタスク完了イベントで同じ結果メッセージを重複投稿しない。

## Non-Functional Requirements
- 新規バックエンドAPI、ストレージ、IAM、外部通信は追加しない。
- 既存のSABOROUサイドパネルの密度、色、チャットUIに合わせる。
- 改行を含む結果文がチャット内で読みやすく表示される。

## Extension Compliance
- Security baseline: N/A for new network/security boundary. Existing API/auth boundaries are unchanged.
- Property-based testing: N/A for deterministic UI formatting; focused regression test is sufficient.
