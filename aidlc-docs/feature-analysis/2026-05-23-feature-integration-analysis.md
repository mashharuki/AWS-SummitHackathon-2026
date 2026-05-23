# 機能改修バックログ — 整合性分析レポート

**作成日**: 2026-05-23
**対象**: SABOROU（AWS Summit Japan 2026 ハッカソン / テーマ「人をダメにするサービス」）
**目的**: ユーザー提示の8つの改修要望が、現状のコードベースとどれだけ整合するかを実コード調査に基づいて評価し、着手順を決める
**起点ブランチ**: `main`（`a40d09e`）

---

## 現状アーキテクチャ要約（調査で確認した事実）

| レイヤ | 技術 | 主な実装 |
|---|---|---|
| frontend | React 19 + Vite + Tailwind + i18next + react-three/fiber | `pkgs/frontend/src/` — ページ・hooks・cognito連携・MSWモック |
| backend | Hono + AWS SDK v3（Lambda） | `pkgs/backend/src/` — routes / repositories / middleware / services |
| agent | Bedrock（Sonnet 4.6 判定 + Haiku 3.5 口調変換） | `pkgs/agent/src/sabori-proposer/`, `task-extractor/` |
| shared | TypeScript 型 + zod | `pkgs/shared/src/types/`, `enums.ts`, `constants/` |
| cdk | AWS CDK v2（7スタック） | Cognito / Data / Api / Agent / Webhook / Frontend / ConfigDeploy |

**認証**: Cognito Hosted UI（OAuth2 Authorization Code + PKCE）。API Gateway HTTP API v2 の JWT オーソライザーが `sub` を注入（`middleware/auth.ts`）。
**Slack**: 署名検証付き Webhook 受信（`routes/webhooks.ts`）+ OAuth で Bot Token を per-user で Secrets Manager に保存（`routes/auth.ts`）。

---

## 8タスクの整合性評価サマリ

整合性スコア = このプロジェクトの既存設計にどれだけ自然に乗るか（★5=既存基盤あり・低リスク / ★1=大改修・高リスク）

| # | タスク | 整合性 | 既存基盤 | 主作業レイヤ | 依存/順序 |
|---|---|---|---|---|---|
| A | 設定画面にユーザー名・メール表示 | ★★★★★ | UIは表示実装済み（バグ調査） | frontend/backend | 最優先・独立 |
| B | Slack↔Cognito ユーザーIDミスマッチ解消 | ★★★★☆ | User型・ServiceConnection あり | shared/backend | Cの前提 |
| C | Bot Token化手順 + Slackからタスク一覧取得 | ★★★★☆ | Bot Token保存済・SCOPE定義済 | backend/agent/docs | Bに依存 |
| D | AIペルソナ切り替え | ★★★★★ | UI4種定義済・Persona型・テーブルあり | shared/backend/agent/frontend | E と相乗 |
| E | AI応答の柔軟化（画一的回答の改善） | ★★★★☆ | Agent実装あり（temp=0が主因） | agent | Dと同時が効率的 |
| F | Gmail / Google Calendar / Google OAuth連携 | ★★★☆☆ | ServiceConnection拡張可・UI枠あり | 全レイヤ | B/C完了後 |
| G | パスキー認証（ID/PW廃止） | ★★☆☆☆ | Cognito基盤（要大改修） | cdk/frontend | 独立・最後 |

> タスクCはユーザー記述上 1項目だが「Bot Token化手順整備」と「Slackからタスク一覧取得」の2サブタスクを含む。

---

## タスク別 詳細評価

### A. 設定画面にユーザー名・メールアドレスが表示されない【★★★★★ / 最優先・恐らくバグ】

**事実**:
- `SettingsPage.tsx:40-58` は `getDisplayName(user)` と `user.email` を**表示するUIが既にある**。
- `AuthProvider.tsx:73,107` で `getMe()` の結果を `user` にセット。
- backend `routes/users.ts` の `GET /api/users/me` は、name が無ければ Cognito JWT クレーム（`name` / `email`）でフォールバック自己修復する実装あり。
- frontend `cognito.ts:208` の `parseIdToken` も `name ?? cognito:username ?? email` でフォールバック。

**評価**: UIコードは正しい。表示されないなら原因は (1) `getMe()` が user を返せていない / (2) Cognito User Pool の属性マッピング（`name`/`email` が id_token に乗っていない）/ (3) JWTオーソライザーのクレーム名不一致 のいずれか。**コード追加よりデバッグ＝根本原因特定が主作業**。整合性は最高（既存設計に沿う修正）。

**着手内容**: モックモードと実機の両方で `/api/users/me` レスポンスを確認 → 原因レイヤを切り分け → 最小修正。

---

### B. Slack と Cognito のユーザーIDミスマッチ【★★★★☆ / Cの前提】

**事実**:
- `User` 型（`shared/src/types/user.ts`）に **`slackUserId` フィールドが無い**。
- Slack OAuth コールバック（`auth.ts:182-236`）は `access_token` と `team` は取得・保存するが、**`authed_user.id`（SlackのユーザーID）を保存していない**。
- `ServiceConnection` も Slack のユーザーメタデータを持たない。
- TaskExtractor は `event.message.userId` を仮名化（pseudonymize）して保存するため、Cognitoユーザーと突合できない。
- **付随バグ発見**: `auth.ts:87` で `clientId = env.COGNITO_CLIENT_ID`（Slack用なのにCognitoのIDを代入）。実際は `auth.ts:103` で `process.env.SLACK_CLIENT_ID ?? ""` を使うため矛盾コード。要整理。

**評価**: 紐付けの「箱」（ServiceConnection / User）はあるので、フィールド追加とコールバック時の保存ロジックで解決できる。整合性は高い。

**着手内容**: `User` に `slackUserId?` 追加 → OAuthコールバックで `oauth.v2.access` の `authed_user.id` を取得して User へ upsert → 仮名化キーとの突合方針を決定。`auth.ts` の clientId バグも同時整理。

---

### C. Bot Token化手順 + Slackからタスク一覧取得【★★★★☆ / Bに依存】

**事実**:
- Bot Token は **OAuthで取得・Secrets Manager保存済み**（`auth.ts:201-227`、`saborou/slack-bot-token/{userId}`）。
- OAuth SCOPE に `channels:history` 等のメッセージ取得権限が既に定義済み（`auth.ts:31-37`）。
- ただし **Slack API への能動呼び出し（conversations.history / chat.postMessage）は未実装**。
- ContextCollector が Bot Token を取得する仕組みは存在（`agent/context-collector/ContextCollector.ts`）。

**評価**: トークンと権限は揃っているので「Slack API クライアント実装」が主作業。「タスク一覧取得」は `conversations.history → TaskExtractor` パイプラインの新規実装が必要。「Bot Token化手順」はドキュメント整備（README/セットアップ手順に Bot Token スコープ・OAuth再認可手順が抜けている）。インタラクティブ化（chat.postMessage で Slack に返信）も同じクライアント基盤で実現可。

**着手内容**: (1) `SlackClient`（agent or backend共有）実装 (2) Bot Tokenセットアップ手順をドキュメント化 (3) `conversations.history`→タスク化エンドポイント/バッチ。

---

### D. AIペルソナ切り替え【★★★★★ / 整合性最高・Eと相乗】

**事実**:
- frontend に **4ペルソナがサンプル文言込みで定義済み**（`staticContent.ts` PERSONAS）: `saboru_ottori`(available)/`saboru_strict`/`saboru_psy`/`saboru_hacker`。
- `PersonaPage.tsx` に**選択UIが完成**（現状 localStorage 保存のみ・API未対応と明記）。
- `shared/src/types/persona.ts` に Persona型・PersonaType enum（`saboru`/`amayakashi`）あり。
- DynamoDB に personas テーブル定義あり（ただし agent-stack で「MVPスコープ」として権限付与は削除＝**現状未使用**）。
- Agent側 `SaboriProposerAgent.ts:93` は `personaId: DEFAULT_PERSONA_ID` 固定。`PersonaRenderer` の口調プロンプトも単一。

**評価**: 「UIとコンセプトは完成、配線が未接続」という最も整合性の高い状態。`User.preferredPersonaId` 追加 → 永続化API → Agentが動的にpersonaId参照 → PersonaRendererに口調分岐、で繋がる。デモ映えも高い（同じ判定を違う口調で見せられる）。

**着手内容**: `User` に `preferredPersonaId` → 設定保存API → SaboriProposerが参照 → PersonaRendererに4ペルソナ分の口調プロンプト実装 → PersonaPage を localStorage から API 連携へ。

---

### E. AI応答が画一的 → 柔軟に切り替え【★★★★☆ / Dと同時が効率的】

**事実**:
- 判定（SaboriProposerAgent）は `temperature: 0` 固定（`SaboriProposerAgent.ts:174`）＝決定論的。同じ入力→同じ出力。
- 口調変換（PersonaRenderer）は `temperature: 0.3`、`maxTokens: 256`、システムプロンプト単一。
- 心理学シグナルの粒度が粗く（full/partial/minimal × high/low/unknown）、組み合わせが限定的。

**評価**: 「画一的」の主因は temperature=0 と単一プロンプト。判定の一貫性は保ちつつ、口調生成側で多様性を出すのが安全。Dのペルソナ分岐と組み合わせると「人格×温度」で自然にバリエーションが出る。整合性は高いが、判定の決定論性を壊さない設計配慮が必要。

**着手内容**: 口調生成のtemperature調整 + ペルソナ別プロンプト（D相乗）+ 必要に応じ summaryText 生成の自由度向上。判定ロジックの決定論性は維持。

---

### F. Gmail / Google Calendar / Google OAuth連携【★★★☆☆ / B・C完了後】

**事実**:
- バックエンド完全未実装。`SettingsPage.tsx:17-24` と `staticContent.ts` に「Coming Soon」のUI枠だけある。
- `ServiceType` enum は現状 `"slack"` のみ。`connections.ts` の `VALID_SERVICES` も `["slack"]`。
- ServiceConnection の設計自体は per-user × per-service の多サービス対応構造（拡張は自然）。

**評価**: 設計の受け皿はあるが、Google OAuth フロー・Google API クライアント・ContextCollector拡張・Agentへのコンテキスト統合まで縦に全レイヤの新規実装が必要。整合性は中（基盤拡張で乗るが工数大）。Slack連携（B/C）のパターンを再利用できるため、それらの後が効率的。

**着手内容**: `ServiceType` 拡張 → `/auth/google` OAuth（Slackと同パターン）→ Google API（calendar.events / gmail.messages）→ ContextCollectorに統合 → サボり判定コンテキストに会議・メール緊急度を反映。

---

### G. パスキー認証（ID/PW廃止）【★★☆☆☆ / 独立・最後】

**事実**:
- 現状は Cognito Hosted UI の OAuth2（`cognito.ts`、`CognitoStack`）。
- パスキー = WebAuthn。Cognitoでの実現は (1) Managed Login の passkey 機能 (2) カスタム認証フロー(Lambdaトリガー) のいずれかで、**User Pool 設定とフロントの認証フロー両方の改修**になる。

**評価**: UX向上効果は高いが、認証基盤の作り替えに近く影響範囲が最大。他タスクと独立しており、デモ必須度も相対的に低い。リスク管理上、他の整合性高タスクを片付けてから最後に着手すべき。要件次第ではスコープ縮小（パスキー追加のみ・ID/PW併存）も検討。

**着手内容**: Cognito の passkey/WebAuthn 対応方式を確定 → User Pool 設定変更（cdk）→ フロント認証フロー改修。**着手前に方式の意思決定が必要**。

---

## 推奨実行順序（1機能=1ブランチ=1PR、mainから順次マージ）

調査結果に基づく依存関係と「デモ価値 × 低リスク」を踏まえた推奨順:

1. **A**（ユーザー情報表示バグ）— 最優先・独立・恐らく小修正。まず確実な1勝。
2. **B**（Slack↔Cognito ID紐付け）— Cの前提。データモデル基盤。
3. **C**（Bot Token手順 + Slackタスク一覧/インタラクティブ化）— Bの上に乗る。
4. **D**（ペルソナ切り替え）— 整合性最高・デモ映え。`E`と相乗。
5. **E**（AI応答の柔軟化）— Dと同時または直後。判定の決定論性は維持。
6. **F**（Google連携）— B/Cのパターン再利用。縦断実装。
7. **G**（パスキー認証）— 独立・最後。着手前に方式決定。

各タスクは `feature/<task>` ブランチを切り、実装 → テスト → レビュー → mainへマージ → 次タスク、を1つずつ回す。

---

## 横断的な注意点

- **既存テスト資産が厚い**（agent/backend カバレッジ100%目標で運用中）。改修時は対応テストの更新・追加を必須とする。
- **AI-DLCワークフロー準拠**: 各機能は規模に応じてRequirements/設計を軽量に通し、`audit.md` に記録する。
- **AWS制約**（`.claude/rules/aws-constraints.md`）: ap-northeast-1 / サーバーレス / Secrets Manager / 最小権限を維持。
- **シークレット**: Google OAuth・追加トークンは Secrets Manager / SSM 経由（ハードコード禁止）。
- **判定の決定論性**: E/Dで温度を上げる際、サボり判定そのものの一貫性は壊さない（口調レイヤで多様化）。
