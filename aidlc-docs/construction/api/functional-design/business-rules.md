# ビジネスルール定義 — U-04: api

**Unit**: U-04: api
**ステージ**: CONSTRUCTION / Functional Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## BR-API-01: ユーザー認可（リソース所有者検証）

**説明**: 全ての保護エンドポイントは、JWT から取得した userId がリクエスト対象リソースの所有者と一致することを検証する。

**ルール**:
- Cognito Authorizer が発行した `sub` クレームを userId として使用する
- `GET /api/tasks/:id` で取得した Task の userId が JWT の userId と不一致の場合 403 を返す
- タスク候補・提案・本音データも同様に所有者チェックを実施する
- `/health` と `/webhooks/slack` は認証を必要としない（公開エンドポイント）

**実装場所**: `src/middleware/auth.ts`（Hono ミドルウェア）

---

## BR-API-02: タスク候補承認の原子性

**説明**: タスク候補の承認操作（candidate → task 移行）は DynamoDB TransactWriteItems で原子的に実行される。

**ルール**:
- `POST /api/tasks/candidates/:id/approve` は `ITaskCandidateRepository.approve()` に委譲する
- approve() は `TransactWriteItems`（Delete TaskCandidates + PutItem Tasks）を実行する
- いずれかが失敗した場合はトランザクション全体をロールバックし、409 を返す
- 既に承認済みの候補を再承認しようとした場合も 409 を返す

---

## BR-API-03: タスク論理削除

**説明**: タスクの DELETE は物理削除ではなく論理削除（status=deleted）を行う。

**ルール**:
- `DELETE /api/tasks/:id` は `ITaskRepository.softDelete()` を呼び出す
- status が 'deleted' になったタスクは `GET /api/tasks` の一覧から除外する
- 削除済みタスクへの `GET /api/tasks/:id` は 404 を返す

---

## BR-API-04: SSE ストリーミング判定ロジック

**説明**: `GET /api/tasks/:id/proposal` は Proposals テーブルのキャッシュを確認し、有効なキャッシュがある場合は再生成をスキップする。

**ルール**:
- `IProposalRepository.findLatestByTaskId(taskId)` でキャッシュ確認
- `proposal.nextCheckAt > now()` の場合はキャッシュを返す（stream=false でも stream=true でも同様）
- キャッシュが存在しない、または期限切れの場合は `SaboriProposerAgent` を呼び出す
- `stream=false`（デフォルト）: Agent の応答完了を待って JSON で返す
- `stream=true`: Agent の非同期イテレータを SSE でストリーミング配信する

---

## BR-API-05: Slack Webhook 署名検証（BE-06）

**説明**: Slack Events API からのリクエストは `X-Slack-Signature` ヘッダーを使って HMAC-SHA256 で検証する。

**ルール**:
- `X-Slack-Signature` が欠如している場合は 401 を返す
- 署名検証に失敗した場合は 403 を返す
- `X-Slack-Request-Timestamp` が現在時刻から 5 分以上ずれている場合はリプレイ攻撃として 403 を返す
- `type=url_verification` の場合は `{ challenge }` をそのまま返す（EventBridge への転送なし）
- 署名検証成功後、EventBridge にイベントを転送する

---

## BR-API-06: 本音データのレスポンス固定文言

**説明**: `POST /api/tasks/:id/honne` のレスポンスに含まれる `reply` と `visionText` は固定文言を使用する（LLM 呼び出し不要）。

**ルール**:
- `reply`: サボローの返答として「ちゃんと聞いてるよ。溜め込まず、話してね。」等の固定フレーズをランダムまたは順番に返す
- `visionText`: 「あなたの気持ちが、将来の取扱説明書になります。」（固定）
- MVP では PersonaRenderer を呼び出さない（コスト削減）

---

## BR-API-07: OAuth ステート検証（CSRF 防止）

**説明**: `POST /api/connections/slack/callback` は OAuth ステートパラメータを検証する。

**ルール**:
- state パラメータが欠如している場合は 400 を返す
- state 検証は Cognito セッションに紐づく（MVP では簡略化して userId ベースのランダムトークンを使用）
- 検証失敗時は 403 を返す

---

## BR-API-08: バリデーション規則

**説明**: 全入力は Zod スキーマで検証し、失敗時は 400 + VALIDATION_ERROR を返す。

| エンドポイント | 検証対象 | 主なルール |
|-------------|---------|-----------|
| POST /api/tasks | body.title | 1〜200 文字 |
| POST /api/tasks | body.deadline | ISO 8601 形式または省略 |
| PATCH /api/tasks/:id | body | 少なくとも 1 フィールド必須 |
| POST /api/tasks/:id/honne | body.content | 1〜500 文字 |
| POST /api/connections/slack/callback | body.code, body.state | 必須文字列 |

---

## BR-API-09: 自己リソースのみアクセス許可

**説明**: 全ての DynamoDB クエリは JWT の userId をパーティションキーのプレフィックスとして使用し、他ユーザーのデータにアクセスできない構造にする。

**ルール**:
- `findApprovedByUserId(userId)` のように userId をリポジトリメソッドに必ず渡す
- パスパラメータ `:id` だけでリソースを取得する際は、取得後に userId 所有者チェックを行う
- 所有者不一致は 403（情報漏洩防止のため 404 でも可だが、403 を標準とする）

---

## BR-API-10: ヘルスチェックエンドポイント

**説明**: `GET /health` は認証なしで DynamoDB への接続疎通を返す軽量なエンドポイント。

**ルール**:
- DynamoDB へのアクセスは不要（Lambda 起動確認のみで十分）
- レスポンス: `{ status: 'ok', timestamp: '<ISO8601>' }`
- API Gateway の `/health` ルートは Cognito Authorizer を適用しない（既存 CDK 設定準拠）
