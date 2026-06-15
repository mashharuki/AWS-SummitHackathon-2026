# タスク完了チェックリスト

最終更新: 2026-06-15

## 現在のベースライン
- v2 Inception完了。
- v2 Construction U-V2-01〜09完了。
- 記録上: shared 149 / agent 306 / backend 386 / extension 144 / frontend 464 / cdk 79、約1,528テスト全パス。
- 全package typecheck 0、CDK synth成功、extension dist完全構成。
- 実AWSデプロイと外部キー登録は未完了。

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

## CDK変更時
- [ ] ap-northeast-1前提とcross-region ACM要件を確認。
- [ ] cdk-nag findingsを確認。
- [ ] stack dependencyに循環を作らない。
- [ ] AgentCore L1 schemaを現行aws-cdk-lib 2.232.1に合わせる。
- [ ] `enableAgentCore=false` のデプロイ経路を壊さない。
- [ ] Schedulerは意図せずENABLEDにしない。

## AI-DLC/文書変更時
- [ ] `aidlc-docs/audit.md` に完全なユーザー入力とAI応答を追記する。
- [ ] `aidlc-state.md` を実状態と同期する。
- [ ] plan checkboxを完了と同じinteractionで更新する。
- [ ] 文書は `aidlc-docs/`、コードは `pkgs/`。
- [ ] Mermaid/ASCII図とリンク/パスを検証する。

## デプロイ完了条件
- [ ] AWS credentials/account/region確認。
- [ ] CDK diff確認後に全stack deploy。
- [ ] AgentCore ap-northeast-1対応を実機確認。不可なら無効化。
- [ ] Slack Bot TokenをSecrets Managerへ登録。
- [ ] ElevenLabs Agent ID/API keyを登録（音声を使う場合）。
- [ ] extension `.env.local` にAPI/Cognito/任意のAgentCore/ElevenLabs値を設定。
- [ ] Chromeへdistを読み込み、Cognito login成功。
- [ ] Slack DM検知 → 判定 → 返信案 → クリック/音声承認 → 送信を実機E2E確認。

## 既知の残論点
- AgentCore Gatewayの実リージョン可用性とGateway→Hono認証経路。
- ElevenLabs Side Panelマイク権限の環境差。
- channel @mention判定用 `mySlackUserId` の精度向上。
- 17:00自動進捗報告はScheduleがDISABLED。完全自動化は追加実装が必要。
- Serena project languageがpythonのみと誤認され、TypeScript symbol toolsが使えない。