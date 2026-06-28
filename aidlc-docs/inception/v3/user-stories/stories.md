# SABOROU v3 User Stories - MCP Serverization

**作成日**: 2026-06-16
**対象**: 音声AgentによるSABOROU機能呼び出しとSlack `@Claude` 委譲
**方式**: Hybrid - User Journey-Based + Risk-Based

---

## US-V3-01: 音声でタスク一覧を確認する

P-V3-01 として、音声で「今日のタスクを教えて」と言いたい。なぜなら、画面操作なしで現在の負荷を把握し、次に委ねる作業を選びたいから。

**Acceptance Criteria**:

- [ ] Given ユーザーがCognito認証済みである, When ElevenLabs Agentが `saborou_get_tasks` を呼ぶ, Then 認証ユーザーのタスク一覧だけが返る。
- [ ] Given タスク一覧が返った, When Agentが読み上げる, Then タスク名、状態、期限が音声で理解できる短さに要約される。
- [ ] Given 他ユーザーのタスクIDが指定された, When MCPツールが呼ばれる, Then 404または認可エラーになり内容は返らない。

**Traceability**: FR-V3-02, FR-V3-03, FR-V3-06, GAP-V3-03, GAP-V3-04

---

## US-V3-02: 音声でSlack返信案を生成する

P-V3-01 として、Slackメッセージを受けたらSABOROUに返信案を考えてほしい。なぜなら、返信の文面を自分で考えずに済ませたいから。

**Acceptance Criteria**:

- [ ] Given Slackメッセージ本文がある, When Agentが `saborou_judge_sabori` を呼ぶ, Then 返信ドラフトとTTS向け要約が返る。
- [ ] Given サボり判定スコアを返す, When 結果が表示される, Then 固定値ではなく根拠あるスコアまたは「返信ドラフト生成」として明確に扱われる。
- [ ] Given Bedrock生成が遅い, When Agentが応答する, Then 進行中であることをユーザーに伝えられる。

**Traceability**: FR-V3-02, FR-V3-03, FR-V3-07, GAP-V3-07

---

## US-V3-03: 音声承認後にSlackへ返信する

P-V3-01 として、SABOROUの返信案を聞いたあと「いいよ」と言うだけでSlackへ送信したい。なぜなら、返信作業を最小の判断だけで終えたいから。

**Acceptance Criteria**:

- [ ] Given 返信ドラフトが提示済みである, When ユーザーが明示承認する, Then `saborou_send_slack_reply` が1回だけ呼ばれる。
- [ ] Given ユーザー承認がない, When AgentがSlack送信ツールを呼ぼうとする, Then ツール呼び出しは拒否される。
- [ ] Given Slack APIが失敗した, When Agentが結果を返す, Then トークンや内部エラーを含まない安全な要約が返る。

**Traceability**: FR-V3-02, FR-V3-03, NFR-V3-S1, SECURITY-08

---

## US-V3-04: 音声でGoogle/Slack文脈を取り込む

P-V3-01 として、SABOROUにGoogle Calendar、Gmail、Slack履歴から文脈を集めてほしい。なぜなら、タスク判断や返信案を自分で材料集めせず任せたいから。

**Acceptance Criteria**:

- [ ] Given Google連携済みである, When AgentがCalendar statusを取得する, Then busyScoreや空き時間が音声判断に使える形で返る。
- [ ] Given ユーザーが明示承認する, When AgentがCalendar/Gmail fetchを呼ぶ, Then タスク候補抽出が実行される。
- [ ] Given Slack履歴取り込みを呼ぶ, When ユーザーが明示承認する, Then Bot Tokenを使って履歴が取り込まれ、候補化イベントが発行される。
- [ ] Given MCP公開対象を検証する, When OpenAPI allowlistテストを実行する, Then Google/Slack文脈ツールが含まれる。

**Traceability**: FR-V3-02, FR-V3-05, GAP-V3-01, GAP-V3-02

---

## US-V3-05: 音声で選んだタスクをSlack上のClaudeへ委譲する

P-V3-01 として、タスク一覧から任意のタスクを選び、SABOROUにSlack上で `@Claude` へ実行依頼してほしい。なぜなら、自分で依頼文を書かずにタスク実行まで委ねたいから。

**Acceptance Criteria**:

- [ ] Given タスク一覧が読み上げ済みである, When ユーザーがタスクを選択する, Then SABOROUは対象タスクIDを一意に特定する。
- [ ] Given 対象タスクが特定された, When 委譲文を生成する, Then タスクタイトル、背景、期待成果物、制約が含まれる。
- [ ] Given Slack投稿前である, When ユーザーが承認していない, Then `@Claude` メンション投稿は実行されない。
- [ ] Given ユーザーが承認した, When `saborou_delegate_task_to_claude` が呼ばれる, Then 指定チャンネルまたはデフォルトチャンネルへ `@Claude` メンション付き投稿が送られる。
- [ ] Given Slack上のClaudeが実行する, Then SABOROUは投稿成功までを責務とし、Claudeの成果物品質は対象外として扱う。

**Traceability**: FR-V3-04, GAP-V3-06

---

## US-V3-06: AgentCore経由でもユーザー認可を維持する

P-V3-02 として、AgentCore Gateway経由の呼び出しでもHono APIが正しくユーザーを識別してほしい。なぜなら、MCP経由だけ認可が壊れると、他人のタスクやSlack連携にアクセスできてしまうから。

**Acceptance Criteria**:

- [ ] Given AgentCore GatewayがCustom JWTを検証する, When GatewayがHono APIへ到達する, Then Hono APIは信頼できるuserIdを取得できる。
- [ ] Given GatewayがIAM roleでHTTP APIを呼ぶ, When API Gateway JWT Authorizerとの整合を設計する, Then 401にならず、かつJWT認可を弱めない方式が採用される。
- [ ] Given 不正なJWTまたは不正なuserIdで呼ばれる, When MCPツールが実行される, Then データは返らず安全な認証エラーになる。

**Traceability**: FR-V3-06, GAP-V3-03, GAP-V3-04, SECURITY-08

---

## US-V3-07: OpenAPIとMCPツール公開範囲を同期する

P-V3-02 として、MCP公開対象APIがコードとOpenAPIスキーマでズレないようにしたい。なぜなら、ルート追加や変更のたびに音声Agentから呼べる機能が壊れるのを防ぎたいから。

**Acceptance Criteria**:

- [ ] Given AgentCore用OpenAPIスキーマがある, When allowlistテストを実行する, Then 公開すべきoperationIdだけが含まれる。
- [ ] Given Hono APIの実ルートが変わる, When schema同期テストを実行する, Then MCP対象ルートの欠落または古いschemaが検出される。
- [ ] Given OAuth callback、webhook、health、内部管理APIが存在する, When MCP schemaを検査する, Then それらは公開対象から除外される。

**Traceability**: FR-V3-02, FR-V3-05, GAP-V3-01, GAP-V3-02

---

## US-V3-08: ElevenLabs Agentから実MCP経路で呼び出す

P-V3-02 として、ElevenLabs AgentからDashboard登録済みのSABOROU MCPサーバーを呼べることを検証したい。なぜなら、拡張側の仮想 `/mcp/tools/...` 呼び出しやブラウザ `clientTools` だけでは本番デモの動作保証にならないから。

**Acceptance Criteria**:

- [ ] Given SABOROU MCP endpointがある, When ElevenLabs Dashboardに `streamable_http` として登録する, Then `saborou_get_tasks` を実MCP経路で呼べる。
- [ ] Given `streamable_http` 互換性が実検証で成立しない, When fallback設計を選ぶ, Then 同じTool Adapterを利用する `sse` bridgeで登録できる。
- [ ] Given MCP経路が失敗する, When fallbackが発動する, Then Hono API直接呼び出しでデモ継続できる。

**Traceability**: FR-V3-03, GAP-V3-05, GAP-V3-08

---

## US-V3-09: 実接続検証を完了する

P-V3-02 として、実AWS、AgentCore、ElevenLabs Agent、Slackをつないだ検証手順を完了したい。なぜなら、決勝デモではローカル単体テストだけでは不十分だから。

**Acceptance Criteria**:

- [ ] Given AWS環境にAgentCore有効でデプロイ済みである, When Gateway target statusを確認する, Then ACTIVEであることを記録できる。
- [ ] Given ElevenLabs Agentが設定済みである, When 音声でタスク一覧を尋ねる, Then 実AWSのSABOROU API結果が返る。
- [ ] Given Slack送信権限がある, When 音声承認する, Then Slack返信または `@Claude` 委譲投稿が成功する。
- [ ] Given 検証に失敗した, When 手順書を確認する, Then AgentCore、Cognito、Slack、ElevenLabsのどこで失敗したか切り分けられる。

**Traceability**: NFR-V3-R1, NFR-V3-T1, GAP-V3-08

---

## INVEST Compliance Summary

| Story | Independent | Negotiable | Valuable | Estimable | Small | Testable |
|-------|-------------|------------|----------|-----------|-------|----------|
| US-V3-01 | Yes | Yes | Yes | Yes | Yes | Yes |
| US-V3-02 | Yes | Yes | Yes | Yes | Yes | Yes |
| US-V3-03 | Yes | Yes | Yes | Yes | Yes | Yes |
| US-V3-04 | Yes | Yes | Yes | Yes | Medium | Yes |
| US-V3-05 | Yes | Yes | Yes | Yes | Medium | Yes |
| US-V3-06 | Yes | Yes | Yes | Yes | Medium | Yes |
| US-V3-07 | Yes | Yes | Yes | Yes | Yes | Yes |
| US-V3-08 | Yes | Yes | Yes | Yes | Medium | Yes |
| US-V3-09 | Yes | Yes | Yes | Yes | Yes | Yes |
