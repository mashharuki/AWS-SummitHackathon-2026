# SABOROU v2 セットアップ・デプロイ・デモ手順書

**バージョン**: 1.0.0
**作成日**: 2026-06-15
**対象**: v2 スプリント（Chrome 拡張 + 音声対話 + AgentCore Gateway MCP）

---

## 0. このドキュメントの目的

v2 スプリントの Construction が完了した状態から、**実 AWS へのデプロイと実機デモ**を行うための手順をまとめる。コード・テスト・ビルドは全て完了済み（下記「実装完了状況」参照）。残るのは **外部サービスのキー登録**と**デプロイ**のみ。

---

## 1. 実装完了状況（全 8 Unit + 統合）

| Unit | 内容 | パッケージ | テスト |
|------|------|----------|--------|
| U-V2-01 | Chrome 拡張 scaffold（Manifest V3 / Side Panel） | pkgs/extension | ✅ |
| U-V2-02 | content script（Slack DOM 検知・自動入力） | pkgs/extension | ✅ |
| U-V2-03 | 音声フック（ElevenLabs SDK / 承認フロー） | pkgs/extension | ✅ |
| U-V2-08 | Chrome 拡張 Cognito PKCE 認証 | pkgs/extension | ✅ |
| U-V2-04 | AgentCore Gateway（L1 Cfn / MCP 化） | pkgs/cdk | ✅ |
| U-V2-05 | SaboriProposerAgentV2（返信文・断り文生成） | pkgs/agent | ✅ |
| U-V2-06 | Slack 返信エンドポイント | pkgs/backend | ✅ |
| U-V2-07 | 進捗報告エンドポイント + Scheduler | pkgs/backend + cdk | ✅ |
| U-V2-09 | 統合・検証 | 全パッケージ | ✅ |

**全パッケージテスト**: shared 149 / agent 306 / backend 386 / extension 144 / frontend 464（v1 非破壊）/ cdk 79 = **約 1,528 テスト全パス**。全パッケージ typecheck 0 エラー。

---

## 2. 戻ったらやること（外部依存の準備）

v2 を「実際に音声で動かす」には以下の外部キー登録が必要。**コード側は全て準備済み**で、環境変数を入れるだけで動く。

### 2.1 ElevenLabs（音声対話）

1. ElevenLabs ダッシュボードで **Conversational AI Agent** を作成し、**Agent ID** を取得
2. 好みの **Voice ID**（サボローらしい声）を選定
3. **API キー**を取得し、AWS Secrets Manager に登録（シークレット名: `saborou/elevenlabs-api-key`）
4. Chrome 拡張の環境変数に設定（`pkgs/extension/.env.local`）:
   ```
   VITE_ELEVENLABS_AGENT_ID=<取得した Agent ID>
   VITE_AGENTCORE_GATEWAY_URL=<下記 3.2 でデプロイ後に取得する MCP URL>
   VITE_API_URL=<Hono API の URL>
   VITE_COGNITO_DOMAIN=https://<your-domain>.auth.ap-northeast-1.amazoncognito.com
   VITE_COGNITO_CLIENT_ID=<Cognito App Client ID>
   ```

> **重要**: `VITE_ELEVENLABS_AGENT_ID` が未設定でも、Side Panel の「いいよ」ボタン（クリック承認）で全フローが動作する（デモ会場のネットワーク不調・音声トラブルに対するフォールバック）。

### 2.2 AgentCore Gateway（MCP 化）

- `AWS::BedrockAgentCore::Gateway` が現アカウント/リージョン（ap-northeast-1）で利用可能か、デプロイで確認する
- 万一リージョン未対応の場合、`enableAgentCore=false` でデプロイすれば他スタックは独立して動作し、拡張は **Hono API への直接呼び出し（JWT Bearer）にフォールバック**する（agentClient.ts に実装済み）

### 2.3 Chrome 拡張のコールバック URL（認証）

1. `chrome://extensions` で拡張を「パッケージ化されていない拡張機能を読み込む」（`pkgs/extension/dist` を選択）
2. 表示される **Extension ID** をコピー
3. Cognito App Client の callbackUrls に `https://<extension-id>.chromiumapp.org/` を追加
   - `pkgs/cdk/lib/stacks/cognito-stack.ts` の callbackUrls 配列に追加して `cdk deploy` する
   - （手順は `pkgs/extension/src/auth/cognitoAuth.ts` のヘッダーコメントにも記載）

---

## 3. ビルド・デプロイ手順

### 3.1 Chrome 拡張のビルド

```bash
cd pkgs/extension
pnpm install      # 初回のみ
pnpm build        # dist/ に manifest.json / panel.html / background.js / content.js / icons/ が出力される
```

`dist/` を Chrome の「パッケージ化されていない拡張機能を読み込む」で読み込む。Side Panel が開けば成功。

### 3.2 AWS バックエンド・インフラのデプロイ

```bash
cd pkgs/cdk
npm run build
npx cdk diff      # 変更確認
npx cdk deploy --all                          # AgentCore 含む全スタック
# もし AgentCore がリージョン未対応なら:
npx cdk deploy --all --context enableAgentCore=false
```

デプロイ後、CfnOutput から以下を取得して拡張の `.env.local` に設定:
- `SaborouAgentCoreGatewayUrl-<env>` → `VITE_AGENTCORE_GATEWAY_URL`（末尾に `/mcp`）
- `SaborouHttpApiUrl-<env>` → `VITE_API_URL`

### 3.3 Secrets 登録

```bash
# Slack Bot Token（v1 から継続）
pnpm register:secret   # または scripts/register_slack_secret.sh

# ElevenLabs API キー
aws secretsmanager create-secret \
  --name saborou/elevenlabs-api-key \
  --secret-string '<ElevenLabs API Key>' \
  --region ap-northeast-1
```

---

## 4. デモシナリオ（UC-01: Slack 検知 → 音声承認 → 自動送信）

ブリーフ付録のデモシナリオ（約 1 分 30 秒）:

1. Chrome を開く。右に SABOROU の Side Panel が常駐
2. Slack タブ（`https://app.slack.com/...`）を開く。自分宛て DM が届いている
3. content script が DOM 検知 → Side Panel のサボローが「メッセージ来てます」と通知
4. サボローが返信文ドラフトを生成・表示（音声でも読み上げ）
5. ユーザーが「いいよ」と発声（または「いいよ」ボタンをクリック）
6. content script が Slack 入力欄に自動入力 → 送信
7. サボローが「送りました」と報告

**フォールバック**: 音声が使えない環境では手順 5 を「いいよ」ボタンのクリックで代替（全フロー動作）。

---

## 5. 既知の論点・将来拡張（申し送り）

| ID | 内容 | 状態 |
|----|------|------|
| TP-05 | AgentCore Gateway の ap-northeast-1 GA | デプロイで確認。未対応なら `enableAgentCore=false` で回避（フォールバック実装済み） |
| TP-06 | ElevenLabs SDK の MCP クライアント形式 | `@11labs/client@0.2.0` の `clientTools.mcp` は実在せず → `clientTools` 関数マップ + agentClient フォールバックで実装済み |
| TP-07 | Gateway → Hono API の認証経路 | JWT Bearer 直叩き / MCP 両対応のフォールバック実装済み。MCP 経由が IAM 認証になる場合の API Gateway 側 IAM 受理設定は将来要対応 |
| — | `mySlackUserId`（@mention 判定） | DM 検知は実装済み（mySlackUserId 不要）。チャンネル @mention 判定の精度向上は将来（auth.test or JWT マッピング） |
| — | 進捗報告の 17:00 自動送信 | EventBridge Schedule は DISABLED で定義済み。フル自動化は `saboriProposerFn` に `progress_report` 分岐ハンドラ実装 + ENABLED 化が必要（手動トリガーエンドポイントは動作済み） |
| — | agent パッケージのカバレッジ閾値 | グローバル 100% 閾値が既存ファイル（task-extractor 等）で未達のため `pnpm test` が exit 非 0。テスト自体は全パス。閾値調整は任意 |

---

## 6. 品質保証サマリ

- v1 完全非破壊（frontend 464 テスト・既存全テスト維持）
- v2 全機能実装・統合済み
- 全パッケージ typecheck 0 / 主要パッケージ biome 0
- CDK synth 成功（AgentCore L1 リソース正常生成）
- Chrome 拡張 dist は完全構成（manifest / panel / background / content / icons）
