# 開発コマンド集

最終更新: 2026-06-15。リポジトリルートからの実行を基本とする。

## セットアップ
```bash
pnpm install
node --version        # .nvmrc は 23
pnpm --version        # packageManager は 10.33.0
```

## ルート
```bash
pnpm biome:format:check
pnpm biome:check      # 注意: --write を伴うscript
pnpm shared <script>
pnpm agent <script>
pnpm backend <script>
pnpm frontend <script>
pnpm cdk <script>
pnpm --filter @saboru/extension <script>
```

## パッケージ共通の品質確認
```bash
pnpm --filter @saboru/shared typecheck
pnpm --filter @saboru/shared test
pnpm --filter @saboru/shared build

pnpm --filter @saboru/agent typecheck
pnpm --filter @saboru/agent test
pnpm --filter @saboru/agent build

pnpm --filter backend typecheck
pnpm --filter backend test
pnpm --filter backend build

pnpm --filter frontend typecheck
pnpm --filter frontend test
pnpm --filter frontend build

pnpm --filter @saboru/extension typecheck
pnpm --filter @saboru/extension test
pnpm --filter @saboru/extension build

pnpm --filter cdk build
pnpm --filter cdk test
pnpm --filter cdk synth
```

## ローカル開発
```bash
pnpm --filter backend dev
pnpm --filter frontend dev
pnpm --filter frontend dev:mock
pnpm --filter @saboru/extension dev   # distをwatch rebuild
```

## E2E
```bash
pnpm --filter frontend e2e
```

## Chrome extension
```bash
cp pkgs/extension/.env.example pkgs/extension/.env.local
pnpm --filter @saboru/extension build
# chrome://extensions で pkgs/extension/dist を読み込む
```
固定Extension ID: `klnbcafcphlnmbdbjgmpdjfeimenokmj`。

## CDK
```bash
pnpm --filter cdk diff
pnpm --filter cdk synth
pnpm --filter cdk deploy -- --all
pnpm --filter cdk cdk -- deploy --all -c enableAgentCore=false
pnpm --filter cdk cdk -- deploy --all -c customDomain=true
```
AgentCoreがリージョン未対応なら `enableAgentCore=false`。

## Floci
```bash
pnpm --filter cdk floci:start
pnpm --filter cdk floci:bootstrap
pnpm --filter cdk floci:deploy
pnpm --filter cdk floci:destroy
pnpm --filter cdk floci:stop
```

## Secret / deploy helper
```bash
pnpm register:secret
pnpm deploy:all
```

## 状態確認
```bash
git status --short
git log --oneline --decorate -15
sed -n '1,120p' aidlc-docs/aidlc-state.md
```

## 注意
- agentのtestは既存coverage 100%閾値でexit non-zeroになる場合がある。テスト結果とcoverage結果を分けて確認する。
- `pnpm biome:check` は書き込みを行う。読み取り専用確認には `pnpm exec biome check .` のオプションを明示的に調整する。
- v2実機手順は `aidlc-docs/construction/v2/v2-setup-and-demo-guide.md`。