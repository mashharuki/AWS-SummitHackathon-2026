# SABOROU MCP Serverization - Requirement Verification Questions

**作成日**: 2026-06-16
**対象**: SABOROU APIサーバーのMCPサーバー化と、ElevenLabs AgentからのSABOROU機能呼び出し
**回答方法**: 各質問の `[Answer]:` に選択肢の文字を記入してください。選択肢に合わない場合は最後の `X) Other` を選び、同じ行または次の行に補足してください。

---

## 背景認識

既存v2では以下が実装済みです。

- Chrome拡張 Side Panel から ElevenLabs Conversational AI SDK の Agent へ接続できる
- `pkgs/extension/src/panel/hooks/useConversationalAgent.ts` で ElevenLabs `clientTools` を登録している
- `pkgs/extension/src/panel/lib/agentClient.ts` は AgentCore Gateway風の `/mcp/tools/...` パスを優先し、失敗時にHono APIへフォールバックしている
- `pkgs/cdk/lib/stacks/agentcore-stack.ts` は Amazon Bedrock AgentCore Gateway によるMCP GatewayをCDK定義している

一方で、現在の不足は「SABOROU APIサーバー自体をMCPサーバーとして実装・公開し、音声AgentからSABOROU機能を確実に呼び出す部分」です。

---

## Question 1
今回のMCPサーバー化で優先する実装方式はどれですか？

A) SABOROU Hono API内にMCP over HTTP/SSEエンドポイントを直接追加する
B) Amazon Bedrock AgentCore Gatewayを本命として整備し、OpenAPIスキーマとGateway接続を完成させる
C) まずはローカル/Node MCPサーバーを別プロセスで作り、後でAWS公開方式へ移行する
D) デモ最優先で、ElevenLabs `clientTools` からSABOROU APIを呼べる状態をMCP互換のツール層として整備する
X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 2
ElevenLabs Agentから呼び出したいSABOROU機能のMVP範囲はどれですか？

A) Slack返信ドラフト生成、Slack送信、タスク一覧取得の3機能
B) Aに加えて、進捗報告生成/スケジュールも含める
C) Aに加えて、Google Calendar/Gmail文脈取得も含める
D) 既存APIで音声から呼べるものはすべてMCPツール化する
X) Other (please describe after [Answer]: tag below)

[Answer]: D

## Question 3
音声AgentがMCPツールを呼ぶ際の認証方式はどれを優先しますか？

A) 既存Cognito JWTを使い、ユーザー単位の認可を維持する
B) デモ用の短期サーバートークンを発行し、ElevenLabs Agentからそれを使う
C) AgentCore GatewayのCustom JWT/IAM連携を優先し、Hono API側は既存JWT認証を維持する
D) ローカルデモでは認証を簡略化し、本番化時にCognito JWTへ戻す
X) Other (please describe after [Answer]: tag below)

[Answer]: C

## Question 4
今回の完了条件として最も重要なデモシナリオはどれですか？

A) 音声で「今のSlackに返信して」と言うと、返信ドラフト生成まで完了する
B) 音声で「いいよ」と承認すると、Slackへ実送信まで完了する
C) 音声で「今日のタスクを教えて」と言うと、タスク一覧を読み上げる
D) BとCの両方を1つの会話セッションで完走する
X) Other (please describe after [Answer]: tag below)

[Answer]: X BとCを実行したのち、タスク一覧から任意のタスクを選択して @Claude をslack上でメンションし、実際にタスクを実行させる

## Question 5
Security Baseline Extensionを今回の追加開発でも有効にしますか？

A) Yes - 既存v2設定どおり、Security Baselineをブロッキング制約として有効化する
B) No - 今回はデモ速度を優先し、Security Baselineを無効化する
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
Property-Based Testing Extensionを今回の追加開発で有効にしますか？

A) Yes - MCPツール入出力や変換ロジックにPBTを適用する
B) Partial - 純粋関数、スキーマ変換、ツール入出力の往復変換だけにPBTを適用する
C) No - 既存v2設定どおり、通常のユニット/統合/手動E2Eテストで対応する
X) Other (please describe after [Answer]: tag below)

[Answer]: C

## Question 7
実装後の検証レベルはどれを目標にしますか？

A) ローカル単体テストと型チェックのみ
B) Aに加えて、拡張のビルドと既存パッケージの関連テストまで実行する
C) Bに加えて、ローカルMCPクライアントまたはcurlでMCPツール呼び出しを検証する
D) Cに加えて、実AWS/AgentCore/ElevenLabs Agentの実接続まで検証する
X) Other (please describe after [Answer]: tag below)

[Answer]: D
