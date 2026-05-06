# AWS-SummitHackathon-2026 プロジェクト概要

## 目的
AWS Summit Japan 2026 ハッカソン参加用リポジトリ。
AI-DLC（AI Driven Development Lifecycle）ワークフローを使って、ハッカソンの成果物を開発する。

- ハッカソン公式URL: https://pages.awscloud.com/summit-japan-2026-hackathon-reg.html

## プロジェクトの状態
- 現在は初期セットアップ段階（greenfield）
- AI-DLCインフラ（ルール・スキル・エージェント）は整備済み
- アプリケーションコードはまだ存在しない

## ディレクトリ構成
```
/
├── AGENTS.md           # AIワークフロールール（最優先）
├── CLAUDE.md           # Claude向けルール参照
├── README.md           # プロジェクト概要
├── .aws-aidlc-rule-details/  # AI-DLCワークフロールール詳細
│   ├── common/         # 共通ルール（process-overview, session-continuity等）
│   ├── inception/      # Inceptionフェーズルール
│   ├── construction/   # Constructionフェーズルール
│   ├── extensions/     # 拡張ルール
│   └── operations/     # Operationsフェーズ（プレースホルダー）
├── .claude/            # Claude AI設定
│   ├── agents/         # カスタムエージェント定義
│   ├── skills/         # スキル群（24種類以上）
│   ├── rules/          # ルールファイル
│   └── settings.json   # Claude設定
├── .vscode/            # VS Code設定（MCP含む）
└── .coderabbit.yaml    # CodeRabbit PRレビュー設定（日本語）
```

## 重要なルール
- AGENTS.md が最高優先度のワークフロールール
- AI-DLCの3フェーズ: INCEPTION → CONSTRUCTION → OPERATIONS
- アプリケーションコードはワークスペースルート直下に配置
- ドキュメントは aidlc-docs/ 配下に配置
