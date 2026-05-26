# セッション引き継ぎ（ガント機能 + 認証401問題）

最終更新: **2026-05-26**
作業ブランチ: **`feature/gantt-gamification`**（main にはまだマージしていない）

> 次セッション冒頭: 「`aidlc-docs/operations/SESSION-HANDOFF-gantt-20260526.md` を読んで続きから」でOK。

---

## 0. いま最優先で解くべき問題 🔴

**実AWS（https://saborou.agentic-jp.com）で全API呼び出しが 401 Unauthorized になり、ログインできない。**

- 症状: `/api/tasks`・`/api/tasks/candidates`・`/api/users/me/dependency-score` 等すべて401。
- ユーザーがブラウザの **localStorage を完全クリア + 再ログインしても解消しない**。
- カレンダー/Gmail が動かないのも、この401が根本原因（機能の問題ではない）。

### 切り分け済みの事実（ここまでの調査結果）
1. **AWS側の設定はすべて正常**:
   - JWT オーソライザー: Issuer=`https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_1s13MCNAT` / Audience=`5mthfmer1a05dhocs6r5mu49lq`（API ID=`71m86enw87`）
   - env-config.json（S3配信）の Cognito 設定も上記と完全一致（UserPoolId=`ap-northeast-1_1s13MCNAT` / ClientId=`5mthfmer1a05dhocs6r5mu49lq`）
   - Cognito ユーザーも存在（`57742a68-80f1-70aa-4f07-dc901a27488e` = mameta.zk@gmail.com / CONFIRMED）
   - トークン有効期限: id/access=デフォルト1h、refresh=30日
   - API Lambda(`/aws/lambda/saborou-api-dev`)に401ログ無し = **API Gateway の JWT authorizer 段階で弾かれている**（Lambda到達前）
2. **API Gateway アクセスログは無効**なので authorizer の拒否理由はログから取れない。
3. **フロントのトークン保存設計**（`pkgs/frontend/src/lib/cognito.ts`）:
   - `id_token`/`access_token` は **メモリ変数のみ**（`_idToken`/`_accessToken`、L34-43）→ リロードで消える
   - `refresh_token` だけ localStorage キー `saboru_rt` に保存（L54-62）
   - 起動時 `AuthProvider.tsx`(L49-) が `getRefreshToken()`→`refreshAccessToken()` でトークン復元する設計
   - `refreshAccessToken()`(cognito.ts L~180) は access/id 両方を更新する（実装は正しい）
   - ユーザーの localStorage には `saboru_rt` と `saboru_locale` のみ存在（= 正常な保存状態）

### 未確定（次にやるべき調査）
- **トークンの中身が未確認**。ユーザーのブラウザ Console で出した結果が「トークンなし（localStorageキー=saboru_rt, saboru_locale のみ）」だった。これは設計通り（id/accessはメモリ）なので、**ページロード直後にメモリが空なのは当然**。問題は「リフレッシュで復元されない or 復元したトークンが authorizer に弾かれる」のどちらか。
- **次の決め手**: ログイン直後（リロード前）に Console で以下を実行し、メモリ上の id_token をデコードして `aud`/`iss`/`token_use`/`exp` を確認する:
  ```js
  // ログイン直後（タスク画面が出た状態）で実行
  // cognito.ts のメモリ変数は直接読めないので、ネットワークタブで
  // /api/tasks リクエストの Authorization ヘッダーの Bearer トークンをコピーし、
  // https://jwt.io 等でデコードして aud/iss/token_use/exp を確認する
  ```
  → `aud` が `5mthfmer1a05dhocs6r5mu49lq` と一致するか、`token_use` が `id` か、`exp` が未来か を見る。
- **有力仮説**:
  - (A) ログインの OAuth コールバック（`exchangeCodeForTokens`）で取得するトークンの aud がオーソライザーと違う（別 Client ID で発行されている）。Hosted UI ログインと SPA の client_id 不一致など。
  - (B) `exchangeCodeForTokens` 自体は成功するが、`handleCallback` でメモリ保存後、`/tasks` に遷移してリロードが挟まりメモリが飛ぶ → refresh で復元しようとするが refresh_token が無効。
  - (C) Cognito の Managed Login(v2) と OAuth トークンエンドポイントの client 設定差異。

### ログイン処理の場所（デバッグ起点）
- コールバック: `pkgs/frontend/src/pages/AuthCallbackPage.tsx`（L51 `exchangeCodeForTokens(code, codeVerifier)` → L53 `handleCallback(accessToken, idToken, refreshToken, expiresIn)`）
- トークン交換: `pkgs/frontend/src/lib/cognito.ts` L133 `exchangeCodeForTokens`（grant_type=authorization_code, `/oauth2/token`）
- リフレッシュ: 同 L~180 `refreshAccessToken`（grant_type=refresh_token）
- 保存: `setIdToken`(L34, メモリ) / `setAccessToken`(L22, メモリ) / `setRefreshToken`(L54, localStorage `saboru_rt`)

### 次の一手の候補
1. **実トークンのデコード**（上記）で aud/token_use/exp を確定 → 原因を A/B/C に絞る。
2. もし aud 不一致なら、ログインに使う client_id（フロントの `CLIENT_ID()` = env-config の VITE_COGNITO_CLIENT_ID）と、Hosted UI のログインで実際に発行された client が違う可能性 → Cognito の app client 設定を見直す。
3. **設計改善案**（401頻発の根治）: id_token をメモリのみでなく sessionStorage にも退避し、リロード直後の空白期間を無くす。または AuthProvider の復元完了まで API 呼び出しを待たせる（useTasks 等が isLoading 中は fetch しない）。

---

## 1. このセッションで完了した実装（feature/gantt-gamification ブランチ）

### ✅ 3バンドガントチャート機能（ピッチの「段取り逆算」を実装）
タスク → AIが作業分解 → カレンダー予定を避けてスケジューリング → 3バンドガント表示。
コミット済み（main 比 全部このブランチ）:

| 領域 | 内容 |
|---|---|
| shared | `SaboriSchedule`/`ScheduleBlock`/`BandType`(saboru/work/decision/**busy**)/`BusySlot`(title付き) 型・Zod。`pkgs/shared/src/types/schedule.ts` |
| agent | `SchedulePlannerAgent`（Bedrock Tool Use `plan_schedule`、toolChoice強制+Zod二重検証、jp.anthropic.claude-sonnet-4-6）+ `saboruBlockCalc`（さぼろう帯を決定論的算出 + busyブロック可視化）。`pkgs/agent/src/schedule-planner/` カバレッジ100% |
| backend | `GET /api/tasks/:id/schedule`（`pkgs/backend/src/routes/schedule.ts`）/ `CalendarTimeslotService`（予定の時間区間+予定名を揮発取得）|
| frontend | `GanttChart`（3バンド・NOW青点線・締切赤線・凡例・**左ラベル列sticky固定で右だけ横スクロール**）/ `GanttPanel`（取得失敗時はダミー表示）/ `useGanttSchedule` / `ganttLayout.ts` / `ganttScoringUtils.ts`（ガント結果→既存スコア連動）|
| UI再編 | `TaskDetailPage` を PC3ペイン（左:文脈+判定 / 中央:ガント / 右:チャット）・スマホ4タブ（ガント/判定/チャット/ゲーム）に再編。ゲーム要素は全維持しPopover/Drawerで「押下して開く」。汎用 `Drawer`/`Popover`/`BottomSheet` 新規 |

### ✅ Gmail取り込み500エラー修正
50件直列Bedrock処理→75秒でAPI Gateway 29秒タイムアウト だったのを、**8件に絞り+Promise.all並列化**で解消（`pkgs/backend/src/routes/google.ts` gmail/fetch）。

### ✅ カレンダー予定のタスク抽出 + busy可視化
- `calendar/fetch` で予定の summary を `TaskExtractorAgent` に渡してタスク候補化（「デザイン変更締め切り」等。単なる予定は除外）。集計値キャッシュは維持。Promise.all並列。
- 既存予定を**ガント上にグレーの「予定」ブロック（予定名付き）**として可視化（作業もサボりもできない時間帯を見せる）。PII方針は「予定名は表示のみ・非永続化」に緩和。

### 品質ゲート（全達成）
全テスト: shared125 / agent227(100%) / backend337 / frontend373 / cdk69。typecheck・build 全OK。今回変更ファイルは Biome クリーン（既存ファイルの既存差分は範囲外）。

---

## 2. デプロイ状況（実AWS）

- **全スタックが customDomain=true でデプロイ済み・UPDATE_COMPLETE**。今回のガント/Gmail/カレンダー新コードも反映済み。
- URL: フロント `https://saborou.agentic-jp.com` / API `https://saborou-api.agentic-jp.com`
- アカウント 055259484931（mameta）/ ap-northeast-1
- **重要・今回ハマった点**: customDomain 切替で Frontend スタックの CloudFront DomainName export を Api/ConfigDeploy が import 中だとロールバックする。解決策は **先に Api/ConfigDeploy を customDomain=true でデプロイして export 参照を外す → 次に Frontend をデプロイ**（`--exclusively` で個別デプロイ）。
- **Cloudflare DNS**: `saborou`(→CloudFront d2tt87bchx0d15) と `saborou-api`(→API Gateway regional `d-m5lttv8v3k.execute-api.ap-northeast-1.amazonaws.com`) の CNAME 必要・**DNS only**。今回 `saborou-api` が古い `d-bsxzm6ren6` を指していて引けなかったので新ターゲットに更新済み。
- デプロイコマンド: `cd pkgs/cdk && npx cdk deploy <Stack> --require-approval never --context customDomain=true --context environment=dev --exclusively`（PCをスリープさせない）

### 主要リソースID
- API ID: `71m86enw87` / HttpApiUrl: `https://71m86enw87.execute-api.ap-northeast-1.amazonaws.com`
- Cognito UserPool: `ap-northeast-1_1s13MCNAT` / Client: `5mthfmer1a05dhocs6r5mu49lq` / Domain: `saborou-auth-dev.auth.ap-northeast-1.amazoncognito.com`
- CloudFront: `E3TM47PD6J9JXT`（d2tt87bchx0d15.cloudfront.net）/ S3: `saborou-frontend-055259484931-dev`
- API Lambda: `saborou-api-dev`（timeout 29s / memory 256）

---

## 3. 残タスク

1. **🔴 認証401の根治**（セクション0）。実トークンのデコードから。これが解けないと実環境で何も確認できない。
2. ガント機能のE2E確認（401解決後）: タスク詳細でガント表示 / カレンダー予定がbusyブロックで出るか / カレンダー→タスク抽出（「デザイン変更締め切り」が候補に出るか）/ Gmail取り込み（500出ないか）。
3. `feature/gantt-gamification` を main にマージ（E2E確認後）。
4. （未着手の論点）カレンダー予定タスク抽出時の締切推定・重複取り込み防止など精度面。

---

## 4. 制約・ルール（厳守）
- コミットメッセージ・コメントに Claude 関与を残さない（co-author等付けない）。
- 細かくコミットしながら進める（ユーザー指示）。新ブランチ運用。許可確認は不要。
- 全成果物・対話は日本語。変数/関数/ファイル名は英語。
- Biome `--unsafe` 注意（noDelete が delete を =undefined に変えテストを壊す）。
- 品質ゲート: agent/shared カバレッジ100%、全パッケージ typecheck/build、Biome 悪化なし、CDK synth。
- デプロイ中は PC をスリープさせない（SignatureDoesNotMatch 回避）。
- ピッチ（`SABOROU_pitch.md`）の思想は変えない。ガントは「AIが作業分解してスケジューリングする時間表」そのもの。ゲーミフィケーションは全要素を残し「押下して開く」UXに再編（土台化）。
