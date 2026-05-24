# U-07: google-integration — NFR Requirements

**バージョン**: 1.0.0
**作成日**: 2026-05-24

---

## NFR-G-P1: アクセストークン更新レイテンシ

- **要件**: トークン更新は 2秒以内に完了すること
- **根拠**: Google Token Endpoint の通常応答は 200〜500ms。Lambda ウォーム時にin-memoryキャッシュで再利用すれば実質0ms
- **測定**: Lambda ログの refreshAccessToken() 処理時間

## NFR-G-P2: Calendar/Gmail 取り込みのタイムアウト

- **要件**: 手動取り込みエンドポイントは 10秒以内に応答すること（Lambda timeout=29s内）
- **根拠**: Google API の応答は通常 1〜3秒。Gmail 50件取得 + TaskExtractor 呼び出しが最長
- **対策**: Gmail fetch と TaskExtractor 呼び出しを直列。超過時は部分結果を返す

## NFR-G-S1: refreshToken の安全な保管

- **要件**: refreshToken を DynamoDB に平文保存しない。必ず Secrets Manager に保管する
- **根拠**: refreshToken は長期有効（revoke まで有効）。Slack Bot Token と同水準のセキュリティ
- **実装**: `saborou/google-token/<userId>` に JSON `{ refreshToken, accessToken, expiresAt }` を保管

## NFR-G-S2: OAuth state HMAC 検証（CSRF対策）

- **要件**: Google OAuth コールバック時に state パラメータの HMAC-SHA256 署名を検証する
- **根拠**: 既存 Slack OAuth と同一パターンを踏襲。CSRF攻撃を防ぐ
- **実装**: 既存 signState/verifyState 関数を再利用

## NFR-G-S3: 最小権限スコープ

- **要件**: Google OAuth スコープは Gmail readonly + Calendar readonly に限定する
- **根拠**: Q1 の回答通り。write スコープは不要。ユーザーへの信頼性確保
- **スコープ**:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/calendar.readonly`

## NFR-G-S4: アクセストークンの in-memory 保管

- **要件**: Lambda in-memory に保管するアクセストークンは、関数インスタンス外に漏れないこと
- **根拠**: アクセストークンは1h有効。Lambda ウォームキャッシュで再利用するが、外部に書き出さない
- **実装**: `Map<userId, { accessToken, expiresAt }>` をモジュールスコープに保持

## NFR-G-R1: API 呼び出し失敗時のフォールバック

- **要件**: Google API が 401/403 を返した際はトークンリフレッシュ → 1回リトライ。それでも失敗なら ConnectionStatus を "token_expired" に更新してエラーを返す
- **根拠**: refreshToken も失効した場合はユーザーに再認可を促す必要がある

## NFR-G-R2: CalendarCache 不在時の判定継続

- **要件**: GoogleCalendarCache が存在しない or TTL 切れの場合、SaboriProposer は calendarContext=undefined でサボり判定を継続する（エラーにしない）
- **根拠**: Calendarデータは任意の追加情報。未取り込みでも既存機能（Slack + 締切ベース）は動作する

## NFR-G-C1: Secrets Manager コスト管理

- **要件**: per-user の Googleトークンシークレット（`saborou/google-token/*`）は、連携解除時に削除する（30日待機なしで ForceDeleteWithoutRecovery）
- **根拠**: Slack Bot Token と同一パターン。課金対象シークレット数を抑制

## NFR-G-C2: Gmail取り込みの maxResults 制限

- **要件**: Gmail messages.list の maxResults は 50件に固定する（1回の取り込みあたり）
- **根拠**: 50件 * messages.get = 51 API リクエスト。Quota 制限（Gmail API: 250 quota units/user/second）に余裕を持つ

## NFR-G-T1: テストカバレッジ

- **要件**: agent/shared の新規コードはカバレッジ 100%（Statements/Functions）を維持する
- **根拠**: 既存品質ゲートを踏襲。backend は 70%以上を維持

## NFR-G-T2: Google API のモック

- **要件**: テストでは Google API を直接呼び出さない。fetch をモックして単体テストを実装する
- **根拠**: 既存 IBedrockClient / SlackClient のモックパターンを踏襲

## NFR-G-O1: 取り込み履歴の可観測性

- **要件**: Calendar/Gmail 取り込みのたびに CloudWatch に構造化ログを出力する
  - `{ event: "calendar_fetch", userId: "...", eventCount: N, busyScore: 0.x }`
  - `{ event: "gmail_fetch", userId: "...", scannedCount: N, extractedCount: M }`
- **根拠**: デバッグと監査のため。PII（メール本文・予定タイトル）はログに含めない
