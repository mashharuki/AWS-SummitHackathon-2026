# 技術スタック決定事項

**ドキュメント種別**：AI-DLC 入力資料
**最終更新**：2026-05-09
**目的**：AI-DLC の Requirements Analysis / Application Design / NFR Requirements で参照する、確定済みの技術スタック決定を一覧化する。

---

## 1. 全体方針

- **モノレポ構成**：フロントエンド・バックエンド・インフラ（CDK）を単一リポジトリで管理
- **TypeScript 統一**：フロント・バック・インフラすべて TypeScript で記述する（学習コスト・型共有・保守性のため）
- **サーバーレスファースト**：常時稼働インスタンスは原則使わない。コンピュートは Lambda を第一選択
- **AWS マネージドサービス優先**：自前運用を避け、AWS のマネージドサービスでまかなえるものはマネージドで構築する

---

## 2. フロントエンド

### 2.1 コア

| 項目 | 採用技術 | 補足 |
|---|---|---|
| フレームワーク | **React** | 関数コンポーネント＋Hooks |
| 言語 | **TypeScript** | strict mode 有効 |
| ビルドツール | **Vite** | 高速 HMR・ESM ネイティブ |
| UI コンポーネント | **shadcn/ui** | プロジェクト内に既存スキルあり（`.claude/skills/shadcn/`） |
| スタイリング | **Tailwind CSS** | shadcn/ui と統合 |
| デザイン → コード変換 | **Pencil.dev（MCP）** | ローカル MCP サーバー経由でClaude Codeが`.pen`ファイルから正確に React コンポーネント生成。**全画面を Pencil で起こす方針**。リポジトリに `.pen` ファイルを同居させデザインとコードを一元管理。 |

### 2.2 3D / インタラクション（Three.js エコシステム）

| ライブラリ | 採用区分 | 用途 |
|---|---|---|
| **`@react-three/fiber` (R3F)** | 採用 | React で Three.js を書くためのラッパー（必須） |
| **`@react-three/drei`** | 採用 | OrbitControls/Loader/Camera 等の便利コンポーネント集 |
| **`@react-three/postprocessing`** | 採用 | サボローの「ぼんやり・夢心地」世界観のフィルター演出 |
| **`@react-three/uikit`** | 採用 | 3D空間内に UI（パネル・ボタン）を浮かせる |
| **`@react-three/rapier`** | 不採用（MVP対象外） | 物理シミュレーションは現状の演出に不要。必要になったら追加 |

### 2.3 2D アニメーション

| ライブラリ | 採用区分 | 用途 |
|---|---|---|
| **Framer Motion** | 採用 | 2D UI（タスクカード遷移・モーダル）の滑らかなアニメーション |
| **Lottie** | 採用 | サボロー（キャラクター）の表情差分・ローディング演出。JSON駆動で軽量 |

### 2.4 未確定事項（AI-DLC で確定する）

- 状態管理ライブラリ（Zustand / Jotai / Redux Toolkit / React Context のみ など）
- ルーティング（React Router / TanStack Router）
- フォームライブラリ（React Hook Form / Conform）
- データフェッチ（TanStack Query / SWR / 自前 fetch）
- Three.js の具体的な使用画面・演出範囲（Application Design で確定）

---

## 3. バックエンド

| 項目 | 採用技術 | 補足 |
|---|---|---|
| フレームワーク | **Hono** | 軽量・Lambda対応・型安全（プロジェクト内に既存スキルあり：`.claude/skills/hono/`） |
| 言語 | **TypeScript** | フロントと型共有可能 |
| 実行環境 | **AWS Lambda**（第一選択） | API Gateway 経由で公開 |
| API スタイル | **REST**（API Gateway HTTP API）想定 | WebSocket は将来のリアルタイム提案更新で検討 |

**未確定事項**：
- バリデーションライブラリ（Zod / Valibot）
- ORM / クエリビルダー（DynamoDB Document Client / Drizzle / Prisma）
- 認証ミドルウェア実装方針（Cognito 直接連携 or 自前 JWT 検証）

---

## 4. AWS サービス選定

詳細は [`03-aws-architecture-policy.md`](./03-aws-architecture-policy.md) を参照。サマリ：

| カテゴリ | 採用候補 | 確定度 |
|---|---|---|
| **コンピュート** | **Lambda（第一選択）** | 第一選択確定。全処理が15分以内に収まる想定のためECS/Fargate不採用方針。判断余地は Application Design で再確認 |
| **API** | API Gateway（REST/HTTP API） | 確定 |
| **データベース** | **DynamoDB（第一選択）** | 第一選択確定。動的JOIN等は不要な想定。Aurora は明確な必要性が出た場合のみ再検討 |
| **AI / LLM** | Amazon Bedrock | 確定 |
| **エージェント基盤** | Strands Agent SDK / Bedrock AgentCore | 検討中 |
| **ホスティング（フロント）** | S3 + CloudFront | 確定 |
| **認証** | Amazon Cognito | 確定 |
| **シークレット管理** | AWS Secrets Manager / SSM Parameter Store | 確定 |
| **モニタリング** | CloudWatch | 確定 |
| **IaC** | AWS CDK（TypeScript） | 確定 |
| **リージョン** | ap-northeast-1（東京） | 確定 |

**Bedrock 利用予定モデル（暫定）**：
- Claude Sonnet 系（コンテキスト読解・自然な日本語応答）
- 具体的なモデル ID とパラメータは Application Design / NFR Requirements で確定

---

## 5. AI / エージェント設計の方向性

### 5.1 全体構成

サボローのコア機能（外部ツール文脈読解 → サボり提案）は **2エージェント協調構成（Dual-Agent）** とする：

```
[外部Webhook / cron]
        ↓
[エージェント①: タスク抽出 (Lambda + Bedrock)]
   - 役割：外部メッセージ → 構造化タスク候補
   - ツール：Slack/Gmail/Notion/Calendar API、必要情報補完判定
        ↓ DynamoDB「タスク候補」
[ユーザー承認 / 修正]
        ↓ DynamoDB「承認済みタスク」
        ↓
[エージェント②: サボり提案 (Lambda + Bedrock)]
   - 役割：タスク + 周辺文脈 → 「なぜ今サボれるか」の提案
   - ツール：文脈収集（Slack温度感、Cal、Gmail）、再判断スケジューラ
   - 人格レンダリング：システムプロンプトに persona テンプレ注入（後述5.3）
        ↓ DynamoDB「提案ログ」
   UI 表示
```

### 5.2 各エージェントの責務

| 項目 | エージェント① タスク抽出 | エージェント② サボり提案 |
|---|---|---|
| **トリガー** | EventBridge（外部Webhook / 定期 cron） | EventBridge スケジュール + ユーザー承認後イベント |
| **入力** | 外部メッセージ（Slack/Gmail/Notion/Cal） | 承認済みタスク + 周辺文脈データ |
| **主要ツール** | 外部API読み込み、タスク候補書き込み、補完質問生成 | 文脈収集（Slack温度感、Cal、Gmail）、提案生成、再判断スケジュール |
| **LLM 呼び出し** | タスク化のための整形＋必要情報判定 | 文脈統合と提案文生成（最大の Bedrock コスト発生源） |
| **書き込み先** | DynamoDB「タスク候補」テーブル | DynamoDB「提案ログ」テーブル |
| **想定実行時間** | 秒〜10秒 | 10〜30秒 |

### 5.3 人格（Persona）設計

**MVP は単一人格（おっとりサボロー想定）で進める。** ただし将来の複数人格化に備えて、以下の構造を採る：

- **判断ロジックと表現を分離**：
  - エージェント②は中立的な判断データ（verdict / reasoning / next_check_at）を内部的に決定
  - その上で persona テンプレを使って表現（口調・語尾・絵文字）を整形
  - 1回の LLM 呼び出し内で判断＋表現を行う（コスト最適化）
- **persona はデータとして外出し**：
  - DynamoDB に `personas` テーブル（または定数）として `persona_id / name / prompt_template / tone` を保管
  - エージェント②呼び出し時に `persona_id` を指定してプロンプトに注入
- **MVP は固定 persona 1つ**：
  - persona ID: `saboru_ottori`（おっとりサボロー）
  - 別 persona 追加は「データを足すだけで実装変更不要」な形にしておく

### 5.4 複数人格化の拡張余地（将来展望）

PMF 後の拡張方向。**MVP では明示的にスコープ外**：

| 軸 | 内容 | MVP 採否 |
|---|---|---|
| **軸A: 口調・トーン** | おっとり / ドS / 関西弁 etc. | データ追加だけで対応可能な構造を確保（MVP は1人格固定） |
| **軸B: 判断スタンス** | 安全派 / ギリギリ派 / 戦略派（複数の判断が並ぶ） | 明示的にスコープ外（拡張時はエージェント②を複製） |
| **軸C: ドメイン専門化** | 仕事用 / 学業用 / 個人用 | 明示的にスコープ外 |
| **軸D: 議論型（Debate / Reflection）** | リスク分析役 + 対立意見役 + 統合役 | 明示的にスコープ外 |

ピッチ・デモでは「単一人格で動かしているが、将来は人格を切り替え可能にする」ことを口頭で言及する程度に留める。

### 5.5 エージェント基盤の選択肢（AI-DLC で確定）

| 候補 | メリット | 検討ポイント |
|---|---|---|
| **Bedrock AgentCore** | マネージド・セッション/メモリ管理付き・複数エージェント協調機能あり | 2エージェント構成と相性良好。最新サービスで知見蓄積中 |
| **Strands Agent SDK** | 軽量・ツール定義が直感的・Python/TS 両対応 | バックエンドがTSなので統一感あり |
| **自前実装（Hono + Bedrock SDK）** | 最大の柔軟性・依存最小 | エージェントの抽象化を自前で書く負担 |

→ Application Design / NFR Requirements で確定する。

### 5.6 共通方針

- **マルチソース文脈収集**：Slack / Gmail / Notion / Google Calendar から MCP（開発時）もしくは公式 API（本番）で情報取得
- **LLM 推論**：Bedrock 経由で Claude を呼び出し
- **データ蓄積**：ユーザーの本音データ（提案への反応・persona 切替履歴）を DynamoDB に蓄積。これが将来の「自分の取扱説明書」のデータ基盤となる

### 5.7 未確定事項（AI-DLC で確定する）

- 外部サービス連携の優先順位（MVP ではどこを実装するか）
- リアルタイム更新の頻度（cron 起動 or イベントドリブン）
- プロンプトキャッシュ・コンテキスト管理戦略
- エージェント基盤の最終選択（Bedrock AgentCore / Strands Agent SDK / 自前実装）
- persona の具体的なプロンプトテンプレ・トーン定義（Application Design で確定）

---

## 6. 開発ツールチェーン

| 項目 | 採用技術 | 補足 |
|---|---|---|
| パッケージマネージャ | **pnpm** | モノレポでの依存管理が高速・ディスク効率良好 |
| Linter / Formatter | **Biome** | ESLint + Prettier の代替。高速・設定が一元化 |
| モノレポツール | **pnpm workspaces**（最低限） + **Turborepo**（候補） | ビルドキャッシュが必要なら Turborepo 追加 |
| テストランナー | **Vitest**（候補） | Vite と統合・高速 |
| E2E テスト | **Playwright**（候補） | フロントの主要シナリオを最低限カバー |
| **デザインツール（MCP連携）** | **Pencil.dev** | ローカルMCPサーバーで Claude Code と連携。`.pen` ファイルをリポジトリに同居させ、デザイン↔コードを双方向同期。shadcn/ui の公式デザインキット対応 |
| CI/CD | **GitHub Actions** | 自動ビルド＆テスト＆デプロイ |
| バージョン管理 | **Git / GitHub** | 本リポジトリ |

**未確定事項**：
- Turborepo を入れるか pnpm workspaces 単体で行くか（AI-DLC で複雑度から判断）
- E2E テストを MVP に含めるか（ハッカソン期限次第）

---

## 7. ディレクトリ構成（暫定案）

詳細は AI-DLC の Application Design / Code Generation で確定するが、以下の方向性：

```
AWS-SummitHackathon-2026/
├── apps/
│   ├── web/              # フロントエンド（React + Vite）
│   └── api/              # バックエンド（Hono on Lambda）
├── packages/
│   ├── shared/           # 型定義・共通ユーティリティ
│   └── agent/            # エージェント実装（Strands or AgentCore）
├── infra/                # AWS CDK スタック
├── aidlc-inputs/         # AI-DLC 入力資料（このディレクトリ）
├── aidlc-docs/           # AI-DLC 成果物（自動生成）
└── .github/workflows/    # GitHub Actions
```

---

## 8. 既存スキル・エージェントとの整合

本リポジトリには `.claude/skills/` 配下に活用可能なスキルが揃っています：

- **`hono`** / **`hono-inertia`**：Hono バックエンド設計・実装支援
- **`shadcn`** / **`baseline-ui`** / **`fixing-accessibility`**：shadcn/ui ベースのフロント構築
- **`aws-cdk-architect`** / **`cdk-aws-diagram`**：CDK 設計・構成図生成
- **`vercel-react-best-practices`**：React 最適化
- **`threejs-*`**（11種）：Three.js 各領域の実装支援
- **`frontend-design`** / **`intentional-design-guard`**：デザイン品質確保
- **`aws-summit-hackathon-reviewer`**：成果物の審査基準レビュー

AI-DLC の Construction フェーズではこれらを積極的に呼び出す。

---

## 9. 変更履歴

| 日付 | 変更内容 | 担当 |
|---|---|---|
| 2026-05-09 | 初版作成 | Claude Code |
