# U-01: shared — Functional Design 実行計画

**Unit**: U-01: shared  
**ステージ**: Functional Design  
**作成日**: 2026-05-17  
**ステータス**: 成果物生成完了（ユーザー承認待ち）

---

## 実行ステップ

- [x] Step 1: Unit コンテキスト分析（unit-of-work.md / unit-story-map.md 参照）
- [x] Step 2: Functional Design 計画作成（本ファイル）
- [x] Step 3: 質問生成（[Answer]: タグ形式で埋め込み済み）
- [x] Step 4: ユーザー回答収集（2026-05-17T05:00:00Z）
- [x] Step 5: 回答を分析・曖昧さの確認（Q1〜Q10 全回答確認、曖昧さなし）
- [x] Step 6: Functional Design 成果物生成
  - [x] `aidlc-docs/construction/shared/functional-design/domain-entities.md`
  - [x] `aidlc-docs/construction/shared/functional-design/business-rules.md`
  - [x] `aidlc-docs/construction/shared/functional-design/business-logic-model.md`
- [x] Step 7: 完了メッセージ提示
- [ ] Step 8: ユーザー承認待ち
- [ ] Step 9: 承認記録・aidlc-state.md 更新

---

## U-01: shared の Unit コンテキスト

### 責務
全 Unit が依存する共通の型定義・バリデーションスキーマ・ユーティリティを提供する単一責任 Unit。循環依存の防止のため、他 Unit には依存しない。

### 含まれるコンポーネント（設計書より）

| カテゴリ | 内容 |
|---------|------|
| TypeScript 型定義 | `Task` / `TaskCandidate` / `Proposal` / `HonneData` / `Persona` / `User` / `ServiceConnection` / `Verdict` / `QuickReplyType` |
| Zod スキーマ | 全エンティティの入力バリデーションスキーマ |
| DynamoDB リポジトリインタフェース | `ITaskRepository` / `IProposalRepository` / `IHonneRepository` / `IUserRepository` |
| エラークラス | `BedrockTimeoutError` / `TokenExpiredError` / `DynamoWriteFailedError` / `BedrockCostExceededError` |
| ユーティリティ | `generateUlid()` / `toIsoString()` / `guardTokenLimit()` / `pseudonymize()` / `formatDeadline()` / `minutesUntil()` / `isOverdue()` / `countTokens()` |
| 定数 | `VERDICT_TYPE` / `SOURCE_TYPE` / `SERVICE_TYPE` / `MAX_TOKEN_LIMIT` |

### 対応 FR / NFR
- FR-01〜FR-08（全機能要件の型基盤）
- NFR-07（仮名化ユーティリティ）
- NFR-06（トークン制限定数・コスト制御）

---

## 質問リスト（[Answer]: タグ形式）

以下の質問にお答えください。設計書で定義済みの内容については確認を省き、曖昧な点・設計書に未記載の点のみを質問します。

---

### Q1: Task / TaskCandidate の型ヒエラルキー

設計書では `Task` と `TaskCandidate` が別型として定義されていますが、実装上の扱いを確認します。

**A**: TaskCandidate はユーザーが承認前の「候補」状態を表し、承認後に Task になる。  
**B**: TaskCandidate と Task は DynamoDB の同一テーブルで `status` フィールドで区別する。  
**C**: TaskCandidate と Task は完全に独立した別テーブル・別型として実装する。  
**D**: TaskCandidate という独立型は不要で、Task に `status: 'pending' | 'approved' | 'rejected'` を持たせるだけで十分。

[Answer]: 

---

### Q2: Verdict 型の定義

サボり判定（Verdict）の3状態について確認します。

**A**: `'can_saboru'` / `'borderline'` / `'must_do'` の3値 enum（英語キー）  
**B**: `'safe'` / `'caution'` / `'danger'` の3値（信号機メタファー）  
**C**: `'green'` / `'yellow'` / `'red'` の3値（色名）  
**D**: 別の命名規則がある（自由記述）

[Answer]: 

---

### Q3: QuickReplyType の値定義

本音記録のクイック返信4ボタンの値を確認します。

**A**: `'truly_tired'` / `'actually_important'` / `'agree_with_ai'` / `'disagree_with_ai'` の4値  
**B**: `'do_it'` / `'skip'` / `'later'` / `'delegate'` の4値  
**C**: 設計書（user-stories.md / requirements.md）に明示されているため自由記述不要。そちらを参照する。  
**D**: 4値の具体的なラベルは未定で、実装時に決める。

[Answer]: 

---

### Q4: generateUlid() の依存ライブラリ

ULID 生成ユーティリティの実装方針を確認します。

**A**: `ulid` npm パッケージを使用する  
**B**: `ulidx` npm パッケージを使用する  
**C**: `crypto.randomUUID()` で UUID v4 を使い、ULID は使わない  
**D**: 外部ライブラリなしで独自実装する（モノレポの依存を最小化したい）

[Answer]: 

---

### Q5: pseudonymize() の実装方針

NFR-07（プライバシー保護）向けの仮名化ユーティリティについて確認します。Bedrock に送信するコンテキストからユーザー固有情報を除去するために使用します。

**A**: SHA-256 ハッシュ化（`crypto` 標準モジュール使用）で実装する  
**B**: 固定プレフィックス + 連番（例: `user_001`）に置換する簡易実装  
**C**: MVP 段階では pseudonymize() の実装は不要（後回し）。型定義とスタブのみ置く。  
**D**: 別の実装方針がある（自由記述）

[Answer]: 

---

### Q6: エラークラスの継承設計

エラークラスの階層構造について確認します。設計書では `BedrockTimeoutError` / `TokenExpiredError` / `DynamoWriteFailedError` / `BedrockCostExceededError` が列挙されていますが、shared-utils.md では `AppError` 基底クラスが定義されています。

**A**: `AppError extends Error` を基底クラスとし、各エラーはそれを継承する（shared-utils.md の設計通り）  
**B**: `AppError` は使わず、各エラークラスを `Error` から直接継承する（フラット構造）  
**C**: エラークラスは作らず、`ErrorCode` 型 + `AppError` 単一クラスのみで表現する  
**D**: 別の設計がある（自由記述）

[Answer]: 

---

### Q7: リポジトリインタフェースのスコープ

`ITaskRepository` 等のインタフェースに含めるメソッドの範囲を確認します。

**A**: CRUD 操作のみ（`findById` / `save` / `update` / `delete`）を定義する  
**B**: CRUD + DynamoDB GSI クエリ操作（`findByUserId` / `findByStatus` 等）を含める  
**C**: インタフェースは定義するが、メソッド名は後のフェーズ（Code Generation）で詳細化する。今は最低限のシグネチャだけ定義する。  
**D**: リポジトリインタフェースは shared には置かず、U-04 api 側に定義する。

[Answer]: 

---

### Q8: MAX_TOKEN_LIMIT の具体値

Bedrock converse API 呼び出し前のトークンガードで使用する上限値を確認します。

**A**: 8,000 トークン（shared-utils.md の記載通り）  
**B**: 4,000 トークン（コスト最優先）  
**C**: 16,000 トークン（Claude 3 Haiku の上限に近い値）  
**D**: 環境変数で設定可能にし、定数は DEFAULT_MAX_TOKEN_LIMIT = 8000 とする

[Answer]: 

---

### Q9: Persona 型の設計

設計書で言及されている `Persona`（人格A/B: サボらせ人格 / 甘やかし人格）の型設計について確認します。

**A**: `PersonaType = 'sabori' | 'amayakashi'` の enum と、`Persona` 型（id / type / systemPrompt / displayName を持つ）を定義する  
**B**: Persona は文字列の `personaId` のみで表現し、詳細な型は不要  
**C**: MVP では Persona は単一（人格A固定）として、Persona 型自体をシンプルに保つ  
**D**: Persona の型定義はエージェント側（U-03b）で持つべきで、shared には置かない

[Answer]: 

---

### Q10: ServiceConnection 型のフィールド

Slack との連携情報を保持する `ServiceConnection` 型のフィールドを確認します。

**A**: `{ userId, serviceType: 'slack', accessToken, teamId, channelIds, createdAt, updatedAt }` で十分  
**B**: リフレッシュトークン・有効期限も含める（`refreshToken`, `expiresAt`）  
**C**: Slack の Bot Token は Secrets Manager に保存するため ServiceConnection 型にはトークンを持たせず、`secretArn` のみを持つ  
**D**: 別のフィールド構成がある（自由記述）

[Answer]: 

---

## 補足

回答後、以下の成果物を生成します：
1. `aidlc-docs/construction/shared/functional-design/domain-entities.md` — 全エンティティの型定義・フィールド・制約
2. `aidlc-docs/construction/shared/functional-design/business-rules.md` — バリデーションルール・定数・エラーコード定義
3. `aidlc-docs/construction/shared/functional-design/business-logic-model.md` — ユーティリティ関数・インタフェース設計
