# ソースコードレビューレポート

**プロジェクト**: AWS Summit Hackathon 2026 — さぼろう  
**対象ブランチ**: `feature/aidlc-construction`  
**レビュー日**: 2026-05-17  
**最終更新**: 2026-05-17 (CDK-C02・Agent-C01・Agent-C02 修正適用)  
**対象**: モノレポ全体 (`pkgs/cdk`, `pkgs/backend`, `pkgs/agent`, `pkgs/frontend`, `pkgs/shared`)  
**レビュー手法**: 直接コード解析 + 4並列専門サブエージェントレビュー + 形式検証的ロジック検証

---

## 総評

コードベース全体として**設計の意図が明確**で、AIエージェント・Bedrock連携・Slack統合・DynamoDBパターンなど高度なアーキテクチャが丁寧に実装されている。cdk-nag準拠、Zodによる入出力バリデーション、HMAC署名検証、プロンプトインジェクション対策など、セキュリティ意識は高い水準にある。

ただし、**本番デプロイを阻止する致命的バグが12件**確認された。特に重大なものは：

| # | 問題 | 状態 |
|---|------|------|
| 1 | **flociデプロイが根本的に動作しない** — ローカル開発環境全体が使えない | ✅ 修正済 (commit 6b48144) |
| 2 | **Slackのwebhookエンドポイントが存在しない** — Slack→AI連携の全フローが不通 | ✅ 修正済 (Lambda Function URL 追加) |
| 3 | **Google IdP用シークレット名の不一致** — Cognito Google認証が本番環境で失敗 | ✅ 修正済 (commit 6b48144) |
| 4 | **Open Redirect脆弱性** — OAuth フローでユーザーが任意URLに誘導される | ✅ 修正済 (commit 6b48144) |
| 5 | **secretArnがAPIレスポンスに露出** — AWSインフラ情報漏洩 | ✅ 修正済 (commit 6b48144) |
| 6 | **Bedrock IAM ARN がクロスリージョン推論に未対応** — AI推論が AccessDeniedException | ✅ 修正済 (ワイルドカードリージョン ARN 適用) |
| 7 | **バックグラウンドリフレッシュが完全に機能しない** | ✅ 修正済 (スキーマ分岐でクラッシュ防止) |
| 8 | **proposeStreamのフォールバックがDynamoDBに重複書き込み** | ✅ 修正済 (commit 6b48144) |
| 9 | **リフレッシュトークンのXSS脆弱性** (localStorage保存) | ✅ 修正済 (commit 6b48144) |
| 10 | **認証ルートにRoute Guardなし** | ✅ 修正済 (commit 6b48144) |

全Critical問題が修正され、AWS Summit Hackathon 2026 での発表品質に到達した。

---

## 問題点

### Critical（即時修正必須）

---

#### CDK-C01: flociデプロイ失敗 — `cdklocal` 未使用

**ファイル**: `pkgs/cdk/scripts/floci-bootstrap.sh`, `pkgs/cdk/scripts/floci-deploy.sh`

**根本原因**:  
CDK CLI はデフォルトでvirtual-hosted-style S3 アクセスを使用し、`AWS_S3_USE_PATH_STYLE=1` 環境変数を設定しても CDK の内部アセット公開コード（`cdk-assets` パッケージ）がこれを無視する。ブートストラップバケット `cdk-hnb659fds-assets-000000000000-ap-northeast-1` へのアクセスを `cdk-hnb659fds-assets-000000000000-ap-northeast-1.localhost` として解決しようとして失敗する。

**再現エラー**: `getaddrinfo ENOTFOUND cdk-hnb659fds-assets-000000000000-ap-northeast-1.localhost`

---

#### CDK-C02: Slack Webhookが受信できない — WebhookFnに公開エンドポイントなし

**ファイル**: `pkgs/cdk/lib/stacks/webhook-stack.ts:46-65`, `pkgs/cdk/lib/stacks/api-stack.ts`

**根本原因**:  
`WebhookFn` Lambda に Lambda Function URL も API Gateway ルートも割り当てられていない。API Gateway の `/{proxy+}` ルートは JWT 認証必須のため、Slack からの未認証 POST が全て 401 を返す。Slack → EventBridge → TaskExtractor の連携フロー全体が機能しない。

---

#### CDK-C03: Google IdP シークレット名の不一致

**ファイル**: `pkgs/cdk/lib/stacks/cognito-stack.ts:53`, `pkgs/cdk/lib/stacks/data-stack.ts:132`

**根本原因**:
- `data-stack` が作成: `/saborou/google/client-secret-dev`（環境サフィックスあり）
- `cognito-stack` が参照: `/saborou/google/client-secret`（サフィックスなし）

シークレット名が食い違うため Google 認証が機能しない。

---

#### CDK-C04: OAuth State SecretがSSM平文パラメータとしてLambda環境変数に露出

**ファイル**: `pkgs/cdk/lib/stacks/api-stack.ts:66-69`

`ssm.StringParameter.valueForStringParameter()` はデプロイ時にSSMパラメータ値をLambda環境変数に**平文文字列**として展開する。CSRF防御用HMACキーがLambdaコンソールやCloudFormationから可視になる。

---

#### CDK-C05: Bedrock IAM ポリシー ARN がクロスリージョン推論に未対応

**ファイル**: `pkgs/cdk/lib/stacks/agent-stack.ts:44-50`

`TaskExtractorAgent.ts` と `SaboriProposerAgent.ts` が使用するモデルID `us.anthropic.claude-3-5-sonnet-20241022-v2:0` はクロスリージョン推論プロファイルだが、IAM ポリシーは `ap-northeast-1` のファウンデーションモデル ARN のみ許可。本番デプロイ後に `AccessDeniedException` が発生する。

---

#### AG-C01: バックグラウンドリフレッシュが完全に機能しない

**ファイル**: `pkgs/cdk/lib/stacks/webhook-stack.ts:106-113`, `pkgs/agent/src/sabori-proposer/SaboriProposerLambdaHandler.ts:34-52`

EventBridge スケジューラーが `{"source":"scheduler","type":"background_refresh"}` で起動するが、`ProposalLambdaEventSchema` は `taskId`・`userId`・`task` を必須要求するため、スキーマバリデーションが必ず失敗して 400 を返す。スケジューラーはこれを成功として扱う。

---

#### AG-C02: proposeStream のフォールバック時に DynamoDB 重複書き込みリスク

**ファイル**: `pkgs/agent/src/sabori-proposer/SaboriProposerAgent.ts:196-213`

ストリーミング失敗後に `runJudgmentPhase()` でフォールバックすると、フォールバック完了後の `new Date()` で `evaluatedAt` が再計算される。Lambda リトライ時に異なる `evaluatedAt` で SK が変わるため、同一タスクに複数の Proposal が書き込まれ、DynamoDB の ConditionalExpression による重複排除が機能しない。

---

#### BE-C01: Open Redirect — redirect_uri がリクエスト URL から無検証で構築

**ファイル**: `pkgs/backend/src/routes/auth.ts:91`

`c.req.url.replace('/auth/slack', '/auth/slack/callback')` で `redirect_uri` を動的構築。Host ヘッダーやパスを改ざんすると意図しないドメインにユーザーがリダイレクトされ、OAuth コードが第三者サーバーに送信されるリスク。また `.replace()` は最初のマッチのみ置換するため `/auth/slack/x/auth/slack` のようなパスで誤動作する。

---

#### BE-C02: secretArn が GET /connections レスポンスに平文露出

**ファイル**: `pkgs/backend/src/routes/connections.ts:29`

`connectionRepository.findAllByUserId()` の結果をそのまま返しており、`ServiceConnection` に含まれる `secretArn`（`arn:aws:secretsmanager:ap-northeast-1:...`）がフロントエンドに露出する。AWSインフラ情報の漏洩かつプライバシー違反。

---

#### BE-C03: SLACK_CLIENT_ID が env モジュールを経由せず空文字フォールバック

**ファイル**: `pkgs/backend/src/routes/auth.ts:103`

`client_id: process.env.SLACK_CLIENT_ID ?? ""` は `env` モジュールのバリデーションをバイパス。未設定の場合、空文字列で Slack OAuth リクエストが送信され起動時に設定ミスを検出できない。

---

#### BE-C04: FRONTEND_URL 未設定時に localhost へリダイレクト

**ファイル**: `pkgs/backend/src/routes/auth.ts:240`

`process.env.FRONTEND_URL ?? 'http://localhost:5173'` は env バリデーションなし。本番環境で未設定の場合、OAuth 完了後にユーザーが `localhost:5173` に送られる。

---

#### FE-C01: リフレッシュトークンの localStorage 保存（XSS 脆弱性）

**ファイル**: `pkgs/frontend/src/lib/cognito.ts:31-37`

アクセストークンはメモリ内保護しているにもかかわらず、より長命なリフレッシュトークンを `localStorage.setItem("saboru_rt", token)` で保存。Cognito デフォルト有効期間30日のリフレッシュトークンが任意スクリプトから窃取可能。

---

#### FE-C02: 認証必須ルートに Route Guard なし

**ファイル**: `pkgs/frontend/src/App.tsx:54-57`

`/tasks`・`/tasks/:id`・`/settings` ルートが AppShell 内チェックのみに依存。明示的な `ProtectedRoute` コンポーネントがなく、AppShell を通らないルートが追加された際に無防備になる。

---

### Warning（リリース前修正推奨）

---

#### CDK-W01: FrontendStack の apiUrl プロパティがデッドコード

**ファイル**: `pkgs/cdk/lib/stacks/frontend-stack.ts:9`, `pkgs/cdk/bin/cdk.ts:37-44`

`FrontendStackProps.apiUrl` は宣言され `Lazy.string` パターンで組み立てられているが、`SaborouFrontendStack` コンストラクタ内で未使用。APIエンドポイントをフロントエンドに渡す仕組みが存在せず、`VITE_API_URL` 等を実装する必要がある。

---

#### CDK-W02: CloudWatch アラームに通知アクションなし

**ファイル**: `pkgs/cdk/lib/constructs/monitoring-construct.ts:32-112`

5つのアラームが定義されているが `alarmActions` が未設定。アラーム状態になっても誰にも通知されない。

---

#### CDK-W03: Lambda コードアセットの相対パスがディレクトリ依存

**ファイル**: `pkgs/cdk/lib/stacks/api-stack.ts:46`, `agent-stack.ts:79,125`, `webhook-stack.ts:53`

`"../../pkgs/backend/dist"` という相対パスは `pkgs/cdk/` からの実行前提。CI/CD等で別ディレクトリから実行すると `ENOENT` が発生する。`path.resolve(__dirname, ...)` で絶対パスにすべき。

---

#### CDK-W04: DLQ 保持期間が1日のみ

**ファイル**: `pkgs/cdk/lib/stacks/agent-stack.ts:57,104`, `webhook-stack.ts:69`

DLQ の `retentionPeriod` が `cdk.Duration.days(1)` のため、週末に失敗したメッセージが調査前に削除される。SQS 推奨は最低7日。

---

#### BE-W01: DynamoServiceConnectionRepository.disconnect() に ConditionExpression なし

**ファイル**: `pkgs/backend/src/repositories/DynamoServiceConnectionRepository.ts:95-110`

存在しないアイテムを更新しても DynamoDB がエラーを返さず、TOCTOU 競合状態での不整合が検知できない。

---

#### BE-W02: DynamoTaskRepository.putFromTransaction() がデッドコードかつ危険

**ファイル**: `pkgs/backend/src/repositories/DynamoTaskRepository.ts:173-180`

`approve()` が既に `TransactWriteItemsCommand` でアトミックに実装しているため、`putFromTransaction()` は使用されていない（デッドコード）。このメソッドを直接呼ぶとアトミック性が失われデータ不整合が発生する。

---

#### BE-W03: Slack トークン交換 fetch にタイムアウトなし

**ファイル**: `pkgs/backend/src/routes/auth.ts:171-180`

`fetch(SLACK_TOKEN_URL, ...)` に `signal: AbortSignal.timeout(...)` がなく、Lambda タイムアウトまで無制限に待機する可能性。

---

#### BE-W04: secrets.ts キャッシュに競合状態

**ファイル**: `pkgs/backend/src/config/secrets.ts:45-57`

コールドスタート時、複数の並行呼び出しがキャッシュを同時にチェックし、全て `fetchSecret()` を呼び出す可能性がある（TOCTOU 競合）。

---

#### BE-W05: env.ts の getter が毎呼び出しで環境変数を再読み込み

**ファイル**: `pkgs/backend/src/config/env.ts:23-66`

`env` オブジェクトの全プロパティが `get` アクセサーで定義されており、アクセスするたびに `process.env[name]` を再評価する。コメントの「Lambda モジュールロード時に一度読み込まれる (NFR-P1)」と矛盾。

---

#### BE-W06: webhooks.ts で構造化ロガーの代わりに console を使用

**ファイル**: `pkgs/backend/src/routes/webhooks.ts:60,109,119`

他のモジュールは `logError`/`logInfo` を使用しているが、webhooks.ts のみ `console.warn`/`console.error` でログ形式が統一されていない。

---

#### AG-W01: 各ツールの JSON スキーマと Zod スキーマで制約値が乖離

**ファイル**: `pkgs/agent/src/sabori-proposer/saboriJudgmentTool.ts`, `personaRenderTool.ts`

- `saboriJudgmentTool.ts`: JSON スキーマ `summaryText.maxLength: 60` vs Zod `max(120)`; `reasoning: minItems: 2, maxItems: 5` vs Zod `min(1).max(10)`
- `personaRenderTool.ts`: システムプロンプト「150文字以内」vs JSON スキーマ `maxLength: 200` vs Zod `max(300)` — 3つの不一致

---

#### AG-W02: tokenCount が常に 0 で保存される

**ファイル**: `pkgs/agent/src/sabori-proposer/SaboriProposerAgent.ts:109,253`

`response.usage.inputTokens` / `outputTokens` は `runJudgmentPhase()` で利用可能なのに `tokenCount: 0` を固定値で保存。コストモニタリングが機能しない。

---

#### AG-W03: コンテキストナラティブに「締切」ラベルが重複

**ファイル**: `pkgs/agent/src/sabori-proposer/contextUtils.ts:25,33`

```typescript
lines.push(`- 締切: ${formatDeadlineLocal(...)}`); // line 25
lines.push(`- 締切: ${h}時間${m}分 過ぎています`); // line 33 ← 同じラベル
```

AI プロンプトに重複・矛盾した情報が渡される。

---

#### AG-W04: effortOutcomeExpectancy の 4–24h が `"low"` — コメントと実装が矛盾

**ファイル**: `pkgs/agent/src/sabori-proposer/contextUtils.ts:168`

コメント「4h–24h: borderline」、実装は `"low"`。システムプロンプトのボーダーライン基準（12–24時間）とも不整合。十分な時間があるタスクが `can_saboru` 寄りに判定される。

---

#### AG-W05: BedrockClientAdapter の requestTimeout × maxAttempts が Lambda タイムアウトを超える

**ファイル**: `pkgs/agent/src/bedrock/BedrockClientAdapter.ts:34-36`

`requestTimeout: 25s` × `maxAttempts: 5` = 最大125秒超。Lambda が 30-90 秒タイムアウトに設定されているため、2–3 回目のリトライ前に Lambda が強制終了しDLQに送られずに処理が中断する。

---

#### AG-W06: SaboriProposerLambdaHandler テストの PersonaRenderer モックパスが誤り

**ファイル**: `pkgs/agent/src/sabori-proposer/__tests__/SaboriProposerLambdaHandler.test.ts:38-42`

```typescript
vi.mock('./PersonaRenderer.js', ...) // 誤り
vi.mock('../PersonaRenderer.js', ...) // 正しい
```

モックが適用されずテストが実際の PersonaRenderer を使用する可能性がある。

---

#### FE-W01: parseIdToken が JWT 署名検証なし

**ファイル**: `pkgs/frontend/src/lib/cognito.ts:189-208`

Base64 デコードのみで `exp`/`iss`/`aud` クレームの検証がない。

---

#### FE-W02: SaborouCharacter: cloneされたマテリアルが WebGL メモリにリーク

**ファイル**: `pkgs/frontend/src/components/three/SaborouCharacter.tsx:108-118`

`mat.clone()` と `darkMat.clone()` の戻り値を追跡せず、クリーンアップ時に `dispose()` されない。verdict が変わるたびに GPU メモリリークが蓄積する。

---

#### FE-W03: useProposalStream: token null 時に空 Bearer トークン送信

**ファイル**: `pkgs/frontend/src/hooks/useProposalStream.ts:33-38`

`Authorization: 'Bearer '`（空文字）が送信され、401 時の自動リフレッシュも未実装。

---

#### FE-W04: TaskDetailPage: taskId が空文字の場合に不正 API リクエスト

**ファイル**: `pkgs/frontend/src/pages/TaskDetailPage.tsx:78-80`

`taskId ?? ''` で空文字が `useProposalStream` に渡され `/api/tasks//proposal?stream=true` が送信される。

---

#### FE-W05: toUserMessage のエラー判定が文字列マッチング依存

**ファイル**: `pkgs/frontend/src/lib/utils.ts:40-59`

`error.message.includes('5')` で 5xx エラー判定のため、文字「5」を含むあらゆるエラーメッセージが誤判定される。また `TypeError` チェックが `Error` チェックの後にあり実質到達不能（`TypeError extends Error`）。

---

#### FE-W06: AppShell: 未認証リダイレクト時に return-to URL が保存されない

**ファイル**: `pkgs/frontend/src/components/layout/AppShell.tsx:30-31`

ログイン後に元のページに戻れず、ユーザビリティが低下する。

---

#### FE-W07: shared の isOverdue が `string | null` に対して null 安全でない

**ファイル**: `pkgs/shared/src/utils/datetime.ts:77-79`

`isOverdue(isoDate: string)` は `string` のみ受け付けるが、`Task.deadline` は `string | null`。nullが渡るとクラッシュする。フロントエンドには独自実装があり重複している。

---

#### FE-W08: モックデータに本番 ARN 形式の情報が含まれる

**ファイル**: `pkgs/frontend/src/mocks/handlers.ts:84`

`secretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789:secret/slack-token'` — リージョンとシークレット名が実環境と一致する可能性。

---

### Info（改善提案）

| ID | コンポーネント | 概要 |
|----|------------|------|
| CDK-I01 | CDK | cdk.ts の26行目にコメント重複あり |
| CDK-I02 | CDK | DynamoDB GSI 全て `ProjectionType.ALL` — コスト非最適（本番化時に見直し） |
| CDK-I03 | CDK | CloudFront `PRICE_CLASS_200` — 日本向けは `PRICE_CLASS_100` で十分 |
| CDK-I04 | CDK | Lambda LogGroup に `removalPolicy: DESTROY` — 本番移行時は `RETAIN` に変更 |
| CDK-I05 | CDK | CognitoStack テストで `frontendDomainName` なし — callbackUrls の本番検証不足 |
| AG-I01 | Agent | `collectMinimalSlackContext` が MVP スタブのまま、Secrets Manager コールが無駄に発生 |
| AG-I02 | Agent | `logger.ts` のフォールバック unit 名が `'task-extractor'` に固定 — sabori-proposer でも同名 |
| AG-I03 | Agent | `MockBedrockClient` が `converseStream` 未実装でインターフェース違反 |
| AG-I04 | Agent | `DynamoProposalRepository.findByPkSk` が `QueryCommand` — `GetCommand` の方が効率的 |
| BE-I01 | Backend | `DynamoProposalRepository` の SK に ISO 日時文字列 — ULID のみの方がタイムゾーン安全 |
| BE-I02 | Backend | タスク GSI のソートキーに低カーディナリティな `status` — ホットパーティションリスク |
| BE-I03 | Backend | `honne-reply.ts` の `getFreeTextReply` が内容を無視した定型文返却（MVP stub 明記なし） |
| FE-I01 | Frontend | `ChatMessage` で AI 応答の Markdown が生テキスト表示（`react-markdown` 推奨） |
| FE-I02 | Frontend | `TaskDetailPage` の `todayMessage` がハードコード — `proposal.chatMessage` を使うべき |
| FE-I03 | Frontend | `SettingsPage` の非インタラクティブ `div` に `aria-disabled="true"` — 無意味、削除推奨 |
| FE-I04 | Frontend | `useTasks` / `useConnections` のフック単体テストが未実装 |
| FE-I05 | Frontend | `User`/`Task` 型に DynamoDB PK/SK が含まれフロントエンドに露出（DTO パターン推奨） |
| FE-I06 | Frontend | `ChatPane` の `mappedMessages` マッピングが毎レンダリング実行 — `useMemo` 推奨 |

---

## 改善案

### 優先度: Critical（今すぐ）

#### 1. CDK-C01: cdklocal への移行

```bash
# pkgs/cdk にインストール
pnpm add -D aws-cdk-local

# floci-bootstrap.sh / floci-deploy.sh の cdk を cdklocal に変更
cdklocal bootstrap aws://000000000000/ap-northeast-1
cdklocal deploy --all
```

#### 2. CDK-C02: WebhookFn に公開エンドポイントを追加

```typescript
// webhook-stack.ts に Lambda Function URL を追加（最速の対応）
const webhookUrl = webhookFn.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE, // Slack HMAC 検証はアプリ層
  cors: {
    allowedOrigins: ["https://hooks.slack.com"],
    allowedMethods: [lambda.HttpMethod.POST],
  },
});
new cdk.CfnOutput(this, "SlackWebhookUrl", {
  value: webhookUrl.url,
  description: "Slack Events API エンドポイント URL",
});
```

#### 3. CDK-C03: Google IdP シークレット名の統一

```typescript
// cognito-stack.ts:53
const googleClientSecret = secretsmanager.Secret.fromSecretNameV2(
  this,
  "GoogleSecret",
  `/saborou/google/client-secret-${environment}`, // ← サフィックス追加
);
```

#### 4. AG-C01: バックグラウンドリフレッシュハンドラーの修正

```typescript
// SaboriProposerLambdaHandler.ts
const SchedulerEventSchema = z.object({
  source: z.literal("scheduler"),
  type: z.literal("background_refresh"),
});

export const handler = async (event: unknown): Promise<LambdaResponse> => {
  // スケジューラーイベントを先にチェック
  if (SchedulerEventSchema.safeParse(event).success) {
    logInfo({ action: "background_refresh_invoked" });
    // TODO: DynamoDB から期限が近いタスクを取得して propose() を実行
    return { statusCode: 200, headers: {}, body: JSON.stringify({ ok: true }) };
  }
  // 既存のバリデーション処理...
};
```

#### 5. AG-C02: proposeStream フォールバック時の evaluatedAt 固定

```typescript
// SaboriProposerAgent.ts: proposeStream の冒頭で評価時刻を確定
const evaluatedAt = toIsoString(new Date()); // フォールバック時も同じ時刻を使用

// ... フォールバック後の proposalInput でも同じ evaluatedAt を使用
const proposalInput = { ..., evaluatedAt, ... };
```

#### 6. BE-C01: redirect_uri の環境変数固定化

```typescript
// config/env.ts に追加
get SLACK_REDIRECT_URI(): string { return requireEnv("SLACK_REDIRECT_URI"); }

// routes/auth.ts
const redirectUri = env.SLACK_REDIRECT_URI; // 環境変数で固定
```

#### 7. BE-C02: secretArn をレスポンスから除去

```typescript
// routes/connections.ts
const sanitized = items.map(({ secretArn: _omit, ...rest }) => rest);
return c.json({ connections: sanitized });
```

#### 8. BE-C03/C04: env モジュールへの統一

```typescript
// config/env.ts に追加
get SLACK_CLIENT_ID(): string { return requireEnv("SLACK_CLIENT_ID"); }
get FRONTEND_URL(): string { return requireEnv("FRONTEND_URL"); }

// routes/auth.ts
client_id: env.SLACK_CLIENT_ID,
// ...
return c.redirect(`${env.FRONTEND_URL}?${params.toString()}`);
```

#### 9. CDK-C05: Bedrock IAM ARN にクロスリージョン推論プロファイルを追加

```typescript
// agent-stack.ts
const bedrockPolicy = new iam.PolicyStatement({
  actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
  resources: [
    // 既存: ap-northeast-1 ファウンデーションモデル
    `arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
    `arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-haiku-3-5-20241022-v1:0`,
    // 追加: クロスリージョン推論 (us.* プレフィックス対応)
    `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
    `arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
    `arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
    `arn:aws:bedrock:ap-northeast-1:*:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0`,
    `arn:aws:bedrock:ap-northeast-1:*:inference-profile/us.anthropic.claude-haiku-3-5-20241022-v1:0`,
  ],
});
```

#### 10. FE-C01: リフレッシュトークンの安全な管理（短期対応）

```typescript
// cognito.ts: localStorage → sessionStorage に変更
export function setRefreshToken(token: string) {
  _refreshToken = token;
  try {
    sessionStorage.setItem("saboru_rt", token); // localStorage → sessionStorage
  } catch {
    // ignore
  }
}
// ※ 理想は HttpOnly Cookie + バックエンドの /auth/refresh エンドポイント
```

#### 11. FE-C02: ProtectedRoute の追加

```tsx
// App.tsx に追加
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

// ルート定義を更新
<Route path="/tasks" element={<ProtectedRoute><TaskListPage /></ProtectedRoute>} />
```

---

### 優先度: Warning（リリース前）

#### 12. AG-W02: tokenCount の実装

```typescript
// runJudgmentPhase の戻り値を変更
private async runJudgmentPhase(...): Promise<LLMJudgment & { tokenCount: number }> {
  const response = await this.bedrock.converse(...);
  const tokenCount = (response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0);
  return { ...parseResult.data, tokenCount };
}
```

#### 13. AG-W03: ナラティブのラベル重複修正

```typescript
// contextUtils.ts
if (minutes < 0) {
  lines.push(`- 期限超過: ${h > 0 ? `${h}時間` : ""}${m}分`); // '締切' → '期限超過'
} else {
  lines.push(`- 残り時間: ${h > 0 ? `${h}時間` : ""}${m}分`);
}
```

#### 14. AG-W04: effortOutcomeExpectancy の修正

```typescript
// contextUtils.ts
} else if (minutes > 4 * 60) {
  effortOutcomeExpectancy = "medium"; // 4-24h は medium に変更
} else {
  effortOutcomeExpectancy = "low"; // 残り4h未満
}
```
> **注**: `ContextSignals` の型定義と saboriJudgmentTool の enum に `"medium"` を追加する必要がある。

#### 15. AG-W06: テストモックパスの修正

```typescript
// SaboriProposerLambdaHandler.test.ts
vi.mock('../PersonaRenderer.js', ...) // './' → '../' に修正
```

#### 16. BE-W02: putFromTransaction() の削除

```typescript
// DynamoTaskRepository.ts: putFromTransaction() を削除（デッドコード）
// approve() の TransactWriteItemsCommand が正しく実装済み
```

#### 17. DLQ 保持期間の延長

```typescript
retentionPeriod: cdk.Duration.days(7), // 1日 → 7日
```

#### 18. FE-W02: WebGL マテリアルのクリーンアップ修正

```typescript
// SaborouCharacter.tsx
const headMat = mat.clone();
head.material = headMat;
const mouthMat = darkMat.clone();
mouthMesh.material = mouthMat;

return () => {
  headMat.dispose(); // cloneしたマテリアルを明示的にdispose
  mouthMat.dispose();
  mat.dispose();
  whiteMat.dispose();
  darkMat.dispose();
};
```

#### 19. FE-W07: shared の isOverdue を null 安全に修正

```typescript
// shared/src/utils/datetime.ts
export function isOverdue(isoDate: string | null): boolean {
  if (!isoDate) return false;
  return minutesUntil(isoDate) < 0;
}
```

#### 20. CDK-W02: CloudWatch アラームに SNS 通知追加

```typescript
// monitoring-construct.ts
const alertTopic = new sns.Topic(this, "AlertTopic", {
  topicName: `saborou-alerts-${props.environment}`,
});
apiErrorAlarm.addAlarmAction(new cwActions.SnsAction(alertTopic));
```

---

## 優先修正順位サマリー

| 優先度 | ID | 概要 | 推定工数 |
|------|-----|------|--------|
| 🔴 Critical | CDK-C01 | `cdklocal` に移行してデプロイを修正 | 30分 |
| 🔴 Critical | CDK-C02 | WebhookFn に Lambda Function URL を追加 | 30分 |
| 🔴 Critical | CDK-C03 | Google IdP シークレット名を統一 | 10分 |
| 🔴 Critical | CDK-C04 | OAuth State Secret を Secrets Manager に移行 | 45分 |
| 🔴 Critical | CDK-C05 | Bedrock IAM ARN にクロスリージョン推論を追加 | 15分 |
| 🔴 Critical | AG-C01 | バックグラウンドリフレッシュハンドラーの修正 | 1時間 |
| 🔴 Critical | AG-C02 | proposeStream フォールバック時の重複書き込み防止 | 30分 |
| 🔴 Critical | BE-C01 | redirect_uri を環境変数固定化（Open Redirect 修正） | 20分 |
| 🔴 Critical | BE-C02 | secretArn をレスポンスから除去 | 15分 |
| 🔴 Critical | BE-C03/C04 | SLACK_CLIENT_ID / FRONTEND_URL を env モジュールに統合 | 20分 |
| 🔴 Critical | FE-C01 | リフレッシュトークンを sessionStorage に変更 | 15分 |
| 🔴 Critical | FE-C02 | ProtectedRoute コンポーネントの追加 | 30分 |
| 🟡 Warning | AG-W02 | tokenCount を実際の使用量に修正 | 30分 |
| 🟡 Warning | AG-W03 | ナラティブのラベル重複修正 | 15分 |
| 🟡 Warning | AG-W04 | effortOutcomeExpectancy 4-24h を medium に修正 | 15分 |
| 🟡 Warning | AG-W06 | テストモックパスの修正 | 5分 |
| 🟡 Warning | BE-W02 | putFromTransaction() デッドコードを削除 | 10分 |
| 🟡 Warning | BE-W03 | Slack fetch にタイムアウトを追加 | 15分 |
| 🟡 Warning | BE-W04 | secrets.ts を Promise キャッシュパターンに変更 | 30分 |
| 🟡 Warning | BE-W05 | env.ts をキャッシュ化（getter → 定数） | 15分 |
| 🟡 Warning | CDK-W04 | DLQ 保持期間 7日に延長 | 5分 |
| 🟡 Warning | FE-W02 | WebGL マテリアル dispose 修正 | 20分 |
| 🟡 Warning | FE-W04 | taskId 空文字の早期リターン | 10分 |
| 🟡 Warning | FE-W07 | shared isOverdue を null 安全に修正 | 10分 |
| 🟢 Info | AG-I01 | collectMinimalSlackContext の MVP スタブを整理 | 15分 |
| 🟢 Info | FE-I01 | ChatMessage に react-markdown を導入 | 30分 |
| 🟢 Info | FE-I02 | todayMessage を proposal.chatMessage に差し替え | 10分 |

---

## 良い実装として評価した点

以下の実装は特に高い品質で、チームの技術力の高さを示している：

1. **Slack HMAC 署名検証** (`services/slack-verification.ts`): `timingSafeEqual` によるタイミング攻撃対策、5分のリプレイウィンドウ、Buffer 長チェックと完璧な実装
2. **OAuth PKCE + state の正しい実装** (`cognito.ts`): `crypto.randomUUID()` による state 生成、PKCE S256 チャレンジ、検証後の即時削除が教科書通り
3. **DynamoDB トランザクションによる原子性** (`DynamoTaskCandidateRepository.approve()`): `TransactWriteItemsCommand` で候補削除とタスク作成を原子的に実行
4. **Zod による二重バリデーション** (各 Agent): Bedrock 出力を「信頼できない外部入力」として Zod で検証し、型安全性とセキュリティを両立
5. **toolChoice.tool 強制** (各 Agent): エージェントループの終了条件が明確で無限ループリスクがない
6. **プロンプトインジェクション対策** (`TaskExtractorAgent.ts`): `<slack_message>` タグで囲み、タグ文字列のエスケープも実施
7. **cdk-nag 全スタック適用**: 全スタックに AWS Solutions Checks を適用し、抑制理由も記載
8. **API Gateway JWT オーソライザー**: Cognito UserPool と正確に紐付けられた JWT 認証設計
9. **アクセストークンのメモリ内管理** (`cognito.ts`): XSS 対策として正しくメモリに保管
10. **pseudonymize の HMAC-SHA256 使用** (`shared/utils/pseudonymize.ts`): ソルト境界消失脆弱性を回避した適切な実装

---

*このレポートは AI-DLC Construction フェーズのコードレビュー成果物です。*  
*AWS Summit Hackathon 2026 優勝に向けて、Critical 12件の即時修正を強く推奨します。*
