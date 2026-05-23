# タスクD+E 設計：AIペルソナ切り替え + 応答の柔軟化

**作成日**: 2026-05-23
**ブランチ**: `feature/persona-switching-and-flexible-ai`
**スコープ**: D（ペルソナ切替）+ E（応答の多様化）を一括
**前提**: C までマージ済み（main d3b749f）

---

## 解決する課題

- **D: AIペルソナを切り替えたい** — フロントに4ペルソナ完成済みだが localStorage 保存のみで、Agent は `saboru_ottori` 固定
- **E: AIの返答が画一的** — 口調変換が単一プロンプト、temperature=0.3 固定

D と E は「ペルソナ別プロンプト＝口調の多様化」で実装が重なるため一括で対応する。

## 現状（実コードで確認済み）

- フロント `staticContent.ts`: 4ペルソナ定義済み（`saboru_ottori`/`saboru_strict`/`saboru_psy`/`saboru_hacker`）。サンプル文言・色も完成。`available: true` は ottori のみ
- フロント `PersonaPage.tsx`: 選択UI完成、localStorage(`saboru_persona_selected`)保存のみ（API未対応と明記）
- `PersonaRenderer.render(input)`: `input.personaId` を**受け取るがプロンプト選択に使っていない**。`SABORU_OTTORI_SYSTEM_PROMPT` 固定、temperature 0.3
- `SaboriProposerAgent`: `propose(taskId, context)` の2箇所で `personaId: DEFAULT_PERSONA_ID` 固定
- `shared`: `DEFAULT_PERSONA_ID = "saboru_ottori"`、Persona型・personas テーブルあり（未使用）
- `User` 型: 好みペルソナのフィールドなし

## 設計

「UIとコンセプトは完成、配線が未接続」。以下を繋ぐ。

### 1. agent: ペルソナ別プロンプト + personaId 分岐（D+E の核）
- `personaRenderTool.ts`: 4ペルソナ分のシステムプロンプトを定義
  - `saboru_ottori`（おっとり・既存）/ `saboru_strict`（鬼コーチ・冷徹）/ `saboru_psy`（心理士・問いかけ）/ `saboru_hacker`（エンジニア・箇条書き）
  - `PERSONA_SYSTEM_PROMPTS: Record<personaId, string>` と `PERSONA_TEMPERATURE: Record<personaId, number>`（E: 多様化。ottori 0.4 / strict 0.2 / psy 0.5 / hacker 0.2 など人格に合わせる）
  - 不明な personaId は ottori にフォールバック
- `PersonaRenderer.render()`: `input.personaId` でプロンプト・temperature を選択
- 判定（Sonnet）の決定論性は維持（temperature 0 のまま）。多様化は**口調生成レイヤのみ**

### 2. agent: SaboriProposerAgent が personaId を受け取る
- `propose(taskId, context, personaId?)` を追加（省略時 DEFAULT_PERSONA_ID）
- 固定の `DEFAULT_PERSONA_ID` を引数の personaId に置換（2箇所）
- streaming 版（`proposeStream` 等があれば）も同様に

### 3. shared: User に preferredPersonaId
- `User.preferredPersonaId?: string`（省略時 DEFAULT_PERSONA_ID 扱い）
- 有効な personaId のバリデーション定数 `VALID_PERSONA_IDS`

### 4. backend: ペルソナ設定 API + propose への反映
- `PUT /api/users/me/persona` { personaId } で User.preferredPersonaId を更新（無効IDは400）
- `GET /api/users/me` のレスポンスに preferredPersonaId が含まれる（型追加で自動）
- proposals ルート（SaboriProposerAgent.propose 呼び出し箇所）で User の preferredPersonaId を取得して渡す
- SaboriProposerLambdaHandler（非同期判定）も payload か User 参照で personaId を解決

### 5. frontend: PersonaPage を API 連携へ
- 選択時 `PUT /api/users/me/persona` を呼ぶ（localStorage はキャッシュ/楽観更新に併用可）
- 初期選択は `user.preferredPersonaId` から復元
- 4ペルソナすべて `available: true` に（バックエンド対応済みのため）

### 6. テスト
- agent: PersonaRenderer の各ペルソナ別プロンプト/temperature 選択・フォールバック。SaboriProposerAgent の personaId 伝播
- backend: PUT persona（成功/無効ID/401）、propose が preferredPersonaId を渡す
- frontend: PersonaPage の API 連携・初期復元
- shared: User 型変更の追従

---

## 設計上の留意点

- **判定の一貫性**: サボり判定（can_saboru/borderline/must_do）は personaId に依存しない。**口調だけ**が変わる（同じ判定を違う人格で受け取る、がコンセプト）。temperature 多様化も口調レイヤ限定。
- **フォールバック**: 不明 personaId・User 未設定は `saboru_ottori`。既存ユーザー互換。
- **絵文字の人格差**: VERDICT_META をペルソナ別にするか検討。MVP は verdict 絵文字共通＋口調で差別化（hacker は絵文字控えめ等はプロンプトで表現）。
- **Proposal への記録**: `Proposal.personaId` に実際に使った personaId を保存（既存フィールド）。
- **デモ価値**: 「同じタスクを4人格で判定」をデモで見せられる。E の多様化と合わせて「画一的でない」を実証。

---

## 実装順序

1. shared: User.preferredPersonaId + VALID_PERSONA_IDS
2. agent: ペルソナ別プロンプト/temperature + PersonaRenderer 分岐 + SaboriProposerAgent personaId 伝播
3. backend: PUT /api/users/me/persona + propose 呼び出しに preferredPersonaId 反映
4. frontend: PersonaPage を API 連携・全ペルソナ available 化
5. テスト追加・全体品質確認（型/カバレッジ100%/Biome悪化なし/CDK synth）
