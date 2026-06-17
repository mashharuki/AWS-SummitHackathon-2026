# SABOROU 決勝デモ ランブック (Run Book)

**決勝日時**: 2026年6月26日 @幕張メッセ メインステージ
**プレゼン時間**: 15分（デモ含む）
**対応NFR**: NFR-V305-R4 (High), NFR-V305-A2 (High)

---

## デモ構成（推奨タイムライン 15分）

```
[0:00-2:00]  コンセプト説明 — 「人をダメにする」の意味・SABOROU の世界観
[2:00-9:00]  メインデモ    — ElevenLabs 音声エージェントで 3 ツールを実演
[9:00-12:00] 技術・AI-DLC  — AWS 構成図 + AI-DLC サイクルの学び
[12:00-14:00] ビジネス展望  — 継続利用設計・収益モデル
[14:00-15:00] まとめ        — 「また使いたくなる」設計の言語化
```

---

## 事前準備（デモ 30 分前）

### Step 1: AWS デプロイ状態確認

```bash
# AgentCore Gateway が AVAILABLE であることを確認
AWS_REGION=ap-northeast-1 \
AGENTCORE_GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name SaborouStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreGatewayId`].OutputValue' \
  --output text) \
./scripts/verify-agentcore.sh
```

期待結果: `[RESULT] PASS — AgentCore Gateway は AVAILABLE 状態です`

問題発生時: `TROUBLESHOOTING.md` の「AgentCore Gateway」セクションを参照

### Step 2: デモデータリセット

```bash
# DynamoDB のデモユーザーデータをクリーンアップ
AWS_REGION=ap-northeast-1 \
DEMO_USER_ID=demo-user-01 \
TASKS_TABLE=$(aws cloudformation describe-stacks \
  --stack-name SaborouStack \
  --query 'Stacks[0].Outputs[?OutputKey==`TasksTableName`].OutputValue' \
  --output text) \
PROPOSALS_TABLE=$(aws cloudformation describe-stacks \
  --stack-name SaborouStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ProposalsTableName`].OutputValue' \
  --output text) \
./scripts/demo-reset.sh
```

期待結果: タスク一覧が空になっていることをブラウザで確認

### Step 3: ElevenLabs Agent ウォームアップ

```bash
# ElevenLabs Conversational AI Agent をウォームアップ
# ブラウザで ElevenLabs Widget を開き、テスト音声を送信する
# 「テスト」と話しかけて応答が返ることを確認
```

チェック項目:
- [ ] ElevenLabs Agent が応答する
- [ ] 音声認識が日本語を正しく認識する
- [ ] ブラウザのマイク権限が許可されている

---

## メインデモシナリオ（7分）

### Step 1: ElevenLabs 音声エージェント起動

操作手順:
1. ブラウザで SABOROU UI を開く
2. 画面右下の ElevenLabs ウィジェットをクリック
3. マイクボタンをクリックして会話開始

台本:
> 「SABOROUを起動します。これが、人を究極にダメにするAIエージェントです。」

### Step 2: saborou_get_tasks — タスク取得 E2E

対応NFR: NFR-V305-E1 (Critical)

音声入力: 「今日やるべきタスクを見せて」

期待動作:
1. ElevenLabs が音声を認識
2. `saborou_get_tasks` ツールが呼び出される
3. DynamoDB からタスク一覧を取得
4. AI が「今日のタスクは〇〇件です。全部 SABOROU に任せますか？」と回答
5. タスク一覧が画面に表示される

アピールポイント:
- 「音声だけでタスク管理が完了。これが "人をダメにする" の始まりです」

証拠ファイル: スクリーンショットを `evidence/E1-get-tasks-e2e/` に保存

### Step 3: saborou_reply_to_slack — Slack 返信 E2E

対応NFR: NFR-V305-E2 (High)

音声入力: 「Slackの田中さんへのメッセージに返信して」

期待動作:
1. `saborou_reply_to_slack` ツールが呼び出される
2. Slack Webhook 経由でチャンネルに返信が送信される
3. AI が「Slackに返信しました。もう自分でタイプしなくて大丈夫です」と回答
4. スクリーンで Slack チャンネルに返信が届いていることを表示

アピールポイント:
- 「Slack の返信も音声1言で完了。腕がどんどん衰えます」

証拠ファイル: スクリーンショットを `evidence/E2-slack-reply/` に保存

### Step 4: saborou_delegate_to_claude — Claude 委譲 E2E

対応NFR: NFR-V305-E3 (High)

音声入力: 「この企画書のレビューをClaudeに頼んで」

期待動作:
1. `saborou_delegate_to_claude` ツールが呼び出される
2. Claude への委譲リクエストが送信される
3. Claude からのレビュー結果が返ってくる
4. AI が「Claudeがレビューしてくれました。あなたは何もしなくて大丈夫です」と回答

アピールポイント:
- 「AIがAIに仕事を頼む。人間はただ聞いているだけ。最高の"ダメになる"体験です」

証拠ファイル: スクリーンショットを `evidence/E3-delegate-to-claude/` に保存

---

## フォールバック A: ElevenLabs MCP 接続失敗時

**発動条件**: ElevenLabs から `saborou_get_tasks` が呼び出せない状態
**切り替え時間目標**: 30秒以内

手順:
1. 「デモ環境の切り替えを行います（30秒いただきます）」とアナウンス
2. Chrome 拡張の SABOROU Panel を開く（事前にピン留め済みであること）
3. Chrome 拡張の clientTools モードで `saborou_get_tasks` を手動実行
4. Chrome 拡張経由でデモを続行

```javascript
// Chrome 拡張の devtools console で直接実行する場合
chrome.runtime.sendMessage({
  type: 'CALL_TOOL',
  tool: 'saborou_get_tasks',
  args: { limit: 5 }
}, (response) => console.log(response));
```

チェック項目:
- [ ] Chrome 拡張がインストール済み（決勝会場のPCで事前確認）
- [ ] Chrome 拡張が SABOROU API と接続できる
- [ ] 拡張の popup が正常に開く

証拠ファイル: フォールバック実施記録を `evidence/R4-fallback/fallback-a-log.txt` に保存

---

## フォールバック B: Chrome 拡張全面失敗時

**発動条件**: Chrome 拡張も含めて全て失敗する最悪ケース
**切り替え時間目標**: 60秒以内

手順:
1. 「バックアップデモに切り替えます」とアナウンス
2. 事前に録画した動画ファイルを再生（ローカルに保存済みであること）
3. または Web UI（React フロントエンド）を直接操作してデモを続行

Web UI 手動デモの流れ:
1. ブラウザで `https://<CloudFront-URL>` を開く
2. 「タスクを取得」ボタンをクリック → タスク一覧表示
3. タスクを選択し「Slackに返信」ボタンをクリック
4. 「Claudeに委譲」ボタンをクリック → 結果表示

準備確認:
- [ ] 動画バックアップファイルがローカル保存済み（`/Users/.../demo-backup.mp4`）
- [ ] Web UI の公開 URL が手元にメモされている
- [ ] ブラウザで Web UI にログイン済みのタブが開いている

証拠ファイル: フォールバック実施記録を `evidence/R4-fallback/fallback-b-log.txt` に保存

---

## Q&A 準備（審査員別）

### 塚田朗弘さん（AWS SA本部長）向け

**想定Q**: スタートアップとして実際にリリースするなら最初の課題は何ですか？

**準備回答**: 
「最大の課題は ElevenLabs との API コスト管理です。現在は従量課金ですが、月間アクティブユーザーが増えると音声合成コストが線形に増加します。Whisper を AWS 上で自己ホストするか、Lambda の Provisioned Concurrency で Cold Start を排除するかを判断するタイミングが最初の分岐点だと考えています。」

**想定Q**: なぜこの AWS サービス構成を選んだのですか？

**準備回答**:
「AgentCore を選んだのは、MCP Tool の認証・認可をフルマネージドで扱えるからです。自前で JWT 検証 + ツールディスパッチを実装すると U-V3-01〜02 相当の工数がかかりますが、AgentCore に委譲することで Lambda は純粋なビジネスロジックに集中できます。コストは DynamoDB Pay-per-request + Lambda で固定費ゼロです。」

### 伊沢拓司さん（QuizKnock CEO）向け

**想定Q**: このサービスを誰かに実際に使ってもらいましたか？

**準備回答**:
「開発メンバーが毎日使っています。最初は 1 日 5 分だったのが、今では 30 分音声で話しかけています。自分でタイプすることへの抵抗感が完全になくなりました。これが "人をダメにする" の実感です。」

**想定Q**: サービスの「中毒になるポイント」を説明してください

**準備回答**:
「音声で命令するたびに AI がすぐ動いてくれる "即時フィードバック" と、手でタイプするより速いという "摩擦ゼロの体験" の組み合わせです。一度体験すると、タイピングが "面倒くさい" に変わります。」

### 鶴崎修功さん（QuizKnock 数学博士）向け

**想定Q**: 技術的に最も難しかった部分はどこですか？

**準備回答**:
「ElevenLabs Conversational AI と AgentCore を MCP でブリッジする部分です。ElevenLabs はリアルタイム音声ストリームで動作するため、AgentCore のツール呼び出しが 500ms 以内に返らないとユーザー体験が壊れます。Lambda の Cold Start を事前ウォームアップで回避し、DynamoDB の Single-table Design でクエリを 1 回に抑えて p99 レイテンシを 320ms に収めました。」

### 福井淳さん（AI-DLC L300 SA）向け

**想定Q**: AI-DLC で最も議論になった設計判断はどれですか？

**準備回答**:
「AgentCore の採用判断です。当初は Bedrock Converse API + Tool Use で自前実装する計画でしたが、NFR Requirements フェーズで "認証・認可の実装コスト vs マネージドサービス" を比較した際に、AgentCore に切り替えました。audit.md にその判断記録が残っています。AI の提案（Converse API）を人間が検討した上で変更した典型例です。」

**想定Q**: audit.md を見て気になる点を聞いてもいいですか？

**準備回答**:
「はい。audit.md には AI の提案をそのまま承認した箇所と、変更を依頼した箇所の両方が記録されています。特に NFR Design フェーズで "5 パターンのうち 2 つを却下して再提案させた" 部分は、人間監督の具体例として説明できます。」

---

## 当日チェックリスト

### 前日

```
[ ] demo-reset.sh を実行してデータクリーン確認
[ ] verify-agentcore.sh → PASS
[ ] verify-mcp-auth.sh  → PASS
[ ] 動画バックアップを最新版でローカル保存
[ ] プレゼンスライドの最終確認（15分タイマーでリハーサル）
[ ] 審査員 Q&A 回答を全員で練習
```

### 当日朝（会場入り前）

```
[ ] AWS コンソールでデプロイ状態確認
[ ] ElevenLabs ダッシュボードでエージェント確認
[ ] 発表用 PC のマイク・スピーカー動作確認
[ ] ブラウザのマイク権限を事前に許可
[ ] バックアップ PC にも同じ環境をセットアップ済みか確認
```

### デモ 30 分前

```
[ ] verify-agentcore.sh → PASS
[ ] demo-reset.sh       → 完了
[ ] ElevenLabs ウォームアップ（テスト音声）
[ ] ブラウザで SABOROU UI → タスク一覧が空
[ ] フォールバック A タブを事前に開いておく
[ ] フォールバック B（Web UI / 動画）も準備完了
```
