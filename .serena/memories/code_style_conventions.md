# コードスタイル・規約

最終更新: 2026-06-15

## 基本
- TypeScript strict を維持し、既存パッケージの設定・パターンに合わせる。
- ルートの主品質ツールは Biome 1.9.4。double quotes、space indent、organizeImports有効。
- frontend には現在 ESLint script/dependencies も残っているため、「ESLint禁止」と決めつけず既存scriptを尊重する。
- package manager は pnpm 10.33.0。workspace依存は `workspace:*`。
- ファイル名は既存慣例に従う: React componentは PascalCase.tsx、hookは `useXxx.ts`、通常moduleは camelCase.ts、testは `.test.ts(x)`。

## アーキテクチャ規約
- アプリコードは `pkgs/`、AI-DLC文書は `aidlc-docs/`。混在させない。
- shared は型、schema、repository interface、純粋utilityを保持し、AWS実装を持ち込まない。
- agent の外部LLM依存は `IBedrockClient` 経由で注入し、Tool Use結果はZodで検証する。
- backend は Hono route factory + repository/service DI を基本とする。routeは `/api/*` にマウントし、外部I/Oをmock可能にする。
- frontend/extension は React function component + hooks。状態と外部副作用を分離する。
- CDK はstack props/exportsで依存を明示し、cdk-nagを維持する。AgentCoreはL1 resource使用。

## v2 固有規約
- v1挙動を非破壊で維持する。`SaboriProposerAgentV2` は既存 `SaboriProposerAgent` を置換しない。
- AgentCore/ElevenLabsに依存しすぎず、Hono API直接呼び出し・クリック承認のフォールバックを保持する。
- Chrome extensionは Manifest V3 CSP に従い、固定Extension IDとPKCE S256認証を壊さない。
- Slack content scriptのselectorは `src/content/selectors.ts` に集約する。
- DOM変更検知はデバウンスと重複防止を維持する。
- 秘密値をコードやcommit対象 `.env` に追加しない。テンプレートは `.env.example`、ローカル値は `.env.local`。

## 型・命名
- interface/typeは意味に応じて既存スタイルを踏襲。DI interfaceには `I` prefixが既にある (`IBedrockClient`)。
- React hookは `use` prefix、component/classは PascalCase、定数は UPPER_SNAKE_CASE。
- string enum相当は既存のconst object + union patternを優先する。
- exportは各packageの `src/index.ts` など既存public APIから行う。

## テスト
- shared/agent/backend/frontend/extension: Vitest。CDK: Jest。
- 外部AWS、Slack、Google、ElevenLabs、Chrome API、Bedrockはmock/DIする。
- 変更対象packageの test + typecheck + buildを最低限実行する。CDK変更は `test` と `synth`。
- agentの `pnpm test` は既存100% coverage thresholdのため、全テストpassでもexit non-zeroになり得る。テスト失敗とcoverage gateを区別して報告する。

## ドキュメント/監査
- 原則日本語。コード識別子は英語。
- `aidlc-docs/audit.md` は追記編集のみ。ユーザー入力を完全な生テキストでISO 8601 timestamp付き記録する。
- AI-DLC planがある場合、完了したcheckboxは同じinteractionで即時更新する。
- Mermaid/ASCII図を作る場合は構文、特殊文字、テキスト代替を検証する。