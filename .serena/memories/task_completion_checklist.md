# タスク完了チェックリスト

最終更新: 2026-06-20

## 現在のベースライン
- v2 Construction U-V2-01〜09完了。
- 2026-06-20 追加実装: MCP全ツール description拡充・`saborou_find_task`新規追加・Slack User Token実装・`slackChannelId`追加・MCP APIキー認証。
- 全package typecheck 0、ビルド成功確認済み（2026-06-20）。
- **未完了**: AWS デプロイ（認証切れ）、Slack App Portal User Token Scope追加、ElevenLabs MCP再接続。

## 未解決タスク（2026-06-20時点）
- [ ] AWS デプロイ: `cd pkgs/cdk && npx cdk deploy SaborouApi-dev SaborouAgent-dev --require-approval never`
- [ ] Slack App Portal → User Token Scopes → `chat:write` 追加
- [ ] ElevenLabs Dashboard → MCP サーバー disconnect → reconnect（スキーマ変更反映）
- [ ] 既存ユーザーの Slack 再 OAuth（User Token 取得のため）
- [ ] O-04: デモデータリセット・E2E シナリオウォークスルー
- [ ] O-05: `evidence/` ディレクトリへの証跡収集
- [ ] O-06: `DEMO_RUNBOOK.md` 最終調整

## コード変更時
- [ ] `git status --short` で既存のユーザー変更を確認し、無関係な変更を戻さない。
- [ ] 対象packageの既存設計・route factory・DI・public exportパターンに合わせる。
- [ ] v1互換性と v2フォールバック経路を維持する。
- [ ] 秘密値や個人情報をcommitしない。
- [ ] 変更対象packageの typecheckを通す。
- [ ] 変更対象packageの unit testを通す。
- [ ] buildを通す。CDKなら build/test/synth、extensionならdist構成も確認する。
- [ ] Biome/既存lintを対象範囲で確認する。
- [ ] shared contractやroute変更なら依存packageも検証する。
- [ ] agent testのcoverage threshold由来exitを、テストケース失敗と混同しない。

## MCP ツール変更時（2026-06-20以降）
- [ ] `pkgs/backend/src/mcp/types.ts` の `McpToolName` union に追加。
- [ ] `pkgs/backend/src/mcp/registry.ts` の `MCP_TOOL_REGISTRY` にエントリ追加。
- [ ] `pkgs/backend/src/mcp/schemas.ts` の `mcpToolInputSchemas` に Zod スキーマ追加。
- [ ] `pkgs/backend/src/routes/mcp-jsonrpc.ts` の `jsonSchemaFor()` に case 追加（パラメータ description も日本語で記述）。
- [ ] HTTP ルートが必要な場合は対応する route ファイルにも追加。
- [ ] **ElevenLabs MCP サーバーを disconnect → reconnect して新スキーマを反映**。

## Chrome extension変更時
- [ ] Manifest V3、CSP、固定Extension IDを維持。
- [ ] `manifest.json`, `panel.html`, `background.js`, `content.js`, `icons/` がdistにある。
- [ ] Cognito PKCE S256とtoken refreshを検証。
- [ ] Slack DOM selector変更は `selectors.ts` に集約。
- [ ] DOM監視のdebounce/重複防止を維持。
- [ ] ElevenLabs未設定でもクリック承認で完走する。
- [ ] AgentCore未使用時もHono API直接呼び出しで完走する。

## Backend/Agent変更時
- [ ] Zod入力検証とエラー応答を維持。
- [ ] Slack/Google/Bedrock/AWS SDKをmockまたはDIする。
- [ ] OpenAPI/operationIdと実routeを同期する。
- [ ] `SaboriProposerAgent` v1を非破壊で維持し、v2追加は `SaboriProposerAgentV2` に閉じる。
- [ ] Slack返信は承認済みドラフトだけを送る。
- [ ] `getSlackUserToken()` を使う箇所は null 時の Bot Token フォールバックを必ず実装する。

## CDK変更時
- [ ] ap-northeast-1前提とcross-region ACM要件を確認。
- [ ] cdk-nag findingsを確認。
- [ ] stack dependencyに循環を作らない。
- [ ] AgentCore L1 schemaを現行aws-cdk-lib 2.232.1に合わせる。
- [ ] `enableAgentCore=false` のデプロイ経路を壊さない。
- [ ] Schedulerは意図せずENABLEDにしない。
- [ ] 新しい Secrets Manager パスを追加した場合は IAM ポリシーも追加する。

## AI-DLC/文書変更時
- [ ] `aidlc-docs/audit.md` に完全なユーザー入力とAI応答を追記する。
- [ ] `aidlc-state.md` を実状態と同期する。
- [ ] plan checkboxを完了と同じinteractionで更新する。
- [ ] 文書は `aidlc-docs/`、コードは `pkgs/`。
- [ ] Mermaid/ASCII図とリンク/パスを検証する。

## デプロイ完了条件
- [ ] AWS credentials/account/region確認。
- [ ] `cd pkgs/cdk && npx cdk deploy SaborouApi-dev SaborouAgent-dev --require-approval never`
- [ ] AgentCore ap-northeast-1対応を実機確認。不可なら `-c enableAgentCore=false`。
- [ ] Slack App Portal → User Token Scopes → `chat:write` 追加。
- [ ] ユーザーが設定画面から Slack 再連携（User Token 取得）。
- [ ] ElevenLabs Dashboard → MCP サーバー disconnect → reconnect。
- [ ] extension `.env.local` にAPI/Cognito/任意のAgentCore/ElevenLabs値を設定。
- [ ] Chromeへdistを読み込み、Cognito login成功。
- [ ] Slack DM検知 → 判定 → 返信案 → クリック/音声承認 → 送信を実機E2E確認。
- [ ] 送信されたメッセージがユーザー自身のアカウントからに見えることを確認（User Token確認）。

## 既知の残論点
- AgentCore Gatewayの実リージョン可用性とGateway→Hono認証経路。
- ElevenLabs Side Panelマイク権限の環境差。
- channel @mention判定用 `mySlackUserId` の精度向上。
- 17:00自動進捗報告はScheduleがDISABLED。完全自動化は追加実装が必要。
- Serena project languageがpythonのみと誤認される場合、TypeScript symbol toolsが使えない。
