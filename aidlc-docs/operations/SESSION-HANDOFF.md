# セッション引き継ぎ（SABOROU）

> **次セッション冒頭の使い方**: 「`aidlc-docs/operations/SESSION-HANDOFF.md` を読んで現状を把握して」と伝えればOK。
> 永続メモリ（`MEMORY.md` 経由）も自動で読まれるので、本ファイルはその要約＋直近の作業ログという位置づけ。

最終更新: **2026-05-25**（F+G実装→実AWS E2E→PR #39 マージ完了）

> **🎉 2026-05-25 速報**: バックログ全8項目の実装が完了し **PR #39（F: Google連携 + G: パスキー + URL固定化）を main にマージ済み**。
> 実AWSデプロイ＆E2Eを実施し、実環境でしか出ない多数のバグを修正・反映済み（下記セクション3参照）。
> 現在 **全8スタックが実AWSにデプロイされた状態（customDomain=true）**。課金回避するなら destroy が必要（下記）。

---

## 1. プロジェクト概要

- **SABOROU** = AWS Summit Japan 2026 ハッカソン作品。テーマ「人をダメにするサービス」。
- Slack連携タスク管理 + AI「サボろう」判定（サボってよいか/やるべきかを心理学根拠つきで提案）。
- pnpm モノレポ `pkgs/`: `shared` / `agent` / `backend`(Hono Lambda) / `frontend`(React19+Vite+Tailwind) / `cdk`(CDK v2, 7スタック)。
- AI: **Amazon Bedrock（無印・AgentCoreではない）**。判定=`jp.anthropic.claude-sonnet-4-6`、口調変換=`jp.anthropic.claude-haiku-4-5-20251001-v1:0`。
- リージョン: `ap-northeast-1`。**AWSアカウントは 055259484931（mameta）**。旧 853672407542（他組織）からは完全離脱済み。

---

## 2. いま何が完了しているか ✅

機能改修バックログ A〜G のうち **A・B・C・D・E が完了**（全て `main` にマージ済み・実環境 E2E 確認済み）。

| 機能 | 内容 | PR | E2E |
|---|---|---|---|
| A | ユーザー名/メール非表示バグ修正（access_token→**id_token**） | #24 | ✅ |
| B | Slack↔Cognito ID紐付け（GSI-SlackLookup 逆引き）・投稿→タスク化 | #25 | ✅ |
| C-1 | Slack履歴の遡及取り込み（AIがタスク/雑談を選別） | #26,#36 | ✅ |
| C-2 | 判定をSlackに共有（chat.postMessage） | #26,#36 | ✅ |
| D+E | AIペルソナ切替・口調・体色・挨拶文の多様化（4ペルソナ） | #27 | ✅ |

実環境デバッグで解決した追加PR: #28 Haiku4.5 / #29 連携ボタン / #30 ペルソナ同期 / #31 キャラ反映 / #32 callback認証なし / #33 Secret書込権限 / #34 FRONTEND_URL / #35 相対日付 / #37 channels:readスコープ / #38 EventBridge backfillルート。

> **C-1の挙動メモ（重要・正常動作）**: 「15件取り込みました」でも候補化されたのは1件のみ＝**Bedrockが14件を「タスクではない雑談」と正しく除外した結果**。バグではない（ログ確認済み: skipped_not_task 14 / extracted 1）。

---

## 3. いま何が進行中 / 直前の作業（2026-05-25）

### ✅ F+G 実装完了・PR #39 マージ済み・実AWS E2E実施
- バックログ全8項目完了。F（Google連携: U-07a OAuth基盤 / U-07b Calendar/Gmail/判定連携）+ G（U-08 パスキー）+ URL固定化（カスタムドメイン）を PR #39 で main にマージ。
- **現在 全8スタックが実AWSにデプロイされた状態（customDomain=true）**。`saborou.agentic-jp.com`（フロント）/ `saborou-api.agentic-jp.com`（API）で稼働。

### 🔧 実環境E2Eで判明し修正したバグ（実デプロイでしか出なかった・全てmainに反映済み）
1. **パスキー signInPolicy + RP ID**: `passkey:true` は `signInPolicy.allowedFirstAuthFactors`（password:true も必須）に書く。RP ID は明示指定不可（予約ドメインエラー）→ 省略でCognito自動採用（コミット 3e43d7e）
2. **マネージドログイン ブランディング**: v2 はブランディング無しだと "Login pages unavailable"。`CfnManagedLoginBranding(useCognitoProvidedValues:true)` を追加（17739a9）
3. **client-secret は JSON形式**: Slack/Google とも `{clientId,clientSecret}` のJSONで Secrets Manager 登録（値のみだとOAuth 500）。signing-secret は値のみ
4. **Gmail description 100文字制限**: メール対応で title 50→100 / description 100→300 に緩和（6f2156c）
5. **LogGroup重複**: 過去デプロイ残骸 `/aws/lambda/saborou-task-extractor-dev` が再デプロイを阻害→手動削除
6. **CLIブランディング×CDK衝突**: 暫定CLI作成分を削除しCDK管理に一本化（→今後は再発しない）

### E2E到達状況
- ✅ ログインページ表示 / ✅ Google連携・カレンダー取り込み（タスク化されないのは仕様＝判定材料キャッシュ）/ ✅ Gmail取り込み（修正後・要再検証）/ ✅ Slack Event URL検証・OAuth Redirect設定
- ⏳ **未検証**: パスキー登録→ログイン（Gの目玉・ブラウザ操作待ち）、Gmail取り込みの修正後再試行（タスク候補が出るか）、Slack連携→判定の通し

### ⚠️ 課金注意：実AWSデプロイ中
- 今は **全8スタック稼働中**。検証が済んだら課金回避のため destroy 推奨:
  `pnpm cdk run destroy --all -c customDomain=true -c environment=dev --force`
- **ACM証明書スタック（SaborouAcmUsEast1/AcmApi）は残すと次回 deploy で証明書検証待ちが不要**（証明書は無料）。
- **Cloudflare の CNAME（検証用2 + 向き先2）は destroy しても消えない**。固定ドメインなので向き先は次回deployで同じ値＝再登録不要。
- 残置: CDKToolkit（ap-northeast-1 + **us-east-1 も bootstrap 済み**）、SSM、Secret。

### 8項目バックログの完了状況（チーム共有用の正）
| # | 項目 | 状態 | PR |
|---|---|---|---|
| 1 | Slack Bot Token化・インタラクティブ化・履歴取得 | ✅ | #26 |
| 2 | Slack↔Cognito ユーザーIDミスマッチ | ✅ | #25 |
| 3 | 設定画面のユーザー名/メール非表示 | ✅ | #24 |
| 4 | AI返答の画一化を柔軟に切替 | ✅ | #27 |
| 5 | AIペルソナ切替 | ✅ | #27 #30 #31 |
| 6 | 本音ページのモックデータ除去 | ✅ | コミット db435b6 |
| 7 | Gmail/Googleカレンダー/Google OAuth連携 | ✅ 実装完了・E2E未実施 | #39 |
| 8 | ID/パス認証→パスキー認証 | ✅ 実装完了・E2E未実施 | #39 |

> **2026-05-24 追記**: 項目7（F）・項目8（G）を実装し **PR #39（feature/google-integration）** に統合。CI主要ビルド pass。実AWS E2E は未実施。
> - **F（Google連携）**: AI-DLC で U-07: google-integration として設計→U-07a(OAuth基盤)→U-07b(Calendar/Gmail/判定連携)。Slack OAuth完全踏襲・state HMAC共有化・refreshToken JSON保存。TaskExtractorAgent を汎用化（Slack呼び出しは後方互換維持）。Gmail/Calendarは手動取り込み・raw非永続化。サボり判定に calendarContext(多忙度等)を注入。**backend Google中核コードはテスト100%補完済み**。
> - **G（パスキー）**: U-08: passkey-auth。Cognito を **Essentialsプラン**化し passkey(WebAuthn,RP=CloudFrontドメイン)+choice-based(ALLOW_USER_AUTH)+managed login v2。**パスワードはフォールバックで維持**（必須化しない＝デモで詰まない）。フロント無改修。aws-cdk-lib 2.232.1のL2で実装・CFN出力確認済み。
> - **付随**: pre-existing だった webhook-stack テストFAIL（PR#38由来）を修正しCDK全47グリーン。
> - 品質: shared103(100%)/agent196(100%)/backend307/frontend140/CDK47 全パス・typecheck・synth・Biome OK。
> - **実AWSデプロイ&E2E手順は `aidlc-docs/operations/deploy-e2e-google-passkey.md` に新規作成**（Google Cloud Console設定・SSM/Secret登録・パスキー前提を含む）。
> - ⚠️ Google client-secret は **JSON形式 `{clientId,clientSecret}`** でSecrets Manager登録が必要（値のみだとOAuth失敗）。SSM `/saborou/google/client-id` も別途登録。

---

## 4. 次にやること（残バックログ）

1. **destroy の完了確認**（上記コマンド）。完了したら課金停止。
2. **F: Gmail / Google Calendar / Google OAuth 連携**（バックエンド未実装・新規。Slack OAuthパターンを再利用可能）。
3. **G: パスキー認証**（Cognito大改修・要方式決定・最後）。
4. **PR #23（mashharuki / update_core_functions, 2026-05-23）がオープンのまま** — AI依存度スコア/心理学UI系。A〜D系統とは別。マージ判断はチーム側。要確認。

### 再デプロイ手順（テスト再開時）
```
pnpm cdk run deploy --require-approval never --all
```
- bootstrap / SSM / Bedrock use case（提出済み✅）は残存しているので追加申請不要。
- デプロイ中は **PCをスリープさせない**（過去に SignatureDoesNotMatch で失敗した）。

### ⚠️ 再構築すると Slack 側の Redirect URL 再設定が必須（重要・毎回ハマる）
destroy → 再 deploy で **API Gateway のドメインと CloudFront のドメインが新しく変わる**ため、
Slack アプリに登録済みの旧 Redirect URL では OAuth が `redirect_uri did not match` で失敗する。

再構築のたびに以下を実施する:
1. deploy 出力（または `aws cloudformation describe-stacks`）から **新しい API URL** を取得。
2. **Slack アプリ管理画面**（https://api.slack.com/apps → 対象アプリ）→ **OAuth & Permissions → Redirect URLs** に登録/更新:
   ```
   https://<新API URL>/api/auth/slack/callback
   ```
   ⚠️ パスは必ず `/api/auth/slack/callback`（`/auth/...` ではない。auth ルートは `/api/auth` にマウントされているため。過去にここで何度もハマった）。
3. CloudFront URL も変わるので、CDK の **`FRONTEND_URL` 環境変数**（api-stack.ts、Slack連携後のリダイレクト先）が新 CloudFront URL を指すか確認。
4. 既存ユーザーは Slack を一度「**連携解除 → 再連携**」して、新URL/スコープを反映させる。
5. （Cognito Hosted UI のコールバックURLも CloudFront URL に依存。フロントの env / cognito-stack の callbackUrls も新URLに合わせる。）

💡 **URLを固定したい場合**: Route53 + ACM でカスタムドメインを当てれば再デプロイしてもURLが変わらず、Slack/Cognito の再設定が不要になる。デモ前に固定したいなら検討（ハッカソン規模なら都度設定でも可）。

詳細手順は `aidlc-docs/operations/deploy-e2e-verification.md` も参照。

---

## 5. 制約・ルール（厳守）

- **コミットメッセージ・コメントに Claude 関与を残さない**（co-author 等も付けない）。
- OSS貢献は **Issue合意 → PR** の順序を守る（[[aidlc_upstream_contributions]]）。
- Slack **Bot Token (xoxb-) は絶対に共有・貼り付けさせない**（OAuthで自動取得する。パスワード相当）。
- 全成果物・対話は **日本語**。変数/関数/ファイル名は英語。
- Biome `--unsafe` 注意（noDelete が delete を =undefined に変えテストを壊す）。
- 品質ゲート: agent/shared はカバレッジ100%、typecheck パス、Biome 悪化なし、CDK synth 通過。

---

## 6. 関連ファイル / メモリ

- メモリ: `project-construction-status` / `project-feature-backlog-progress` / `project-bedrock-model-access`（最新の正）。
- 整合性分析: `aidlc-docs/feature-analysis/2026-05-23-feature-integration-analysis.md`。
- デプロイ/E2E手順: `aidlc-docs/operations/deploy-e2e-verification.md`、`aidlc-docs/operations/e2e-test-full-guide.md`。
- C設計: `aidlc-docs/construction/slack-cognito-linking/`, `slack-task-list-bot-token/`, `persona-switching/`。
