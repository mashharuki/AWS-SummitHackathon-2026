# AI-DLC 入力資料ディレクトリ

このディレクトリは、**AI-DLC（AI Driven Development Life Cycle）ワークフローへの入力資料**を集約する場所です。

## このディレクトリの目的

AI-DLC ワークフローを実行するとき、AI（Claude Code）はこのディレクトリ配下のファイルをすべて読み込み、Inception フェーズ（特に Requirements Analysis / Workflow Planning）の入力として活用します。

チームメンバーが「**何を入力に AI-DLC を走らせたか**」を一目で確認できるよう、入力資料はすべてここに集約しています。

## 成果物との分離

| ディレクトリ | 役割 |
|---|---|
| `aidlc-inputs/`（このディレクトリ） | **入力**：AI-DLC が読み込む元情報（人間が事前に整理したもの） |
| `aidlc-docs/` | **成果物**：AI-DLC が生成するドキュメント（requirements.md / user-stories.md / application-design.md / unit-of-work.md など） |
| `.claude/rules/` | **実行時ガードレール**：Claude Code が毎回自動で読み込む制約・ルール |

## ファイル一覧

| ファイル | 内容 | ステータス |
|---|---|---|
| [`00-business-brief.md`](./00-business-brief.md) | サボロー企画書（プロダクトの本質・MVP・将来展望） | 確定 |
| [`01-tech-stack-decisions.md`](./01-tech-stack-decisions.md) | 技術スタック決定事項（フロント・バック・AWS・AI） | 確定 |
| [`02-development-policy.md`](./02-development-policy.md) | 開発方針（AI-DLC・Spec駆動・TDD・CI/CD・モノレポ） | 確定 |
| [`03-aws-architecture-policy.md`](./03-aws-architecture-policy.md) | AWS アーキテクチャ方針（サーバーレス優先・IaC=CDK） | 確定 |
| [`mockups/`](./mockups/) | ビジネス側から提供された UI モック（タスク一覧・タスク詳細＋チャット） | 確定 |
| [`ui/`](./ui/) | Pencil MCPを使って作成した全画面分のUIデザイン | 編集前 |

## 使い方（AI-DLC 開始時）

AI-DLC の Workspace Detection 〜 Requirements Analysis を開始するときは、AI に以下を指示します：

> `aidlc-inputs/` 配下のすべてのファイルを読み込み、AI-DLC の Inception フェーズを開始してください。

これにより、AI は企画書・技術スタック・開発方針・AWS 方針を統合的に理解した状態で、Requirements Analysis（要件定義）を進めます。

## 更新ルール

- **入力資料の更新は必ずレビューを通す**：このディレクトリの変更は AI-DLC の出力に直接影響するため、PR でレビューする
- **AI-DLC 実行中は変更しない**：ワークフロー進行中に入力が変わると整合性が崩れる
- **将来追加するなら番号順**：`05-xxx.md`, `06-xxx.md` のように追番で追加

## 補足：AI-DLC 公式仕様との関係

AI-DLC 公式（`.aws-aidlc-rule-details/`）は**入力資料の配置場所を規定していません**。本プロジェクト独自に「入力と成果物の明確な分離」を目的としてこのディレクトリを設けています。

AI-DLC ワークフロー自体は `.aws-aidlc-rule-details/` のルールに準拠して実行されます。
