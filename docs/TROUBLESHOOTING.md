# SABOROU トラブルシューティングマトリクス

対象: 決勝デモ当日（2026年6月26日）のトラブル対応ガイド
対応NFR: NFR-V305-M1 (High)

---

## 凡例

| 列 | 説明 |
|----|------|
| エラーシナリオ | 発生しうる問題の具体的な状況 |
| 推定原因 | 最も可能性の高い原因 |
| 確認手順 | 問題を切り分けるための手順 |
| 解決方法 | 恒久的な修正手順 |
| 回避策 | デモ当日に素早く対処する方法 |

---

## 1. AgentCore Gateway

### シナリオ 1-A: ステータスが FAILED

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | `verify-agentcore.sh` を実行すると `AgentStatus: FAILED` が返る |
| **推定原因** | デプロイ後に Bedrock Agent のビルドが失敗した。Lambda のコード変更後に Agent を再デプロイしていない |
| **確認手順** | `aws bedrock-agent get-agent --agent-id $AGENTCORE_GATEWAY_ID --region ap-northeast-1` でステータス詳細を確認 |
| **解決方法** | `pnpm --filter @saborou/cdk deploy` を再実行。ビルドエラーがあれば CloudWatch Logs でエラー詳細を確認 |
| **回避策** | フォールバック A（Chrome 拡張 clientTools）に切り替え。DEMO_RUNBOOK.md の「フォールバック A」参照 |

### シナリオ 1-B: ツールが未登録

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | `saborou_get_tasks` を呼び出すと `Tool not found` エラーが返る |
| **推定原因** | AgentCore への MCP Tool スキーマ登録が未完了。`U-V3-02` の tool registry デプロイが失敗している |
| **確認手順** | `aws bedrock-agent list-agent-action-groups --agent-id $AGENTCORE_GATEWAY_ID` でアクショングループを確認 |
| **解決方法** | `pnpm --filter @saborou/cdk deploy` を再実行。tool-registry スタックの CloudFormation スタックイベントを確認 |
| **回避策** | フォールバック A に切り替え。Chrome 拡張のローカル clientTools でツールを直接呼び出す |

### シナリオ 1-C: IAM 権限エラー

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | `AccessDeniedException: User is not authorized to perform: bedrock:InvokeAgent` が返る |
| **推定原因** | Lambda 実行ロールに Bedrock Agent 呼び出し権限がない。CDK の IAM ポリシーが不足 |
| **確認手順** | Lambda の実行ロールを確認: `aws iam get-role-policy --role-name <LambdaRoleName> --policy-name <PolicyName>` |
| **解決方法** | CDK スタックに `agent.grant(lambdaFn, 'bedrock:InvokeAgent')` を追加して再デプロイ |
| **回避策** | フォールバック A に切り替え（IAM 権限不要のパス） |

---

## 2. Cognito JWT 認証

### シナリオ 2-A: トークン期限切れ

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | API Gateway から `401 Unauthorized: Token expired` が返る |
| **推定原因** | Cognito アクセストークンの有効期限（デフォルト 60 分）が切れた |
| **確認手順** | `aws cognito-idp initiate-auth` で新しいトークンを取得できるか試す |
| **解決方法** | アクセストークンをリフレッシュ: `aws cognito-idp initiate-auth --auth-flow REFRESH_TOKEN_AUTH --auth-parameters REFRESH_TOKEN=<RefreshToken> --client-id <ClientId>` |
| **回避策** | デモ直前にトークンを再取得して環境変数を更新。`verify-mcp-auth.sh` で動作確認 |

### シナリオ 2-B: User Pool 設定エラー

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | `NotAuthorizedException: User pool client does not exist` が返る |
| **推定原因** | CDK デプロイ時に Cognito User Pool Client ID が変更された。環境変数の `COGNITO_CLIENT_ID` が古い |
| **確認手順** | `aws cognito-idp list-user-pool-clients --user-pool-id <UserPoolId>` で有効なクライアントを確認 |
| **解決方法** | CloudFormation Outputs から最新の Client ID を取得して環境変数を更新 |
| **回避策** | フォールバック B（Web UI）に切り替え（Cognito セッションが残っている場合はブラウザログインが使える） |

### シナリオ 2-C: PKCE フロー失敗

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | Chrome 拡張でのログインフローが失敗し、`invalid_grant` が返る |
| **推定原因** | Chrome 拡張の callback URL が Cognito App Client の許可リダイレクト URL と一致しない |
| **確認手順** | Cognito コンソールで App Client の「Allowed callback URLs」を確認 |
| **解決方法** | Chrome 拡張の `manifest.json` と Cognito の callback URL を一致させて CDK を再デプロイ |
| **回避策** | フォールバック B（Web UI ブラウザログイン）に切り替え |

---

## 3. Slack Webhook

### シナリオ 3-A: Webhook URL 無効

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | `saborou_reply_to_slack` が `404: No such webhook` を返す |
| **推定原因** | Slack Incoming Webhook の URL が変更または削除された。Secrets Manager の値が古い |
| **確認手順** | `aws secretsmanager get-secret-value --secret-id saborou/slack/webhook` で URL を確認。`curl -X POST -H 'Content-type: application/json' --data '{"text":"test"}' <URL>` で疎通確認 |
| **解決方法** | Slack の [Apps] > [Incoming Webhooks] で新しい URL を取得し、Secrets Manager を更新 |
| **回避策** | Slack 返信をスキップして `saborou_delegate_to_claude` と `saborou_get_tasks` のデモに集中する |

### シナリオ 3-B: レート制限

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | `saborou_reply_to_slack` が `429 Too Many Requests` を返す |
| **推定原因** | Slack API のレート制限（Tier 3: 50回/分）に達した |
| **確認手順** | エラーレスポンスの `Retry-After` ヘッダを確認 |
| **解決方法** | Lambda のリトライロジックに指数バックオフを実装（U-V3-03 のコード修正） |
| **回避策** | デモ中の Slack 送信頻度を落とす。`Retry-After` 秒待って再試行 |

### シナリオ 3-C: Bot トークン権限不足

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | Slack API が `missing_scope: chat:write` エラーを返す |
| **推定原因** | Slack Bot トークンに `chat:write` スコープが付与されていない |
| **確認手順** | Slack App の [OAuth & Permissions] > [Scopes] で Bot Token Scopes を確認 |
| **解決方法** | `chat:write` スコープを追加して Bot Token を再インストール。Secrets Manager の値を更新 |
| **回避策** | `saborou_reply_to_slack` をデモからスキップして他のツールに集中する |

---

## 4. ElevenLabs

### シナリオ 4-A: Agent ID 未設定

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | ElevenLabs Conversational AI が起動しない。`Agent ID not configured` エラー |
| **推定原因** | `ELEVENLABS_AGENT_ID` 環境変数または Lambda 環境変数が未設定 |
| **確認手順** | Lambda コンソールで環境変数 `ELEVENLABS_AGENT_ID` を確認。`aws lambda get-function-configuration --function-name <FunctionName>` |
| **解決方法** | ElevenLabs ダッシュボードから Agent ID を取得し、Secrets Manager / Lambda 環境変数を更新 |
| **回避策** | フォールバック A（Chrome 拡張の Web Speech API）に切り替え |

### シナリオ 4-B: MCP Server 未登録

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | ElevenLabs エージェントが `saborou_get_tasks` を呼び出せない |
| **推定原因** | ElevenLabs エージェントへの MCP Server URL 登録が未完了 |
| **確認手順** | ElevenLabs ダッシュボードで Conversational AI エージェントの「Tools」設定を確認 |
| **解決方法** | API Gateway URL を ElevenLabs ダッシュボードの MCP Server URL 欄に登録する |
| **回避策** | フォールバック A（Chrome 拡張 clientTools）に切り替え |

### シナリオ 4-C: API キー期限切れ

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | ElevenLabs API が `401 Unauthorized: Invalid API key` を返す |
| **推定原因** | ElevenLabs API キーが期限切れまたは無効化された |
| **確認手順** | ElevenLabs ダッシュボードの [API Keys] でキーのステータスを確認 |
| **解決方法** | 新しい API キーを生成し、Secrets Manager を更新。Lambda を再起動 |
| **回避策** | フォールバック A（ElevenLabs 不要のパス）に切り替え |

---

## 5. Google（OAuth / Calendar API）

### シナリオ 5-A: OAuth トークン失効

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | Google Calendar の操作が `401: Token has been expired or revoked` を返す |
| **推定原因** | Google OAuth リフレッシュトークンが失効した（6ヶ月以上未使用 or ポリシー変更） |
| **確認手順** | `aws secretsmanager get-secret-value --secret-id saborou/google/tokens` でトークン確認 |
| **解決方法** | OAuth 再認証フローを実行してリフレッシュトークンを更新し、Secrets Manager に保存 |
| **回避策** | Google カレンダー連携を必要とするデモシナリオをスキップ |

### シナリオ 5-B: Calendar API Quota 超過

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | `429: Quota exceeded for quota metric 'calendar.googleapis.com'` が返る |
| **推定原因** | Google Calendar API の 1 日のリクエスト上限に到達した |
| **確認手順** | Google Cloud Console の [APIs & Services] > [Google Calendar API] でクォータ使用状況を確認 |
| **解決方法** | Google Cloud Console でクォータ引き上げを申請（翌日には回復） |
| **回避策** | Google カレンダー機能のデモをスキップ。DynamoDB に保存済みのタスクデータで代替デモ |

### シナリオ 5-C: Gmail フィルタなし

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | Gmail からタスクが抽出されない。`saborou_get_tasks` の結果が空 |
| **推定原因** | Gmail フィルタ条件に合うメールが受信箱にない。メールラベル設定がずれている |
| **確認手順** | デモ用メールアカウントのGmailでフィルタ対象ラベルを確認。テストメールを送信して確認 |
| **解決方法** | デモ用タスクメールを事前に送信しておく |
| **回避策** | DynamoDB に直接テストデータを投入: `aws dynamodb put-item --table-name $TASKS_TABLE --item '{...}'` |

---

## 6. Hono フォールバック (fallback API)

### シナリオ 6-A: Lambda Cold Start タイムアウト

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | 初回リクエストで Lambda が 5〜10 秒かかり、ElevenLabs がタイムアウトする |
| **推定原因** | Lambda の Cold Start（特に SnapStart 未設定の場合）でレスポンスが遅延 |
| **確認手順** | CloudWatch Logs で `Init Duration` が含まれるログを確認 |
| **解決方法** | Lambda Provisioned Concurrency または Lambda SnapStart を設定する（CDK で `provisionedConcurrencyConfig` を追加） |
| **回避策** | デモ 5 分前に `verify-agentcore.sh` を実行してウォームアップしておく |

### シナリオ 6-B: CORS エラー

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | Chrome 拡張から API を呼び出すと `Access-Control-Allow-Origin` エラーが発生 |
| **推定原因** | API Gateway の CORS 設定で Chrome 拡張のオリジン (`chrome-extension://...`) が許可されていない |
| **確認手順** | ブラウザの開発者ツールでネットワークエラーを確認。`OPTIONS` プリフライトのレスポンスヘッダを確認 |
| **解決方法** | CDK の API Gateway で CORS origin に `chrome-extension://<ExtensionId>` を追加して再デプロイ |
| **回避策** | フォールバック B（Web UI）に切り替え（Web UI は同一オリジンのため CORS 不要） |

### シナリオ 6-C: 環境変数未設定

| 項目 | 内容 |
|------|------|
| **エラーシナリオ** | Lambda が起動直後にクラッシュし、`Cannot read properties of undefined (reading 'TASKS_TABLE_NAME')` が返る |
| **推定原因** | CDK デプロイ後に Lambda の環境変数が更新されなかった。スタックの Output が変わった |
| **確認手順** | `aws lambda get-function-configuration --function-name <FunctionName> --query 'Environment'` で環境変数を確認 |
| **解決方法** | `pnpm --filter @saborou/cdk deploy` で再デプロイ。CDK の環境変数バインドを確認 |
| **回避策** | AWS Lambda コンソールで直接環境変数を手動更新（CDK 管理外だが緊急時の応急処置） |

---

## デモ当日 緊急チェックリスト

```
30分前:
[ ] verify-agentcore.sh → PASS
[ ] verify-mcp-auth.sh  → PASS
[ ] demo-reset.sh       → 完了
[ ] ElevenLabs Agent 音声テスト → 正常

10分前:
[ ] ブラウザでタスク一覧が空であることを確認
[ ] Slack チャンネルが開いている
[ ] フォールバック A/B の準備完了（別タブで待機）

問題発生時:
[ ] 30秒以内に判断 → フォールバック A or B に切り替え
[ ] DEMO_RUNBOOK.md のフォールバック手順を実行
```
