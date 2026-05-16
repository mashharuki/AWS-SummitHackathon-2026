# 開発コマンド集（2026-05-16 更新）

## pnpm ワークスペース（ルートから実行）
```bash
# フォーマット・Lint
pnpm biome:format         # Biome でフォーマット（書き込み）
pnpm biome:format:check   # Biome フォーマットチェックのみ
pnpm biome:check          # Biome 総合チェック（書き込み）

# パッケージ別コマンド（--filter を使う）
pnpm --filter backend <script>
pnpm --filter frontend <script>
pnpm --filter cdk <script>

# root package.json のエイリアス
pnpm backend <script>
pnpm frontend <script>
pnpm cdk <script>
```

## バックエンド (pkgs/backend)
```bash
cd pkgs/backend
pnpm dev          # ローカル開発サーバー起動 (tsx, port 3000)
pnpm build        # esbuild でバンドル → dist/index.js
pnpm zip          # dist/index.js → lambda.zip
pnpm deploy       # build + zip + AWS Lambda 更新（aws lambda update-function-code）
pnpm test         # Vitest ユニットテスト
```

## フロントエンド (pkgs/frontend)
```bash
cd pkgs/frontend
pnpm dev          # Vite 開発サーバー起動
pnpm build        # tsc + Vite ビルド
pnpm preview      # ビルド成果物プレビュー
pnpm lint         # ESLint
pnpm test         # Vitest
pnpm e2e          # Playwright E2Eテスト
```

## CDK インフラ (pkgs/cdk)
```bash
cd pkgs/cdk
pnpm build        # TypeScript コンパイル
pnpm watch        # TypeScript ウォッチモード
pnpm test         # Jest テスト（CDK アサーション）
pnpm cdk synth    # CloudFormation テンプレート生成
pnpm cdk diff     # 変更差分確認
pnpm cdk deploy   # AWS デプロイ（要 AWS 認証情報）
pnpm cdk bootstrap # CDK ブートストラップ（初回のみ）
```

## Git 操作
```bash
git status
git add .
git commit -m "feat: ..."   # Conventional Commits 形式
git push origin main
git pull origin main
```

## AWS CLI（Lambda 直接更新）
```bash
# バックエンド deploy コマンド内で実行される
aws lambda update-function-code --zip-file fileb://lambda.zip --function-name hello
```

## AI-DLC ワークフロー関連
- aidlc-docs/ 配下にドキュメントを配置
- aidlc-state.md でワークフロー状態を管理
- audit.md で全操作ログを管理（APPEND ONLY）

## 注意事項
- アプリコードは aidlc-docs/ には置かない（pkgs/ 配下のみ）
- ドキュメントのみ aidlc-docs/ へ
- pnpm 使用（npm や yarn は使わない）
