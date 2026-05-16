# AWS-SummitHackathon-2026 プロジェクト概要

## 目的
AWS Summit Japan 2026 ハッカソン参加用リポジトリ。
プロダクト名: **SABOROU（サボロー）**
「今どうサボれば一番うまく逃げ切れるか」をAIがリアルタイムに提案するサービス。

- ハッカソン公式URL: https://pages.awscloud.com/summit-japan-2026-hackathon-reg.html

## プロジェクトの状態（2026-05-16 時点）
- **INCEPTION フェーズ: 完了（v1.2.0）**
- **CONSTRUCTION フェーズ: 未着手（コード骨格のみ存在）**
- 書類審査 M1（2026-05-10）: **通過済み**
- MVP デモ M2（2026-05-30）: 目標
- 決勝 M3（2026-06-26）: 最終目標

## リポジトリ構成（モノレポ - pnpm workspaces）
```
/
├── AGENTS.md                   # AIワークフロールール（最優先）
├── CLAUDE.md                   # Claude向けルール参照
├── README.md                   # プロジェクト概要
├── package.json                # ルートパッケージ（Biome + pnpm スクリプト）
├── pnpm-workspace.yaml         # ワークスペース定義
├── biome.json                  # Biome（フォーマット/lint設定）
├── pkgs/
│   ├── backend/                # Hono on Lambda（Lambda ハンドラー）
│   │   ├── src/handler.ts      # Lambda エントリーポイント
│   │   ├── src/index.ts        # Hono アプリ（/health, /doc, /ui）
│   │   └── src/config/openapi.ts  # OpenAPI 定義（SABORO API）
│   ├── cdk/                    # AWS CDK スタック（TypeScript）
│   │   ├── lib/cdk-stack.ts    # CDK スタック（現在は空シェル）
│   │   └── bin/cdk.ts          # CDK エントリーポイント
│   └── frontend/               # React + Vite フロントエンド
│       ├── src/App.tsx         # メインアプリ（現在はスキャフォールド）
│       └── src/main.tsx        # エントリーポイント
├── aidlc-docs/                 # AI-DLCドキュメント（コード置かない）
│   ├── aidlc-state.md          # ワークフロー状態管理
│   ├── audit.md                # 全操作ログ
│   └── inception/              # Inceptionフェーズ成果物
├── aidlc-inputs/               # ビジネス要件・技術決定のインプット
│   ├── 00-business-brief.md
│   ├── 01-tech-stack-decisions.md
│   ├── 02-development-policy.md
│   └── 03-aws-architecture-policy.md
├── .aws-aidlc-rule-details/    # AI-DLCワークフロールール詳細
├── .claude/                    # Claude AI設定（rules/, skills/）
├── .github/                    # GitHub Actions・スキル群
└── .vscode/                    # VS Code設定（MCP含む）
```

## 設計コンセプト
- **表の価値**: AIが「今サボれる理由」を科学的根拠付きで提示
- **裏の価値（人をダメにする）**: AIへの依存で判断力が退化していく二重設計
- Dual-Agent 協調: TaskExtractorAgent（U-03a）+ SaboriProposerAgent（U-03b）
- 社会心理学5理論（CEM・Identifiability・Sucker Effect・SDT・Expectancy Theory）を根拠に採用

## 重要なルール
- AGENTS.md が最高優先度のワークフロールール
- AI-DLCの3フェーズ: INCEPTION → CONSTRUCTION → OPERATIONS
- アプリケーションコードは pkgs/ 配下に配置（aidlc-docs/ には置かない）
- ドキュメントは aidlc-docs/ 配下のみ
- 全出力は日本語（コードコメント・変数名は英語可）
