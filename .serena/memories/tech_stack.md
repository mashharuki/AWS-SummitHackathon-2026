# 技術スタック

最終更新: 2026-06-15。バージョンは各 `package.json` の現物を優先する。

## 共通
- pnpm `10.33.0` workspace: `pkgs/*`
- Node.js `23` (`.nvmrc`)、Lambda build target は Node.js 22
- TypeScript。パッケージごとに 5.7 / 5.9 / 6.0 系が混在
- ルート品質ツール: Biome `1.9.4`

## shared
- `@saboru/shared` 1.0.0
- Zod `3.23.8`, ulidx
- tsup `8.3.5`, Vitest `2.1.8`, coverage-v8
- ESM/CJS/DTS と subpath exports (`types`, `utils`, `errors`)

## agent
- `@saboru/agent` 1.0.0
- AWS SDK v3: Bedrock Runtime, DynamoDB, Secrets Manager
- Bedrock Converse API + Tool Use、Zod二重検証、依存注入用 `IBedrockClient`
- Agents: TaskExtractorAgent / SaboriProposerAgent / SaboriProposerAgentV2 / SchedulePlannerAgent
- tsup `8.3.5`, Vitest `2.1.8`

## backend
- Hono `4.12.x`、`@hono/node-server`、Swagger UI、Zod validator
- AWS SDK v3、DynamoDB repositories、Cognito JWT、Slack API、Google OAuth/Calendar/Gmail
- esbuild `0.21.x` で `dist/index.js` と `dist/webhook.js` を Node 22 向け生成
- Vitest `4.1.6`

## frontend
- React / React DOM `19.2.6`
- Vite `8.0.12`, TypeScript `6.0.x`, Vitest `4.1.6`, Playwright `1.60`
- Tailwind CSS `4.1.x`
- react-router-dom `7.6.x`
- Three.js `0.177`, react-three-fiber `9.6`, drei `10.7`
- i18next/react-i18next、MSW、vite-plugin-pwa、Workbox
- Cognito: `amazon-cognito-identity-js`
- ゲーミフィケーション、3バンドガント、2D/3Dキャラクター

## Chrome extension
- Manifest V3 / Side Panel / content script / service worker
- React `19.2.6`, Vite `8.0.12`, TypeScript `6.0.x`, Tailwind `4.1.x`, Vitest `4.1.6`
- ElevenLabs `@11labs/client` **0.2.0 固定**
- Chrome Identity API + Cognito Authorization Code PKCE S256
- Slack DOM MutationObserver、入力欄への execCommand + InputEvent フォールバック
- build成果物: manifest.json, panel.html, background.js, content.js, icons

## CDK / AWS
- aws-cdk-lib `2.232.1`, aws-cdk CLI `2.1122.0`, constructs `10.x`, cdk-nag `2.35`
- Jest `29.7`, ts-jest、TypeScript `5.9.x`
- 主なAWSサービス: DynamoDB, Lambda, API Gateway HTTP API, Cognito, S3, CloudFront, Bedrock, Secrets Manager, EventBridge/Scheduler, CloudWatch, SSM, ACM
- AgentCore Gateway は安定版 CDK にL2がないため `AWS::BedrockAgentCore::Gateway` / `GatewayTarget` のL1を使用
- カスタムドメインは任意。CloudFront証明書は us-east-1、API証明書は ap-northeast-1

## 外部統合
- Slack OAuth/Webhook/Web API
- Google OAuth、Calendar、Gmail
- ElevenLabs Conversational AI（任意。未設定フォールバックあり）
- Bedrock AgentCore Gateway MCP（任意。Hono API直接呼び出しフォールバックあり）