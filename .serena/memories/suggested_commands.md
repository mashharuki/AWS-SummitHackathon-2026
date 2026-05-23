# 開発コマンド集（2026-05-23 更新）

最終更新: 2026-05-23

## pnpm ワークスペース（ルートから実行）

### テスト（全パッケージ一括）
```bash
pnpm --filter './pkgs/*' test --passWithNoTests
```

### フォーマット・Lint
```bash
pnpm biome:format         # Biome でフォーマット（書き込み）
pnpm biome:format:check   # Biome フォーマットチェックのみ
pnpm biome:check          # Biome 総合チェック（書き込み）
pnpm biome check .        # 直接実行
```

### パッケージ別コマンド
```bash
pnpm --filter backend <script>
pnpm --filter frontend <script>
pnpm --filter cdk <script>
pnpm --filter shared <script>
pnpm --filter agent <script>
```

## 共有パッケージ (pkgs/shared)
```bash
cd pkgs/shared
pnpm build        # tsup でESM/CJS/DTS ビルド
pnpm test         # Vitest（93テスト）
pnpm dev          # tsup ウォッチモード
```

## エージェント (pkgs/agent)
```bash
cd pkgs/agent
pnpm build        # tsup でESM/CJS/DTS ビルド
pnpm test         # Vitest（104テスト）
```

## バックエンド (pkgs/backend)
```bash
cd pkgs/backend
pnpm dev          # ローカル開発サーバー起動
pnpm build        # esbuild バンドル → dist/index.js + dist/webhook.js
pnpm test         # Vitest（172テスト）
```

## フロントエンド (pkgs/frontend)
```bash
cd pkgs/frontend
pnpm dev          # Vite 開発サーバー起動
pnpm build        # tsc + Vite ビルド
pnpm preview      # ビルド成果物プレビュー
pnpm test         # Vitest（126テスト）
pnpm e2e          # Playwright E2Eテスト
```

## CDK インフラ (pkgs/cdk)
```bash
cd pkgs/cdk
pnpm build        # TypeScript コンパイル
pnpm test         # Jest（35テスト）
pnpm cdk synth    # CloudFormation テンプレート生成
pnpm cdk diff     # 変更差分確認
pnpm cdk deploy   # AWS デプロイ（要 AWS 認証情報）
pnpm cdk bootstrap # CDK ブートストラップ（初回のみ）

# Flociローカルテスト用（Docker必要）
./scripts/floci-bootstrap.sh
./scripts/floci-deploy.sh
./scripts/floci-destroy.sh
```

## Slack シークレット登録
```bash
# Secrets Manager へ Slack 資格情報を登録
./scripts/register_slack_secret.sh
```

## 運用確認
```bash
# ログ監視（CloudWatch）
# → aidlc-docs/operations/log-monitoring.md 参照

# Slack App 設定
# → aidlc-docs/operations/slack-app-setup.md 参照

# CDK 操作ガイド
# → aidlc-docs/operations/cdk-operations.md 参照
```

## Git 操作
```bash
git status
git add .
git commit -m "feat: ..."   # Conventional Commits 形式
git push origin main
git pull origin main
```

## テスト合計（2026-05-23 時点）
- shared: 93テスト（カバレッジ100%）
- agent: 104テスト
- backend: 172テスト
- cdk: 35テスト
- frontend: 126テスト + E2E
- **合計: 約530テスト**

## 注意事項
- アプリコードは aidlc-docs/ には置かない（pkgs/ 配下のみ）
- ドキュメントのみ aidlc-docs/ へ
- **pnpm を使う（npm/yarn 禁止）**
- Biome を使う（ESLint/Prettier 禁止）
