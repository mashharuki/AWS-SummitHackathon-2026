# ビルド手順書

## 概要

SABOROUモノレポ（pnpm@10.33.0 / Node v23 / Biome 1.9.4）の全パッケージビルド手順。
パッケージは依存順に以下の順序でビルドする。

---

## 前提条件

- Node.js v23 以上
- pnpm v10.33.0 以上
- AWS CLI（CDK synth の場合）

---

## ステップ 1: 依存関係インストール

```bash
# ワークスペースルートで実行
pnpm install
```

正常終了後に表示される出力:
```
Done in Xms using pnpm v10.33.0
```

---

## ステップ 2: 共有ライブラリ（@saboru/shared）ビルド

他のパッケージが依存するため、最初にビルドする。

```bash
pnpm --filter @saboru/shared build
```

成果物:
- `pkgs/shared/dist/index.js` (ESM)
- `pkgs/shared/dist/index.cjs` (CJS)
- `pkgs/shared/dist/index.d.ts` (型定義)
- サブエントリ: `types/`, `utils/`, `errors/`

---

## ステップ 3: エージェントパッケージ（@saboru/agent）ビルド

@saboru/shared に依存するため、Step 2 の後に実行する。

```bash
pnpm --filter @saboru/agent build
```

成果物:
- `pkgs/agent/dist/index.js` (ESM)
- `pkgs/agent/dist/task-extractor/TaskExtractorLambdaHandler.js`
- `pkgs/agent/dist/sabori-proposer/SaboriProposerLambdaHandler.js`

---

## ステップ 4: バックエンド（backend）ビルド

@saboru/shared と @saboru/agent に依存するため、Step 2-3 の後に実行する。

```bash
pnpm --filter backend build
```

内部処理:
1. `build:clean` — dist/ を削除
2. `build:api` — esbuild で src/handler.ts をバンドル（286.7kb）
3. `build:webhook` — esbuild で src/webhook-handler.ts をバンドル（76.7kb）

成果物:
- `pkgs/backend/dist/index.js` — API Lambda ハンドラ
- `pkgs/backend/dist/webhook.js` — Webhook Lambda ハンドラ

---

## ステップ 5: フロントエンド（frontend）ビルド

```bash
pnpm --filter frontend build
```

内部処理:
1. `tsc -b` — TypeScript 型チェック
2. `vite build` — プロダクションバンドル生成

成果物: `pkgs/frontend/dist/`

注意: three-vendor チャンク（822.82kb）がチャンクサイズ警告を出すが、
これは Three.js の性質上許容範囲内（gzip 後 217.87kb）。

---

## ステップ 6: CDK（cdk）ビルド

```bash
cd pkgs/cdk && npm run build
# または
pnpm --filter cdk build
```

内部処理: `tsc` — TypeScript を JavaScript にコンパイル

成果物: `pkgs/cdk/` 配下の各 `.js` ファイル

---

## ステップ 7: CDK synth（任意 — デプロイ前確認用）

```bash
cd pkgs/cdk && npx cdk synth
```

正常終了時: `Errors=0`、cdk-nag 全ルール準拠確認

---

## 全パッケージ一括ビルド

```bash
# 依存順序を考慮した一括ビルド
pnpm --filter @saboru/shared build && \
pnpm --filter @saboru/agent build && \
pnpm --filter backend build && \
pnpm --filter frontend build && \
cd pkgs/cdk && npm run build
```

---

## Biome フォーマットチェック

```bash
# チェックのみ（修正なし）
pnpm run biome:format:check

# 自動修正
pnpm run biome:format
```

---

## 型チェック

```bash
# shared
pnpm --filter @saboru/shared exec tsc --noEmit

# agent
pnpm --filter @saboru/agent exec tsc --noEmit

# backend
pnpm --filter backend typecheck

# frontend
pnpm --filter frontend typecheck

# cdk（build と同義）
cd pkgs/cdk && npm run build
```
