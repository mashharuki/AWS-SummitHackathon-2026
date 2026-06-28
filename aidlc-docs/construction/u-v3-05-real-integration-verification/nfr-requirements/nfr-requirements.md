# U-V3-05 NFR Requirements

**Unit**: U-V3-05: real-integration-verification
**作成日**: 2026-06-17
**依存 Unit**: U-V3-01, U-V3-02, U-V3-03, U-V3-04

---

## 目的

本 Unit は新機能の実装ではなく、U-V3-01〜04 で実装した全コンポーネントが
実際の AWS 環境・AgentCore・ElevenLabs・Slack 上で正常に動作することを証明し、
決勝デモに備えた手順書・トラブルシューティング資料を生成する。

---

## NFR 要件一覧

### 信頼性（Reliability）

#### NFR-V305-R1: 全パッケージビルド・テスト通過
- **要件**: 影響を受ける全パッケージ（pkgs/backend, pkgs/cdk, pkgs/extension, pkgs/agent, pkgs/shared）が
  `pnpm test` および `tsc --noEmit` でエラーゼロで通過すること
- **許容**: テスト失敗ゼロ。型エラーゼロ
- **検証方法**: 各パッケージのテスト実行ログを証拠として記録する
- **重要度**: Critical（Code Generation のゲート条件）

#### NFR-V305-R2: CDK synth 成功
- **要件**: `pnpm --filter @saborou/cdk synth` が Errors=0 で完了すること
- **許容**: Warnings は許容するが、cdk-nag の Error は不可
- **検証方法**: `cdk synth` 出力ログを確認・記録する
- **重要度**: Critical

#### NFR-V305-R3: AgentCore Gateway デプロイ後の疎通確認
- **要件**: CDK deploy 後、AgentCore Gateway に対して `aws bedrock-agent-runtime` CLI または
  AWS コンソールからターゲットステータスが `AVAILABLE` であることを確認できること
- **許容**: デプロイ後 10 分以内に `AVAILABLE` となること
- **検証方法**: AWS コンソールまたは CLI 出力スクリーンショット
- **重要度**: High

#### NFR-V305-R4: フォールバックパス稼働確認
- **要件**: ElevenLabs `streamable_http` 登録が失敗した場合でも、
  Chrome 拡張 `clientTools` フォールバックを使ったデモが実行可能であること
- **許容**: フォールバック切り替えが 30 秒以内に完了すること
- **検証方法**: フォールバックモードでのデモ実行ログ
- **重要度**: High

---

### 観測性（Observability）

#### NFR-V305-O1: CloudWatch Logs での MCP tool-call 監査確認
- **要件**: ElevenLabs または AgentCore からの MCP ツール呼び出しが CloudWatch Logs に
  `requestId`, `toolName`, `userId`, `status`, `durationMs` を含む構造化ログとして記録されること
- **許容**: ログエントリが 5 分以内に CloudWatch に反映されること
- **検証方法**: CloudWatch Logs Insights クエリ結果を証拠として保存する
- **重要度**: High（Security Baseline 監査要件）

#### NFR-V305-O2: AgentCore/ElevenLabs 呼び出しのエラーログ確認
- **要件**: 意図的なエラーケース（未認証リクエスト・allowlist 外ツール）が
  CloudWatch に安全なエラーメッセージとして記録され、トークンや内部パスを含まないこと
- **許容**: エラーログに機密情報が存在しないこと
- **検証方法**: エラーログのサンプルをトークン漏洩スキャンにかける
- **重要度**: Critical（Security Baseline SECURITY-08）

#### NFR-V305-O3: ElevenLabs Dashboard 登録ステータス確認
- **要件**: ElevenLabs Dashboard の Agent 設定画面で MCP Server が
  `streamable_http` として登録されており、ツール一覧が反映されていること
- **許容**: 登録後 5 分以内にツール一覧が表示されること
- **検証方法**: Dashboard のスクリーンショット（ツール一覧を含む）
- **重要度**: High

---

### 手動 E2E 検証証拠（Manual E2E Evidence）

#### NFR-V305-E1: `saborou_get_tasks` エンドツーエンド呼び出し
- **要件**: ElevenLabs Agent が音声で「タスクを見せて」等を受け取り、
  MCP Server 経由で `saborou_get_tasks` を呼び出し、タスク一覧をユーザーに返すことを確認する
- **許容**: 成功レスポンスが 3 秒以内に返ること
- **検証方法**: 音声会話のトランスクリプトまたは動画証拠
- **重要度**: Critical（決勝デモの核心）

#### NFR-V305-E2: Slack 返信エンドツーエンド確認
- **要件**: MCP ツール `saborou_reply_to_slack` が Slack テストチャンネルへの返信を
  ユーザー承認後に送信できることを確認する
- **許容**: 承認から 5 秒以内に Slack に投稿が届くこと
- **検証方法**: Slack チャンネルの投稿スクリーンショット
- **重要度**: High

#### NFR-V305-E3: `saborou_delegate_to_claude` エンドツーエンド確認
- **要件**: MCP ツール `saborou_delegate_to_claude` が Slack テストチャンネルへの
  `@Claude` メンションメッセージをユーザー承認後に送信できることを確認する
- **許容**: 承認から 5 秒以内に Slack に投稿が届くこと
- **検証方法**: Slack チャンネルの投稿スクリーンショット
- **重要度**: High

#### NFR-V305-E4: 未認証リクエスト拒否確認
- **要件**: 認証ヘッダーなしの MCP ツール呼び出しが 401 または安全なエラーで拒否され、
  ツールが実行されないことを確認する
- **許容**: 拒否レスポンスが 500ms 以内に返ること
- **検証方法**: curl または HTTP クライアントでの試験ログ
- **重要度**: Critical（Security Baseline SECURITY-02）

---

### デモ可用性（Demo Availability）

#### NFR-V305-A1: 並列アクセス耐性
- **要件**: 決勝会場で審査員・観客が同時にアクセスした場合（想定 2〜5 並列）でも
  MCP ツール応答が 5 秒以内に返ること
- **許容**: 5 並列リクエストで p99 < 5000ms
- **検証方法**: 簡易負荷テストスクリプト（例: Apache Bench または k6）
- **重要度**: Medium

#### NFR-V305-A2: デモリセット手順の確立
- **要件**: デモ開始前にテストデータをリセットし、クリーンな状態でデモを開始できる
  手順が文書化されていること
- **許容**: リセット手順が 5 分以内に完了すること
- **検証方法**: 手順書の存在とリハーサルでの動作確認
- **重要度**: High

---

### 保守性（Maintainability）

#### NFR-V305-M1: トラブルシューティングマトリクスの完全性
- **要件**: AgentCore, Cognito, Slack, Google, ElevenLabs, Hono fallback の
  主要エラーシナリオごとに原因・確認手順・解決方法が記載されたマトリクスが存在すること
- **許容**: 各外部サービスについて最低 3 シナリオを網羅すること
- **検証方法**: マトリクスドキュメントのレビュー
- **重要度**: High

#### NFR-V305-M2: 検証スクリプトのシークレット安全性
- **要件**: 検証スクリプトや手順書に AWS キー・Slack トークン・ElevenLabs API キーが
  ハードコードされていないこと。環境変数または Secrets Manager 参照のみ許可
- **許容**: スクリプト内のシークレット参照ゼロ（ハードコード）
- **検証方法**: スクリプトファイルの静的スキャン（grep でシークレットパターン検索）
- **重要度**: Critical（Security Baseline）

---

## NFR 優先度マトリクス

| ID | カテゴリ | 優先度 | デモへの影響 |
|----|---------|--------|------------|
| NFR-V305-R1 | 信頼性 | Critical | テスト失敗 = リリース不可 |
| NFR-V305-R2 | 信頼性 | Critical | CDK 失敗 = デプロイ不可 |
| NFR-V305-E1 | E2E 証拠 | Critical | コアデモ機能 |
| NFR-V305-E4 | E2E 証拠 | Critical | セキュリティ証明 |
| NFR-V305-O2 | 観測性 | Critical | SECURITY-08 準拠 |
| NFR-V305-M2 | 保守性 | Critical | シークレット漏洩防止 |
| NFR-V305-R3 | 信頼性 | High | AgentCore 稼働確認 |
| NFR-V305-R4 | 信頼性 | High | フォールバック稼働 |
| NFR-V305-O1 | 観測性 | High | 監査証拠 |
| NFR-V305-O3 | 観測性 | High | ElevenLabs 登録確認 |
| NFR-V305-E2 | E2E 証拠 | High | Slack 返信確認 |
| NFR-V305-E3 | E2E 証拠 | High | @Claude 委譲確認 |
| NFR-V305-A2 | 可用性 | High | デモリセット手順 |
| NFR-V305-M1 | 保守性 | High | トラブルシューティング |
| NFR-V305-A1 | 可用性 | Medium | 並列アクセス耐性 |

---

## Security Baseline 適用結果

| Security Baseline ルール | 適用可否 | 準拠状況 | 備考 |
|--------------------------|---------|---------|------|
| SB-01: IAM 最小権限 | N/A | - | 新規 IAM リソースなし |
| SB-02: シークレット外部化 | Applicable | NFR-V305-M2 で対応 | スクリプトのハードコード禁止 |
| SB-03: HTTPS 必須 | N/A | - | 新規エンドポイントなし |
| SB-04: 入力バリデーション | N/A | - | 新規データ処理なし |
| SB-05: 認証・認可 | Applicable | NFR-V305-E4 で対応 | 未認証拒否の実証 |
| SB-06: 監査ログ | Applicable | NFR-V305-O1/O2 で対応 | ログ品質の確認要件 |
| SB-07: fail-closed | N/A | - | 新規フロー制御なし |
| SB-08: トークン非漏洩 | Applicable | NFR-V305-O2/M2 で対応 | エラーログとスクリプト |
| SB-09: テストカバレッジ | Applicable | NFR-V305-R1 で対応 | 全パッケージテスト通過 |
| SB-10〜15 | N/A | - | 新規コンポーネントなし |

**ブロッキングファインディング**: なし

---

## 次ステージ

NFR Design にて以下のパターンを定義する:
1. **Verification Evidence Pattern**: 検証証拠の収集・保存・整理方法
2. **Safe Script Pattern**: シークレット安全なスクリプト構造
3. **Troubleshooting Matrix Pattern**: エラーシナリオの体系的な文書化
4. **Fallback Runbook Pattern**: フォールバック手順の実行可能な記述
