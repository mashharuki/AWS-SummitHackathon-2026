# API vs 共有 HTML ギャップ分析

**Unit**: U-06-ui-redesign
**作成日**: 2026-05-20
**参照元**: `pkgs/backend/openapi.yaml` / `/tmp/saborou_src/10_49e19093.js` / `/tmp/saborou_src/08_16ee81b3.js`

---

## 分析方針

「API 側を正とする」原則に基づき、以下の3分類で対応方針を定義する:

- **A: API側を正としてHTMLを変更** — HTML の UI 表現をAPI仕様に合わせる
- **B: ハッカソン後に API 拡張** — MVP では対応せず将来拡張として記録
- **C: フロントでマッピング吸収** — API を変えずにフロント側で変換処理を実装

---

## ギャップ一覧

### GAP-01: verdict 値の不一致

| 項目 | 共有 HTML | API（openapi.yaml） |
|------|----------|------------------|
| verdict 値 | `can_saboru` / `caution` / `danger` | `can_saboru` / `borderline` / `must_do` |

**対応方針**: **C: フロントでマッピング吸収**

`VERDICT_META` 定数のキーを API 値（`can_saboru` / `borderline` / `must_do`）で定義する。
`SaborouCharacter` の内部設定も API 値をキーにした `VERDICT_SVG_CONFIG` を使用する。

```typescript
// フロント側マッピング（HTML の caution/danger は使わない）
const VERDICT_SVG_CONFIG: Record<Verdict, ...> = {
  can_saboru: { weather: "cloud", eyeShape: "sleepy", ... },
  borderline: { weather: "sun_cloud", eyeShape: "thinking", ... },  // 旧 caution に相当
  must_do:    { weather: "lightning", eyeShape: "shocked", ... },   // 旧 danger に相当
};
```

`PsychSignalsCard` の `PSYCH_SIGNAL_PRESETS` も同様に API 値をキーに変更:
```typescript
const PSYCH_SIGNAL_PRESETS: Record<Verdict, ...> = {
  can_saboru: { taskIdentifiability: "low", ... },
  borderline: { taskIdentifiability: "low", ... },
  must_do:    { taskIdentifiability: "high", ... },
};
```

---

### GAP-02: reasoning の型不一致

| 項目 | 共有 HTML | API（openapi.yaml） |
|------|----------|------------------|
| reasoning の型 | `{ text: string; theory: string; source: string }[]` | `string[]` |

**対応方針**: **A: API側を正としてHTMLを変更**

共有 HTML の `ReasonRow` は `{ text, theory, source }` のオブジェクトを前提に「理論名」「情報ソース」を表示するが、
API は `string[]` しか返さない。

- `EvidenceList` コンポーネントは `string[]` をそのまま箇条書きで表示する
- `theory` / `source` のバッジ表示は MVP では実装しない

**将来対応（B）**: API が `reasoning` を構造化オブジェクトで返すように拡張する（v1.1.0 スコープ）。
そのとき `EvidenceList` の props 型を更新する。

```typescript
// 現在の props（API 準拠）
interface EvidenceListProps {
  reasoning: string[];
}

// 将来の props（API 拡張後）
interface EvidenceListProps {
  reasoning: ReasoningItem[];  // { text, theory, source }
}
```

---

### GAP-03: QuickReply の値と表示ラベルのズレ

| 項目 | 共有 HTML | API（openapi.yaml） |
|------|----------|------------------|
| QuickReply 値 | テキスト文字列（任意）をそのまま送信 | `truly_tired` / `actually_important` / `agree_with_ai` / `disagree_with_ai` の固定4値 |
| 共有 HTML のボタンテキスト | verdict に応じて動的に変わる任意テキスト | API 型で固定 |

**対応方針**: **A: API側を正としてHTMLを変更**

QuickReply ボタンは `QuickReplyType`（4固定値）を送信する。
表示ラベルはフロント側で定義する定数（日本語ラベル）を使用する。

```typescript
const QUICK_REPLY_LABELS: Record<QuickReplyType, string> = {
  truly_tired:       "本当に疲れてる",
  actually_important:"実は重要かも",
  agree_with_ai:     "AIに同意",
  disagree_with_ai:  "AIに反対",
};
```

共有 HTML の「verdict に応じてテキストを変える」動的生成（`task.verdict === "can_saboru"` で分岐）は廃止。

---

### GAP-04: PsychSignalsCard のスコアデータ取得元

| 項目 | 共有 HTML | API（openapi.yaml） |
|------|----------|------------------|
| 心理学スコア | ハードコードされたプリセット（`PSYCH_SIGNAL_PRESETS`） | 存在しない（API 未実装） |

**対応方針**: **C: フロントでマッピング吸収**（短期）/ **B: ハッカソン後に API 拡張**（長期）

MVP では verdict 値に対応した静的プリセット値を表示する。

```typescript
// staticContent.ts に定義
export const PSYCH_SIGNAL_PRESETS: Record<Verdict, PsychSignals> = {
  can_saboru: { taskIdentifiability: "low", effortOutcomeExpectancy: "high", perceivedPeerEffort: "low", externalPressureLevel: "low" },
  borderline: { taskIdentifiability: "low", effortOutcomeExpectancy: "unknown", perceivedPeerEffort: "high", externalPressureLevel: "high" },
  must_do:    { taskIdentifiability: "high", effortOutcomeExpectancy: "low", perceivedPeerEffort: "high", externalPressureLevel: "high" },
};
```

将来（v2.0.0）: `GET /api/proposals/:id/signals` エンドポイントを追加し、実際の判定根拠スコアを返す。

---

### GAP-05: ContextCollectingAnimPro の「情報ソース」表示

| 項目 | 共有 HTML | API（openapi.yaml） |
|------|----------|------------------|
| Phase 0 の情報ソース表示 | Slack / Calendar / Gmail の3ソース | 実装は Slack のみ（Gmail/Calendar は v1.1.0） |

**対応方針**: **A: API側を正としてHTMLを変更**

共有 HTML は「Slack / Calendar / Gmail から情報収集中」という演出だが、
現 MVP は Slack 専用。`ContextCollectingAnim` の Phase 0 表示は Slack のみにする。

```typescript
// ContextCollectingAnim 内の sources 定義
const sources = [
  { id: "slack", name: "Slack", color: "#4A154B", icon: "💬", signals: [...] },
  // Calendar / Gmail は v1.1.0 追加時に解放
];
```

---

### GAP-06: ペルソナ切り替え API の不在

| 項目 | 共有 HTML | API（openapi.yaml） |
|------|----------|------------------|
| ペルソナ選択の永続化 | ハードコード（選択は UI 状態のみ） | 存在しない |

**対応方針**: **C: フロントでマッピング吸収**（短期）/ **B: ハッカソン後に API 拡張**（長期）

MVP では `PersonaPage` の選択状態を `localStorage` に保存する（ページリロード後も維持）。
バックエンドへの送信はしない。

将来（v1.1.0）: `PATCH /api/users/me/persona` エンドポイントを追加。

---

### GAP-07: 取説・ロードマップ API の不在

| 項目 | 共有 HTML | API（openapi.yaml） |
|------|----------|------------------|
| ManualScreen のコンテンツ | ハードコード | 存在しない |
| RoadmapScreen のコンテンツ | ハードコード | 存在しない |

**対応方針**: **C: フロントでマッピング吸収**（永続）

ハッカソンスコープではこれらは静的コンテンツとして維持する。
API 化の必要性は低い（マーケティングコンテンツのため CMS が適切）。

---

### GAP-08: confidence スコアの表示

| 項目 | 共有 HTML | API（openapi.yaml） |
|------|----------|------------------|
| `confidence` フィールド | 数値（0〜100）を表示 | openapi.yaml に `confidence` フィールドなし |

**対応方針**: **A: API側を正としてHTMLを変更**

`Proposal` 型（`pkgs/shared/src/types/`）に `confidence` が存在するか確認が必要。
**存在しない場合**: VerdictBox からの confidence バッジ表示は削除する。
**存在する場合**: そのまま使用する。

アクション: `pkgs/shared/src/types/` の `Proposal` 型を確認（実装時に対応）。

---

### GAP-09: PSYCH_THEORIES の「5理論」vs 実装「4理論」

| 項目 | 共有 HTML | 備考 |
|------|----------|------|
| PSYCH_THEORIES | 4理論（Identifiability / Expectancy / Sucker Effect / SDT） | コメントには「5理論」と書いてあるが実際は4つ |

**対応方針**: **C: フロントでマッピング吸収**

フロントの `PSYCH_THEORIES` 定数は共有 HTML の4理論をそのまま使用する。
「5理論からの判定」という説明文はコピーしない（正確に「4理論」と記載）。

---

## PSYCH_THEORIES の扱い（MVP vs 将来）

| 項目 | MVP 対応 | 将来対応（v2.0.0） |
|------|---------|-----------------|
| スコアデータ | 静的プリセット（verdict に応じた固定値） | API から実際の判定スコアを取得 |
| 表示 | シンプルなバー + LOW/HIGH バッジ | 実際のシグナル値でバーを描画 |
| API | なし | `GET /api/proposals/:id/signals` |
| 理論数 | 4理論 | 拡張可能（構造は維持） |

---

## ギャップ対応サマリー

| ギャップ ID | タイトル | 対応方針 | MVP 対応 |
|-----------|---------|---------|---------|
| GAP-01 | verdict 値の不一致 | C: フロントマッピング | フロントの `VERDICT_META` / `VERDICT_SVG_CONFIG` で吸収 |
| GAP-02 | reasoning の型 | A: API を正 | `string[]` のシンプル表示に変更 |
| GAP-03 | QuickReply の固定化 | A: API を正 | 固定4値ボタンに変更 |
| GAP-04 | PsychSignals データ | C: フロントマッピング | 静的プリセット表示 |
| GAP-05 | 情報ソース（Slack 専用化） | A: API を正 | Slack のみ表示 |
| GAP-06 | ペルソナ永続化 | C: フロントマッピング | localStorage 保存 |
| GAP-07 | 取説・ロードマップ API | C: フロントマッピング | 静的コンテンツで確定 |
| GAP-08 | confidence スコア | A: API を正 | 型確認後に判断 |
| GAP-09 | PSYCH_THEORIES 数 | C: フロントマッピング | 4理論で実装 |
