# API 動作検証ガイド（Swagger UI）

**プロジェクト名**: SABOROU（サボロー）
**バージョン**: v1.0.0
**作成日**: 2026-05-20
**対象**: U-04（Hono API）— `pkgs/backend/`

---

## 概要

本ガイドは Swagger UI を使って Saborou API の全エンドポイントを動作検証する手順を記載する。  
ローカル開発環境（`localhost:3000`）および本番 API Gateway URL の両方に対応している。

### Swagger UI アクセス先

| 環境 | URL |
|------|-----|
| ローカル開発 | `http://localhost:3000/ui` |
| OpenAPI JSON | `http://localhost:3000/doc` |
| OpenAPI YAML ファイル | `pkgs/backend/openapi.yaml` |

---

## 1. 事前準備

### 1.1 ローカル開発サーバーの起動

```bash
# プロジェクトルートから起動
pnpm backend run dev
```

起動ログに以下が表示されれば成功:

```
Saborou API server running at http://localhost:3000
```

> **注意**: `pkgs/backend/.env` に環境変数が設定されていること。  
> 未設定の場合は `pkgs/backend/.env` を作成し、以下を参考に設定する。
>
> ```bash
> ENVIRONMENT=dev
> COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
> COGNITO_CLIENT_ID=local-client-id-placeholder
> DYNAMODB_TABLE_USERS=saborou-users-dev
> DYNAMODB_TABLE_CONNECTIONS=saborou-service-connections-dev
> DYNAMODB_TABLE_TASK_CANDIDATES=saborou-task-candidates-dev
> DYNAMODB_TABLE_TASKS=saborou-tasks-dev
> DYNAMODB_TABLE_PROPOSALS=saborou-proposals-dev
> DYNAMODB_TABLE_HONNE_DATA=saborou-honne-data-dev
> DYNAMODB_TABLE_PERSONAS=saborou-personas-dev
> SLACK_SIGNING_SECRET_ARN=arn:aws:secretsmanager:ap-northeast-1:000000000000:secret:local
> SLACK_CLIENT_SECRET_ARN=arn:aws:secretsmanager:ap-northeast-1:000000000000:secret:local
> OAUTH_STATE_SECRET=local-dev-oauth-state-secret-32bytes!!
> EVENT_BUS_NAME=saborou-events-dev
> ```

### 1.2 Swagger UI を開く

ブラウザで `http://localhost:3000/ui` にアクセスする。

![Swagger UI トップ画面]

画面上部に以下が表示される:
- タイトル: **Saborou API 1.0.0**
- サーバー選択: `http://localhost:3000`（ローカル）/ `https://api.saborou.example.com`（本番）

---

## 2. 認証設定（Bearer JWT）

ほぼ全エンドポイントは **Cognito JWT** による認証が必要。  
実際にトークンを取得してから各エンドポイントを叩く。

### 2.1 JWT トークンの取得（本番 Cognito）

```bash
# Cognito でユーザー認証しトークンを取得
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=<メールアドレス>,PASSWORD=<パスワード> \
  --client-id <COGNITO_CLIENT_ID> \
  --region ap-northeast-1 \
  --query 'AuthenticationResult.IdToken' \
  --output text
```

取得した `IdToken` の値をコピーしておく。

### 2.2 Swagger UI への認証設定

1. Swagger UI 右上の **Authorize** ボタン（🔓アイコン）をクリック
2. **bearerAuth** の `Value` フィールドに `IdToken` の値を貼り付ける
   - `Bearer ` プレフィックスは **不要**（自動付与される）
3. **Authorize** → **Close** をクリック

認証後、鍵アイコンが施錠（🔒）に変わる。

> **ローカル開発でのモックトークン利用**  
> 実際の Cognito が不要なローカル検証時は、auth ミドルウェアのモックトークンを使用できる。  
> テスト用トークン: `local-dev-mock-token-for-testing`  
> （`pkgs/backend/src/middleware/auth.ts` の `NODE_ENV=development` 分岐を確認すること）

---

## 3. エンドポイント別動作検証

### 3.1 System — ヘルスチェック

**目的**: サーバーの起動状態を確認する（認証不要）

| 項目 | 内容 |
|------|------|
| メソッド | `GET` |
| パス | `/health` |
| 認証 | 不要 |
| 期待レスポンス | `200 OK` |

**手順**:
1. `GET /health` セクションを展開 → **Try it out** → **Execute**
2. レスポンスを確認:
   ```json
   {
     "status": "ok",
     "service": "saborou-api",
     "timestamp": "2026-05-20T10:00:00.000Z"
   }
   ```

---

### 3.2 Auth — Slack OAuth フロー

#### GET `/auth/slack` — OAuth フロー開始

**目的**: Slack 認証ページへのリダイレクト URL を確認する

| 項目 | 内容 |
|------|------|
| メソッド | `GET` |
| 認証 | Bearer JWT 必要 |
| 期待レスポンス | `302` Redirect |

**手順**:
1. `GET /auth/slack` を展開 → **Try it out** → **Execute**
2. `302` が返りレスポンスヘッダーの `Location` に Slack OAuth URL が設定されていれば正常

> **注意**: ローカル環境では実際に Slack OAuth は完了しない。  
> `SLACK_CLIENT_ID` が未設定のため URL 生成のみ検証する。

#### GET `/auth/slack/callback` — OAuth コールバック確認

**目的**: コールバック時のパラメータバリデーションを確認する

1. `code` と `state` を空にして実行 → `400 INVALID_CALLBACK` を確認
   ```json
   { "error": { "code": "INVALID_CALLBACK", "message": "Missing code or state parameter" } }
   ```
2. 不正な `state` パラメータで実行 → `400 INVALID_STATE` を確認

---

### 3.3 Tasks — タスク管理

> **前提**: 認証済みユーザーとして JWT を設定済みであること

#### GET `/tasks` — 承認済みタスク一覧

1. 展開 → **Try it out** → **Execute**
2. 期待レスポンス（DynamoDB 接続時）:
   ```json
   { "tasks": [ { "taskId": "...", "title": "...", "status": "approved" } ] }
   ```
3. ローカル（DynamoDB 未接続）の場合: `500` エラーが返るが認証・ルーティングは正常動作

#### POST `/tasks` — タスク手動作成

**Request Body 例**:
```json
{
  "title": "週次ミーティング資料の作成",
  "deadline": "2026-06-01T18:00:00Z",
  "description": "毎週月曜日の定例会議用スライドを作成する"
}
```

**バリデーション確認**:
- `title` を空にして送信 → `400 VALIDATION_ERROR` を確認
- `title` のみ指定して送信 → `201` Created を確認（DynamoDB 接続時）

#### GET `/tasks/candidates` — 候補タスク一覧

- Slack Webhook 経由で自動登録された `pending` 状態のタスク候補を確認する

#### POST `/tasks/candidates/{id}/approve` — 候補を承認

1. `id` に取得した `candidateId` を入力
2. 承認後、`GET /tasks` で `approved` タスクとして表示されることを確認

#### DELETE `/tasks/candidates/{id}` — 候補を却下

1. `id` に `candidateId` を入力 → `204 No Content` を確認
2. 存在しない ID で実行 → `404 NOT_FOUND` を確認

#### GET `/tasks/{id}` — タスク詳細

- `id` に `taskId` を入力し `200` レスポンスを確認

#### PATCH `/tasks/{id}` — タスク編集

**Request Body 例**:
```json
{
  "title": "修正後のタイトル",
  "deadline": "2026-06-15T18:00:00Z"
}
```

#### DELETE `/tasks/{id}` — タスク論理削除

- 削除後、`GET /tasks/{id}` で `status: "deleted"` になることを確認

---

### 3.4 Proposals — AI サボり提案

> **重要**: AI 提案の生成には Amazon Bedrock へのアクセスが必要。  
> ローカルでは実際の AI 応答は得られないが、ルーティング・認証・SSE の接続確認は可能。

#### GET `/tasks/{taskId}/proposal` — JSON レスポンス（同期）

1. `taskId` に存在するタスク ID を入力
2. `stream` パラメータを `false` のまま実行
3. 期待レスポンス（キャッシュあり時）:
   ```json
   {
     "taskId": "01HZF3QJV1",
     "verdict": "can_saboru",
     "summaryText": "このタスクは期限まで余裕があります。",
     "reasoning": ["期限が2週間後", "代替担当者あり"],
     "chatMessage": "大丈夫、後回しにして全然OK！"
   }
   ```

#### GET `/tasks/{taskId}/proposal?stream=true` — SSE ストリーミング確認

Swagger UI では SSE の全イベントを表示できないため、**curl** で検証する:

```bash
# JWT_TOKEN に実際のトークンを設定
JWT_TOKEN="your-cognito-id-token"
TASK_ID="01HZF3QJV1"

curl -N \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Accept: text/event-stream" \
  "http://localhost:3000/tasks/${TASK_ID}/proposal?stream=true"
```

期待される SSE イベント出力:
```
event: verdict
data: {"type":"verdict","verdict":"can_saboru","summaryText":"サボれます。"}

event: chat
data: {"type":"chat","chatMessage":"大丈夫、これは後回しにして全然OK！"}

event: done
data: {"type":"done","proposalId":"prop-01HZF","cached":false}
```

---

### 3.5 Honne — 本音リアクション記録

#### POST `/tasks/{taskId}/honne`

**クイックリプライ例**:
```json
{
  "type": "quick_reply",
  "content": "truly_tired"
}
```

`content` の選択肢:

| 値 | 意味 |
|----|------|
| `truly_tired` | 本当に疲れている |
| `actually_important` | 実は重要 |
| `agree_with_ai` | AI の判断に同意 |
| `disagree_with_ai` | AI の判断に不同意 |

**自由記述例**:
```json
{
  "type": "free_text",
  "content": "この仕事、本当に誰かがやる必要があるのか疑問"
}
```

期待レスポンス（`201`）:
```json
{
  "message": "わかる〜！本当に疲れてる時はサボっていいんだよ。",
  "recorded": true
}
```

**バリデーション確認**:
- `content` を 501 文字以上にして送信 → `400 VALIDATION_ERROR` を確認
- `type` に無効な値を指定 → `400 VALIDATION_ERROR` を確認

---

### 3.6 Connections — サービス接続管理

#### GET `/connections` — 接続一覧

```json
{
  "connections": [
    {
      "service": "slack",
      "status": "connected",
      "connectedAt": "2026-05-20T09:00:00Z"
    }
  ]
}
```

#### DELETE `/connections/{service}` — 接続解除

1. `service` に `slack` を入力 → `204 No Content` を確認
2. `service` に無効な値（例: `twitter`）を入力 → `400 INVALID_SERVICE` を確認:
   ```json
   {
     "error": {
       "code": "INVALID_SERVICE",
       "message": "Unknown service: twitter. Valid services: slack"
     }
   }
   ```

---

### 3.7 Webhooks — Slack Webhook 受信

> **注意**: このエンドポイントは Bearer JWT 認証不要（Slack HMAC 署名で認証する）

#### POST `/webhooks/slack` — URL 検証（Slack セットアップ時）

**署名なしで送信（エラー確認）**:
```json
{
  "type": "url_verification",
  "challenge": "test-challenge-string"
}
```
→ `403 Forbidden`（HMAC 署名なしのため）

**正しい HMAC 署名付きで送信（curl を使用）**:

```bash
SIGNING_SECRET="your-slack-signing-secret"
TIMESTAMP=$(date +%s)
BODY='{"type":"url_verification","challenge":"test-challenge-string"}'

# HMAC-SHA256 署名を生成
SIG_BASE="v0:${TIMESTAMP}:${BODY}"
SIGNATURE="v0=$(echo -n "${SIG_BASE}" | openssl dgst -sha256 -hmac "${SIGNING_SECRET}" | awk '{print $2}')"

curl -X POST http://localhost:3000/webhooks/slack \
  -H "Content-Type: application/json" \
  -H "X-Slack-Request-Timestamp: ${TIMESTAMP}" \
  -H "X-Slack-Signature: ${SIGNATURE}" \
  -d "${BODY}"
```

期待レスポンス:
```json
{ "challenge": "test-challenge-string" }
```

---

## 4. エラーレスポンス確認チェックリスト

| エラーコード | 再現方法 | 期待ステータス |
|------------|---------|-------------|
| `NOT_FOUND` | 存在しないタスク ID で `GET /tasks/{id}` | `404` |
| `VALIDATION_ERROR` | `POST /tasks` で `title` を空に | `400` |
| `INVALID_SERVICE` | `DELETE /connections/twitter` | `400` |
| `OAUTH_DENIED` | `/auth/slack/callback?error=access_denied` | `400` |
| `INVALID_CALLBACK` | `/auth/slack/callback`（code/state なし） | `400` |
| `INVALID_STATE` | `/auth/slack/callback?code=x&state=invalid` | `400` |
| `FORBIDDEN` | `POST /webhooks/slack`（署名なし） | `403` |
| `INVALID_BODY` | `POST /webhooks/slack` に不正 JSON | `400` |

---

## 5. 本番環境での検証

### 5.1 サーバー URL の切り替え

Swagger UI 上部の **Servers** ドロップダウンから本番 URL を選択する:
- `https://api.saborou.example.com` → 実際のデプロイ後の API Gateway URL に読み替える

CDK デプロイ後の URL 確認:
```bash
aws cloudformation describe-stacks \
  --stack-name SaborouApiStack \
  --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
  --output text
```

### 5.2 本番 JWT トークン取得

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters \
    USERNAME=<メールアドレス> \
    PASSWORD=<パスワード> \
  --client-id <COGNITO_CLIENT_ID> \
  --region ap-northeast-1
```

---

## 6. OpenAPI YAML ファイルの活用

生成済みの `pkgs/backend/openapi.yaml` は以下のツールでも利用できる。

### Postman でのインポート

1. Postman を開き **Import** をクリック
2. `pkgs/backend/openapi.yaml` ファイルをドラッグ&ドロップ
3. コレクションとして全エンドポイントが自動生成される
4. **Authorization** タブで Bearer Token を設定して実行

### Redoc でのドキュメント生成

```bash
npx @redocly/cli preview-docs pkgs/backend/openapi.yaml
```

`http://localhost:8080` で Redoc ドキュメントが確認できる。

### OpenAPI バリデーション

```bash
npx @apidevtools/swagger-cli validate pkgs/backend/openapi.yaml
# pkgs/backend/openapi.yaml is valid
```

---

## 7. 動作確認チェックリスト

以下を上から順に実施し、全項目にチェックを入れる。

### 基本動作

- [ ] `GET /health` → `200 OK`、`{"status":"ok"}` を確認
- [ ] Swagger UI でサーバー URL が正しく表示される
- [ ] Bearer 認証を設定後、鍵アイコンが施錠に変わる

### タスク管理

- [ ] `GET /tasks` → `200` タスク一覧（空配列でも可）
- [ ] `POST /tasks` → `201` タスク作成成功
- [ ] `POST /tasks`（title 空）→ `400 VALIDATION_ERROR`
- [ ] `GET /tasks/{id}` → `200` タスク詳細
- [ ] `GET /tasks/{id}`（存在しない ID）→ `404 NOT_FOUND`
- [ ] `PATCH /tasks/{id}` → `200` タスク更新
- [ ] `DELETE /tasks/{id}` → `204 No Content`
- [ ] `GET /tasks/candidates` → `200` 候補一覧
- [ ] `POST /tasks/candidates/{id}/approve` → `201` 承認
- [ ] `DELETE /tasks/candidates/{id}` → `204` 却下

### 提案・本音

- [ ] `GET /tasks/{taskId}/proposal` → `200` 提案 JSON
- [ ] `GET /tasks/{taskId}/proposal?stream=true`（curl）→ SSE イベントが流れる
- [ ] `POST /tasks/{taskId}/honne`（quick_reply）→ `201` 共感メッセージ返却
- [ ] `POST /tasks/{taskId}/honne`（free_text）→ `201` 共感メッセージ返却
- [ ] `POST /tasks/{taskId}/honne`（content 501 文字）→ `400 VALIDATION_ERROR`

### 接続・Webhook

- [ ] `GET /connections` → `200` 接続一覧
- [ ] `DELETE /connections/slack` → `204` or `404`
- [ ] `DELETE /connections/invalid` → `400 INVALID_SERVICE`
- [ ] `POST /webhooks/slack`（署名なし）→ `403 FORBIDDEN`
- [ ] `POST /webhooks/slack`（正しい HMAC 署名付き）→ `200`（url_verification 時は challenge を返す）

---

## 8. 関連文書

| 文書 | パス |
|------|------|
| バックエンド操作ガイド | `aidlc-docs/operations/backend-operations.md` |
| CDK 操作ガイド | `aidlc-docs/operations/cdk-operations.md` |
| OpenAPI 仕様 YAML | `pkgs/backend/openapi.yaml` |
| OpenAPI TypeScript 定義 | `pkgs/backend/src/config/openapi.ts` |

---

*本ガイドは AI-DLC OPERATIONS フェーズの成果物です（v1.0.0 作成: 2026-05-20）。*
