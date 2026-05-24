# U-07: google-integration — シーケンス図

**バージョン**: 1.0.0
**作成日**: 2026-05-24

---

## 1. Google OAuth フロー（Slack 完全踏襲）

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend (Hono Lambda)
    participant GAuth as Google Auth
    participant SM as Secrets Manager
    participant DB as DynamoDB

    FE->>BE: GET /api/auth/google (JWT)
    BE->>BE: signState(userId, OAUTH_STATE_SECRET)
    BE-->>FE: { url: "https://accounts.google.com/o/oauth2/v2/auth?..." }

    FE->>FE: window.location.href = url
    FE->>GAuth: リダイレクト (scope: gmail.readonly + calendar.readonly)
    GAuth-->>FE: 認可画面表示

    FE->>BE: GET /api/auth/google/callback?code=xxx&state=xxx
    BE->>BE: verifyState(state, OAUTH_STATE_SECRET)
    BE->>SM: GetSecretValue (googleClientSecret)
    BE->>GAuth: POST /token (code, client_id, client_secret, access_type=offline)
    GAuth-->>BE: { access_token, refresh_token, expires_in }

    BE->>SM: CreateSecret / UpdateSecret (saborou/google-token/<userId>)
    BE->>DB: PutItem ServiceConnections CONN#google
    BE-->>FE: 302 Redirect FRONTEND_URL/settings?google=connected
```

---

## 2. Calendar 手動取り込みフロー

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend (Hono Lambda)
    participant GTS as GoogleTokenService
    participant SM as Secrets Manager
    participant GCAL as Google Calendar API v3
    participant DB as DynamoDB (GoogleCalendarCache)

    FE->>BE: POST /api/google/calendar/fetch (JWT)

    BE->>DB: GetItem ServiceConnections CONN#google
    DB-->>BE: { status: connected, secretArn, googleAccessTokenExpiresAt }

    BE->>GTS: getValidAccessToken(userId)
    alt アクセストークン有効期限 - 5min > now
        GTS-->>BE: accessToken (in-memory cache hit)
    else 期限切れ or 近い
        GTS->>SM: GetSecretValue (saborou/google-token/<userId>)
        SM-->>GTS: { refreshToken, accessToken, expiresAt }
        GTS->>GAuth: POST /token (grant_type=refresh_token)
        GAuth-->>GTS: { access_token, expires_in }
        GTS->>GTS: update in-memory cache
        GTS-->>BE: newAccessToken
    end

    BE->>GCAL: GET /calendars/primary/events (timeMin, timeMax=+24h, maxResults=20)
    GCAL-->>BE: { items: [ { start, end, summary }, ... ] }

    BE->>BE: busyScore 計算 (タイトル非保存)
    BE->>DB: PutItem GoogleCalendarCache (ttl=+24h)
    DB-->>BE: ok
    BE-->>FE: { fetchedAt, upcomingEventCount, nextEventStartsInMinutes, busyScore }

    FE->>FE: 最終取得時刻・多忙度を設定画面に表示
```

---

## 3. Gmail 手動取り込み → TaskCandidate 生成フロー

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend (Hono Lambda)
    participant GTS as GoogleTokenService
    participant GMAIL as Gmail API v1
    participant TEA as TaskExtractorAgent
    participant DB as DynamoDB (TaskCandidates)

    FE->>BE: POST /api/google/gmail/fetch (JWT)

    BE->>GTS: getValidAccessToken(userId)
    GTS-->>BE: accessToken

    BE->>GMAIL: GET /users/me/messages?q=newer_than:7d is:unread&maxResults=50
    GMAIL-->>BE: { messages: [{ id }, ...] }

    loop 各メッセージ (最大50件)
        BE->>GMAIL: GET /users/me/messages/{id}?format=metadata
        GMAIL-->>BE: { headers: [Subject, From, Date], snippet }
        BE->>BE: input = "件名: {subject}\n送信者: {from}\n概要: {snippet}"
        Note over BE: 本文(body)は取得しない
    end

    BE->>TEA: extractTasks(inputTexts[], userId, sourceType="gmail")
    TEA->>Bedrock: converse (extract_tasks Tool Use)
    Bedrock-->>TEA: 構造化タスク候補リスト
    TEA-->>BE: TaskCandidate[]

    BE->>DB: BatchWriteItem TaskCandidates (sourceType="gmail")
    DB-->>BE: ok

    BE->>BE: snippet・inputTexts を変数解放（GCに委ねる）
    BE-->>FE: { fetchedAt, scannedCount, extractedCount, candidates[] }
```

---

## 4. SaboriProposer — Calendar コンテキスト注入フロー

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend (Hono Lambda)
    participant GCACHE as DynamoDB (GoogleCalendarCache)
    participant SPA as SaboriProposerAgent
    participant Bedrock as Amazon Bedrock

    FE->>BE: POST /api/proposals (JWT, { taskId })

    BE->>GCACHE: GetItem USER#<userId> / CACHE#calendar
    alt キャッシュあり + fetchedAt < 24h前
        GCACHE-->>BE: { upcomingEventCount, nextEventStartsInMinutes, busyScore, fetchedAt }
        BE->>BE: calendarContext = CalendarContext object
    else キャッシュなし or 期限切れ
        GCACHE-->>BE: (item not found)
        BE->>BE: calendarContext = undefined
    end

    BE->>SPA: propose(taskId, { task, slackContext?, calendarContext? }, personaId)

    SPA->>SPA: assembleContextNarrative(taskContext)
    Note over SPA: calendarContext がある場合<br/>カレンダーセクションをナラティブに追加

    SPA->>SPA: deriveContextSignals(taskContext)
    Note over SPA: calendarBusyness / nextMeetingPressure を追加

    SPA->>Bedrock: converse(sabori_judgment tool)
    Note over Bedrock: calendarBusyScore, nearestMeetingMinutes<br/>を考慮した判定

    Bedrock-->>SPA: LLMJudgment
    SPA->>SPA: PersonaRenderer で口調変換
    SPA->>DB: PutItem Proposals
    SPA-->>BE: Proposal

    BE-->>FE: Proposal (verdict, chatMessage, reasoning, psychSignals)
```

---

## 5. トークンリフレッシュ フォールバックフロー

```mermaid
sequenceDiagram
    participant BE as Backend
    participant GTS as GoogleTokenService
    participant GAPI as Google API
    participant SM as Secrets Manager
    participant DB as DynamoDB (ServiceConnections)

    BE->>GAPI: API 呼び出し (accessToken)
    GAPI-->>BE: 401 Unauthorized

    BE->>GTS: refreshAccessToken(userId) [フォールバック]
    GTS->>SM: GetSecretValue (refreshToken)

    alt refreshToken 有効
        SM-->>GTS: { refreshToken }
        GTS->>GAuth: POST /token (grant_type=refresh_token)
        GAuth-->>GTS: { access_token, expires_in }
        GTS->>GTS: update in-memory cache
        GTS-->>BE: newAccessToken

        BE->>GAPI: API 呼び出し (newAccessToken) [リトライ]
        GAPI-->>BE: 200 OK (データ)
    else refreshToken も失効
        GAuth-->>GTS: 400 { error: "invalid_grant" }
        GTS-->>BE: TokenRefreshError

        BE->>DB: UpdateItem CONN#google status=token_expired
        BE-->>FE: 401 { error: { code: "TOKEN_REFRESH_FAILED",
                        message: "Googleアカウントの再連携が必要です" } }

        FE->>FE: 設定画面に「再連携が必要です」バナーを表示
    end
```
