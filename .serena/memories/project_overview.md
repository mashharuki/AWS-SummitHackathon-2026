# AWS-SummitHackathon-2026 プロジェクト概要

最終更新: 2026-05-23

## 目的
AWS Summit Japan 2026 ハッカソン参加用リポジトリ。
プロダクト名: **SABOROU（サボロー）**
「今どうサボれば一番うまく逃げ切れるか」をAIがリアルタイムに提案するサービス。

- ハッカソン公式URL: https://pages.awscloud.com/summit-japan-2026-hackathon-reg.html

## プロジェクトの状態（2026-05-23 時点）
- **INCEPTION フェーズ**: 完了（v2.2.0）
- **CONSTRUCTION フェーズ**: 全Unit完了（U-01〜U-06 + UIリデザイン）
- **OPERATIONS フェーズ**: 運用ドキュメント作成済み
- 書類審査 M1（2026-05-10）: **通過済み**
- MVP デモ M2（2026-05-30）: **次の目標**
- 決勝 M3（2026-06-26）: 最終目標

## 最新実装状況（2026-05-23）
- **Slack 実連携**: 完了（OAuth + Webhook + シークレット登録スクリプト）
- **PWA 化**: 完了（service worker / manifest、public/mockServiceWorker.js）
- **多言語対応**: 完了（pkgs/frontend/src/i18n.ts）
- **レスポンシブデザイン**: 対応完了
- **UI**: ネオブルータリズム + Three.js 3D/2D 共存設計
- **Bedrock モデル呼び出し**: 修正済み（claude-3-5-sonnet / Haiku）
- **ロゴ/バナー**: 追加済み（public/banner.svg, favicon.svg）
- **モックデータ削除**: 完了（実 API 接続）
- **Playwright E2E**: エラー修正済み

## リポジトリ構成（モノレポ - pnpm workspaces）
```
/
├── AGENTS.md                   # AIワークフロールール（最優先）
├── CLAUDE.md                   # Claude向けルール参照
├── README.md                   # プロジェクト概要
├── package.json                # ルートパッケージ（Biome + pnpm スクリプト）
├── pnpm-workspace.yaml         # ワークスペース定義
├── biome.json                  # Biome（フォーマット/lint設定）
├── scripts/
│   └── register_slack_secret.sh  # Secrets Manager へのSlack資格情報登録スクリプト
├── pkgs/
│   ├── shared/                 # 共有型・ユーティリティ（ESM/CJS/DTS）
│   ├── agent/                  # Bedrockエージェント（task-extractor + sabori-proposer）
│   ├── backend/                # Hono on Lambda（REST API + Slack Webhook）
│   ├── cdk/                    # AWS CDK 6スタック（TypeScript）
│   └── frontend/               # React 19 + Vite + Three.js + PWA + i18n
├── aidlc-docs/                 # AI-DLCドキュメント（コード置かない）
│   ├── aidlc-state.md          # ワークフロー状態管理（最新: v2.2.0）
│   ├── audit.md                # 全操作ログ
│   ├── inception/              # Inceptionフェーズ成果物
│   ├── construction/           # Constructionフェーズ成果物（U-01〜U-06）
│   └── operations/             # 運用ガイド（CDK・バックエンド・フロントエンド・Slack設定）
├── aidlc-inputs/               # ビジネス要件・技術決定のインプット
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

## CDK スタック構成（6スタック）
1. DataStack — DynamoDB テーブル群
2. StorageStack — S3バケット
3. CognitoStack — Cognito UserPool + Slack OAuth
4. ApiStack — API Gateway + Lambda (Hono)
5. AgentStack — Lambda (Bedrock Agent)
6. FrontendStack — CloudFront + S3

## 重要なルール
- AGENTS.md が最高優先度のワークフロールール
- AI-DLCの3フェーズ: INCEPTION → CONSTRUCTION → OPERATIONS
- アプリケーションコードは pkgs/ 配下に配置（aidlc-docs/ には置かない）
- ドキュメントは aidlc-docs/ 配下のみ
- 全出力は日本語（コードコメント・変数名は英語可）
- AWSリージョン: ap-northeast-1（東京）固定
