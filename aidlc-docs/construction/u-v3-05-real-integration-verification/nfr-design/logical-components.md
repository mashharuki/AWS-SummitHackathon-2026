# U-V3-05 Logical Components

**Unit**: U-V3-05: real-integration-verification
**作成日**: 2026-06-17

---

## 概要

U-V3-05 の成果物は「ランタイムコード」ではなく「検証スクリプト・ドキュメント群」である。
論理コンポーネントは以下の 5 つで構成される。

---

## コンポーネント一覧

### LC-V305-01: Verification Script Suite（検証スクリプト群）

**配置**: `scripts/verify-*.sh`（ワークスペースルート配下の `scripts/` ディレクトリ）

**責務**:
- AWS 環境・外部サービスへの疎通確認を自動化する
- 結果を `evidence/` 配下のログファイルとして保存する
- シークレットをハードコードせず、環境変数経由でのみ参照する

**構成ファイル**:

```
scripts/
├── verify-build-test.sh      ← NFR-V305-R1: 全パッケージビルド・テスト確認
├── verify-cdk-synth.sh       ← NFR-V305-R2: CDK synth 確認
├── verify-agentcore.sh       ← NFR-V305-R3: AgentCore ステータス確認
├── verify-mcp-auth.sh        ← NFR-V305-E4: MCP 認証・未認証テスト
├── verify-cloudwatch.sh      ← NFR-V305-O1: CloudWatch Logs クエリ
├── verify-secret-scan.sh     ← NFR-V305-M2: シークレットスキャン
└── demo-reset.sh             ← NFR-V305-A2: デモリセット
```

**入力**: 環境変数（`API_ENDPOINT`, `COGNITO_TOKEN`, `AWS_REGION`, `DEMO_USER_ID`）
**出力**: `evidence/{NFR_ID}/` 配下のテキストログ
**依存**: AWS CLI, curl, grep

---

### LC-V305-02: Evidence Store（証拠ストア）

**配置**: `aidlc-docs/construction/u-v3-05-real-integration-verification/evidence/`

**責務**:
- 各 NFR 要件に対応した証拠ファイルを格納する
- `README.md`（証拠インデックス）でどの証拠がどの NFR を満たすかを対応付ける

**構造**:

```
evidence/
├── README.md              ← 証拠インデックス（NFR ID ↔ ファイル対応表）
├── R1-build-test/
├── R2-cdk-synth/
├── R3-agentcore-status/
├── R4-fallback/
├── O1-cloudwatch-logs/
├── O2-error-log-scan/
├── O3-elevenlabs-dashboard/
├── E1-get-tasks-e2e/
├── E2-slack-reply/
├── E3-delegate-to-claude/
├── E4-unauth-reject/
├── A1-load-test/
└── A2-demo-reset/
```

**セキュリティルール**:
- AWS アカウント ID、Cognito User Pool ID は証拠ファイルに含まれる可能性があるが許容
- Slack トークン、ElevenLabs API キー、Cognito アクセストークンは含めない
- スクリーンショット（PNG）は git commit 前に確認し、`.gitignore` 対象にすることを推奨

---

### LC-V305-03: Troubleshooting Matrix（トラブルシューティングマトリクス）

**配置**: `aidlc-docs/construction/u-v3-05-real-integration-verification/TROUBLESHOOTING.md`

**責務**:
- 外部サービス別（6 サービス × 3 シナリオ以上）のエラーシナリオを体系化する
- 決勝デモ中に問題が発生した際の即時対応ガイドとして機能する

**構造**:

```markdown
# トラブルシューティングマトリクス

## AgentCore Gateway
| シナリオ | 推定原因 | 確認手順 | 解決方法 | 回避策 |
|---------|---------|---------|---------|--------|

## Cognito (JWT 認証)
| ... |

## Slack Webhook
| ... |

## ElevenLabs
| ... |

## Google (Calendar/Gmail)
| ... |

## Hono Fallback
| ... |
```

**更新タイミング**: Code Generation 後・デモリハーサル後

---

### LC-V305-04: Demo Runbook（デモ手順書）

**配置**: `aidlc-docs/construction/u-v3-05-real-integration-verification/DEMO_RUNBOOK.md`

**責務**:
- 決勝デモの当日手順を Step-by-Step で記述する
- フォールバック手順（ElevenLabs → Chrome clientTools → Web UI）を含める
- 実行時間の目安を各 Step に記載する

**構造**:

```markdown
# デモ手順書（決勝版）

## 事前準備（デモ 30 分前）
- Step 1: AWS デプロイ状態確認
- Step 2: デモデータリセット（demo-reset.sh）
- Step 3: ElevenLabs Agent ウォームアップ

## メインデモシナリオ（7 分）
- Step 1: ElevenLabs 音声エージェント起動
- Step 2: 「タスクを見せて」→ saborou_get_tasks E2E
- Step 3: 「Slack に返信して」→ saborou_reply_to_slack E2E
- Step 4: 「Claudeに頼んで」→ saborou_delegate_to_claude E2E

## フォールバック A: ElevenLabs MCP 接続失敗
- Step 1: Chrome 拡張 clientTools への切り替え確認（30 秒）
- Step 2: clientTools でデモ継続

## フォールバック B: Chrome 拡張 全面失敗
- Step 1: Web UI で手動サボり提案を取得してデモ
```

---

### LC-V305-05: CI Verification Gate（CI 検証ゲート）

**配置**: ランタイムコンポーネントではなく、既存 `pnpm` スクリプト + GitHub Actions ワークフロー設定として実装

**責務**:
- NFR-V305-R1（全パッケージテスト通過）を CI レベルで保証する
- NFR-V305-M2（シークレットスキャン）を `verify-secret-scan.sh` として PR チェックに組み込む

**実装方針**:
- 新規 `.github/workflows/` は作成しない（Code Generation の判断に委ねる）
- `pnpm run verify` として `package.json` の `scripts` に追加することを検討
- `verify-secret-scan.sh` は `pnpm --filter '*' build && pnpm --filter '*' test` の前に実行

---

## コンポーネント間の依存関係

```
Verification Script Suite (LC-V305-01)
    |
    +--[produces logs]--> Evidence Store (LC-V305-02)
    |
    +--[tests routes]--> (既存) MCP Transport Auth Adapter (U-V3-01)
    |
    +--[validates registry]--> (既存) MCP Tool Registry (U-V3-02)
    |
    +--[tests delegation]--> (既存) Slack Claude Delegation (U-V3-03)
    |
    +--[tests fallback]--> (既存) ElevenLabs Fallback (U-V3-04)

Troubleshooting Matrix (LC-V305-03)
    +--[references]--> Evidence Store (LC-V305-02)

Demo Runbook (LC-V305-04)
    +--[references]--> Troubleshooting Matrix (LC-V305-03)
    +--[executes]--> Verification Script Suite (LC-V305-01)

CI Verification Gate (LC-V305-05)
    +--[triggers]--> Verification Script Suite (LC-V305-01)
```

---

## NFR 要件 ↔ 論理コンポーネント マッピング

| NFR ID | 論理コンポーネント | 実現方法 |
|--------|----------------|---------|
| NFR-V305-R1 | LC-V305-01, LC-V305-05 | verify-build-test.sh + CI gate |
| NFR-V305-R2 | LC-V305-01 | verify-cdk-synth.sh |
| NFR-V305-R3 | LC-V305-01, LC-V305-02 | verify-agentcore.sh + R3 証拠 |
| NFR-V305-R4 | LC-V305-04 | Demo Runbook フォールバック A |
| NFR-V305-O1 | LC-V305-01, LC-V305-02 | verify-cloudwatch.sh + O1 証拠 |
| NFR-V305-O2 | LC-V305-01, LC-V305-02 | verify-cloudwatch.sh + O2 トークン漏洩スキャン |
| NFR-V305-O3 | LC-V305-02 | O3-elevenlabs-dashboard スクリーンショット |
| NFR-V305-E1 | LC-V305-04, LC-V305-02 | Demo Runbook Step 2 + E1 証拠 |
| NFR-V305-E2 | LC-V305-04, LC-V305-02 | Demo Runbook Step 3 + E2 証拠 |
| NFR-V305-E3 | LC-V305-04, LC-V305-02 | Demo Runbook Step 4 + E3 証拠 |
| NFR-V305-E4 | LC-V305-01, LC-V305-02 | verify-mcp-auth.sh + E4 証拠 |
| NFR-V305-A1 | LC-V305-01, LC-V305-02 | 簡易負荷テストスクリプト + A1 証拠 |
| NFR-V305-A2 | LC-V305-01, LC-V305-04 | demo-reset.sh + Demo Runbook 事前準備 Step 2 |
| NFR-V305-M1 | LC-V305-03 | TROUBLESHOOTING.md |
| NFR-V305-M2 | LC-V305-01, LC-V305-05 | verify-secret-scan.sh + CI gate |
