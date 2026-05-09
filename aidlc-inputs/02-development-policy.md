# 開発方針

**ドキュメント種別**：AI-DLC 入力資料
**最終更新**：2026-05-09
**目的**：本プロジェクトでの開発プロセス・品質基準・運用ルールを明文化し、AI-DLC のすべてのフェーズで遵守する。

---

## 1. 開発プロセスの中核

### 1.1 AI-DLC（AI Driven Development Life Cycle）に準拠

- **本プロジェクトの全開発作業は AI-DLC ワークフローに従う**
- 詳細仕様：`AGENTS.md` および `.aws-aidlc-rule-details/` 配下
- フェーズ：Inception（要件・設計） → Construction（実装・テスト） → Operations（プレースホルダ）
- 各ステージは**ユーザー承認なしで先に進まない**（AI-DLC の規定）
- すべての対話・承認は `aidlc-docs/audit.md` に記録（生入力をそのまま保持）

### 1.2 Spec 駆動開発

- **仕様書（spec）が先、コードが後**
- AI-DLC の成果物（requirements.md / application-design.md / unit-of-work.md）が「仕様書」に相当
- 仕様書未確定のままコードを書かない
- 仕様変更は仕様書を先に更新してからコードに反映

### 1.3 TDD（Test Driven Development）

- **テストを先に書き、テストを通すコードを書く**
- AI-DLC の Code Generation Part 1（Planning）でテスト設計を含める
- カバレッジ目標は AI-DLC の NFR Requirements で確定（暫定：主要ロジック 80% 以上）
- ユニットテスト・統合テストを最低限含める。E2E は余力次第

---

## 2. 利用ツール（開発環境）

| カテゴリ | ツール | 用途 |
|---|---|---|
| **AI コーディング** | Claude Code | 主要開発エージェント |
| **拡張機能** | MCP（Model Context Protocol） | 外部リソース連携 |
| **拡張機能** | Agent SKILL（`.claude/skills/`） | 専門知識の供給 |
| **拡張機能** | Subagent（`.claude/agents/`） | 並列タスク・専門領域委譲 |
| **デザインツール** | Pencil.dev（MCP連携） | UI デザイン → React コード生成。`.pen` ファイルをリポジトリに同居させ、Claude Code が MCP 経由で正確に座標・トークン・構造を読み取りコンポーネント生成。**全画面を Pencil で起こす方針** |
| **CI/CD** | GitHub Actions | 自動ビルド・テスト・デプロイ |
| **コード品質** | Biome | Lint + Format（一元化） |
| **パッケージ管理** | pnpm | モノレポ管理 |

### 2.1 Agent SKILL の活用方針

`.claude/rules/proactive-subagents-and-skills.md` に従い：
- 専門知識タスクでは該当 SKILL を**作業開始前に明示**して使う
- 利用 SKILL とその理由は1行で宣言してから進める
- Subagent と SKILL は併用可

### 2.2 MCP の活用方針

- 外部サービス連携（Slack / Gmail / Notion / Google Calendar）の検証は MCP 経由で実施
- 本番のサーバーサイド連携は AWS Lambda 内で公式 API（OAuth）を使う
- MCP は開発・検証・モック用途、本番ランタイムでは使わない

---

## 3. 品質基準

### 3.1 コード品質

- **Biome 設定で全ファイルが Lint / Format チェックを通る**
- TypeScript strict mode 有効、`any` 原則禁止（unknown を使う）
- マジックナンバー禁止、定数化する
- 関数は単一責務、長すぎる関数はリファクタリング対象

### 3.2 テスト

- 主要ロジック（純粋関数・ビジネスロジック）：ユニットテスト必須
- API ハンドラ：統合テスト必須
- フロント主要画面：最低限のスナップショット or レンダリングテスト
- AI 推論を含む箇所はモック化してロジックをテスト

### 3.3 ドキュメント

- AI-DLC 成果物（`aidlc-docs/`）は**日本語で記述**（`.claude/rules/japanese-output.md` に従う）
- README は日本語、ただしコード内のコメント・識別子は英語可
- 変数名・関数名・ファイル名は英語

### 3.4 セキュリティ

- IAM は最小権限原則（CDK で明示的に絞る）
- シークレットは Secrets Manager / SSM Parameter Store に格納
- API キーをコードにハードコードしない（CI でも検知）
- HTTPS 必須

---

## 4. CI/CD 方針

### 4.1 GitHub Actions のジョブ構成（暫定）

| ジョブ | トリガー | 内容 |
|---|---|---|
| `lint-and-format` | PR / push | Biome チェック |
| `typecheck` | PR / push | TypeScript 型チェック |
| `test` | PR / push | ユニット・統合テスト |
| `build` | PR / push | フロント・バックエンドビルド |
| `cdk-synth` | PR / push | CDK 構文チェック・スナップショット |
| `deploy-staging` | main マージ時 | ステージング環境へ自動デプロイ |
| `deploy-production` | リリースタグ作成時 | 本番環境へデプロイ（手動承認後） |

**詳細は AI-DLC の Build and Test ステージで確定する。**

### 4.2 PR ルール

- `.github/pull_request_template.md` を必ず使う
- すべてのジョブが緑になるまでマージ不可
- レビュー必須（最低1名）
- Squash merge 推奨

### 4.3 Issue 管理

- バグ：`.github/ISSUE_TEMPLATE/bug.md`
- Unit of Work：`.github/ISSUE_TEMPLATE/unit-of-work.md`
- AI-DLC の Units Generation 成果物は Unit of Work issue として登録

---

## 5. ブランチ戦略

| ブランチ | 用途 |
|---|---|
| `main` | 常にデプロイ可能・ステージング自動反映 |
| `feature/*` | 機能開発 |
| `feature/aidlc-*` | AI-DLC ワークフロー進行ブランチ（フェーズごとに分割） |
| `fix/*` | バグ修正 |
| `hotfix/*` | 本番緊急修正 |

- 直接 `main` への push は禁止（PR 経由）
- マージ済みブランチは削除（ローカル＋リモート）

---

## 6. モノレポ運用

### 6.1 構成原則

- **`apps/`**：デプロイ単位（web / api / agent）
- **`packages/`**：再利用ライブラリ（shared 型定義・共通ユーティリティ(ヘルパー関数・定数)）
- **`infra/`**：AWS CDK スタック
- パッケージ間依存は workspace protocol（`workspace:*`）で記述

### 6.2 依存管理

- ルート `package.json` には開発ツールのみ
- 各 app / package は自身の `package.json` を持つ
- 重複依存は pnpm の hoisting で最小化

---

## 7. AI-DLC 各フェーズでの遵守事項

| フェーズ | 遵守事項 |
|---|---|
| **Workspace Detection** | `aidlc-state.md` / `audit.md` を必ず生成 |
| **Requirements Analysis** | 質問は `requirement-verification-questions.md` に集約。回答は `[Answer]:` タグで記入 |
| **Workflow Planning** | 実行フェーズと深さを明示。Mermaid 図で可視化 |
| **Application Design** | コンポーネント分解は `apps/*` 単位を意識 |
| **Units Generation** | 各 Unit of Work は GitHub Issue として登録可能な粒度に分解 |
| **Code Generation** | Part 1（Planning）でテスト設計を含める |
| **Build and Test** | GitHub Actions で自動化される範囲を明記 |

---

## 8. ハッカソン特有の制約

- **MVP の境界を厳守**：Reference.md（`00-business-brief.md`）の MVP 定義を超えない
- **将来展望はデモで触れる程度に留める**
- **審査基準への対応は `aws-summit-hackathon-reviewer` SKILL で随時チェック**

---

## 9. 変更履歴

| 日付 | 変更内容 | 担当 |
|---|---|---|
| 2026-05-09 | 初版作成 | Claude Code |
