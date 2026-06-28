# SABOROU v2 要件定義

**バージョン**: 1.0.0
**作成日**: 2026-06-14
**ステータス**: 確定（AI 全権委任モードで確定。人間レビュー前の一次版）
**対象フェーズ**: v2 スプリント（Chrome 拡張 + 音声対話エージェント + AgentCore Gateway MCP 化）

---

## 0. v2 コンテキスト

### v1 からの転換

| 観点 | v1 | v2 |
|------|----|----|
| 形態 | Web アプリ（SPA/PWA） | Chrome 拡張（Side Panel）+ 音声対話 |
| インタラクション | クリック操作 | 声で話しかける / 声で承認 |
| Slack 検知起点 | ユーザーが設定画面で連携設定 | content script が自動で DOM 検知 |
| 返信実行 | ユーザーがコピペ | 「いいよ」と発声 → 自動送信 |
| ゲーミフィケーション | 称号・実績・コンボ | MVP OUT（シンプルなチャット体験に集中） |

### v2 が深める「ダメになる能力」

| ダメになる能力 | v2 での実現 |
|-------------|-----------|
| タスク整理能力 | 拡張機能が自動検知 → 整理まで完結 |
| 優先順位判断 | 音声で即座に判定を聞ける |
| **返信・報告スキル（新）** | 返信文・断り文を AI が生成し声で承認するだけで送信 |
| **断る交渉力（新）** | 断り方・辞退理由を AI が生成。自力で断れなくなる |
| 締切感覚 | 進捗報告を自動送信することで締切感覚が完全に外部化 |

---

## 1. Extension 設定

| Extension | 設定 | 判断理由 |
|---------|------|---------|
| Security Baseline | **有効（v2 で変更）** | Chrome 拡張（DOM 操作・音声・Slack トークン）+ AgentCore Gateway（新 MCP エンドポイント）+ ElevenLabs SDK（フロント直結）という新規攻撃面が 3 つ増加する。v1 の PoC 扱いから脱し、決勝デモに向けた製品品質を担保するため有効化。審査員（塚田さん・福井さん）のセキュリティ評価軸に明示的に対応する。 |
| Property-Based Testing | 無効（継続） | Chrome 拡張の DOM 操作・音声 STT・ElevenLabs SDK はブラウザ環境依存のイベント駆動系で PBT が不適。E2E テストと手動検証で対応。 |

---

## 2. 機能要件

### v1 継承要件

| 要件 ID | 機能名 | v2 での扱い |
|--------|-------|-----------|
| FR-03 | サボり提案生成（SSE ストリーム） | 継承。返信文・断り文生成に拡張 |
| FR-04 | バックグラウンド再評価（EventBridge） | 継承。進捗報告スケジューリングに流用 |
| FR-05 | 本音データ収集 | 継承。音声承認ログが本音データになる |
| FR-07 | 認証・外部連携管理 | 継承。Cognito + Secrets Manager 流用。Chrome 拡張 PKCE フロー追加 |

### v2 新規機能要件

| 要件 ID | 機能名 | 優先度 | デモ対象 | 対応 UC |
|--------|-------|-------|---------|--------|
| FR-V2-01 | Chrome 拡張 Side Panel UI（チャット画面） | MUST | Yes | UC-01〜04 |
| FR-V2-02 | Slack DOM 検知（content script による自分宛てメッセージ検知） | MUST | Yes | UC-01/02 |
| FR-V2-03 | 音声入力（STT: Conversational AI SDK 内包 STT） | MUST | Yes | UC-01〜04 |
| FR-V2-04 | 音声出力（TTS: ElevenLabs Conversational AI SDK） | MUST | Yes | UC-01〜04 |
| FR-V2-05 | Human-in-the-loop 承認フロー（音声「いいよ」で送信） | MUST | Yes | UC-01/02 |
| FR-V2-06 | Slack 自動入力・送信（content script DOM 操作） | MUST | Yes | UC-01/02 |
| FR-V2-07 | 返信文・断り文生成（Bedrock Sonnet 4.6 + SaboriProposerAgent 拡張） | MUST | Yes | UC-01/02 |
| FR-V2-08 | 進捗報告の定期自動生成（EventBridge Scheduler + 音声通知） | SHOULD | Yes | UC-03 |
| FR-V2-09 | 朝の仕分けフロー（マルチメッセージ一括処理） | SHOULD | Optional | UC-04 |
| FR-V2-10 | ElevenLabs Conversational AI SDK フロントエンド組み込み（STT/TTS/会話フロー統合） | MUST | Yes | UC-01〜04 |
| FR-V2-11 | Amazon Bedrock AgentCore Gateway による SABOROU Hono API の MCP サーバー化 | MUST | Yes | UC-01〜04 |

### 機能詳細仕様

#### FR-V2-01: Chrome 拡張 Side Panel UI

- Manifest V3 準拠
- Side Panel API（`chrome.sidePanel`）使用
- 幅 400px 固定
- React 19 + Vite でビルド（`pkgs/extension` パッケージとして新設）
- チャット形式 UI（メッセージ履歴表示 + 音声入力ボタン + 承認ボタン）
- 常時表示の「いいよ」ボタン（音声認識失敗時のフォールバック）

#### FR-V2-02: Slack DOM 検知

- `MutationObserver` で Slack DOM 変化を監視
- 対象: `https://app.slack.com/*`（manifest.json で限定）
- 自分宛てメッセージの判定: `[data-qa="message_container"]` 等のアクセシビリティ属性を使用
- DM / チャンネルの判別: URL パターン（`/messages/UXXXXXXX` が DM）
- Slack Events API Webhook（v1 資産）を補助フローとして活用

#### FR-V2-05: Human-in-the-loop 承認フロー

```
生成 → 音声読み上げ → ユーザー「いいよ」発声 → STT 認識確認 → 送信実行
                              ↓ 3秒タイムアウト or 否定語
                              → 送信キャンセル
```

- 確認フレーズ: 「いいよ」「OK」「送って」「いけ」（類似語対応）
- キャンセルフレーズ: 「やっぱりいい」「やめて」「キャンセル」
- 沈黙 3 秒でキャンセル
- 送信後: 「送りました」と音声で確認

#### FR-V2-10: ElevenLabs Conversational AI SDK

- パッケージ: `@11labs/client`
- 配置: `pkgs/extension/src/panel/hooks/useConversationalAgent.ts`
- 機能: STT / TTS / 会話フロー管理 / MCP クライアント
- MCP 接続先: AgentCore Gateway エンドポイント
- 認証: Cognito JWT を `authToken` として渡す
- API キーは拡張機能内に保持しない（Lambda プロキシ / Secrets Manager 経由）

#### FR-V2-11: AgentCore Gateway MCP サーバー化

公開 MCP ツール：

| MCP ツール名 | 対応エンドポイント | 役割 |
|------------|----------------|------|
| `saborou_judge_sabori` | `POST /api/proposals/stream` | サボり判定・返信文生成 |
| `saborou_send_slack_reply` | `POST /api/slack/reply` | Slack 自動返信（承認後） |
| `saborou_get_tasks` | `GET /api/tasks` | タスク一覧取得（文脈収集） |
| `saborou_schedule_report` | `POST /api/tasks/{id}/report` | 進捗報告スケジューリング |

---

## 3. 非機能要件

### NFR-V2-P1: 音声対話レイテンシ

- **要件**: 音声入力から返答音声開始まで 3 秒以内（デモ体験の閾値）
- **測定方法**: ElevenLabs SDK のターンアラウンドタイム計測
- **対応**: AgentCore Gateway + Hono API のコールドスタート回避（Provisioned Concurrency 検討）

### NFR-V2-P2: content script パフォーマンス

- **要件**: Slack ページの描画を 100ms 以上遅延させない
- **対応**: `MutationObserver` のデバウンス処理（300ms）。DOM 操作は最小限

### NFR-V2-S1: Chrome 拡張セキュリティ

- **要件**: `manifest.json` に `content_security_policy` を明示。`unsafe-eval` 禁止
- **ストレージ**: `chrome.storage.local` に JWT・設定のみ保存。Slack トークンは保持しない
- **パーミッション最小化**: `activeTab` / `storage` / `sidePanel` のみ。`tabs` / `history` は要求しない

### NFR-V2-S2: API キー管理

- ElevenLabs API キー: `saborou/elevenlabs-api-key` に Secrets Manager 保管
- Chrome 拡張には一切の API キーを保持しない
- AgentCore Gateway の Credential Provider が内部的に Secrets Manager で管理

### NFR-V2-S3: DOM 操作権限最小化

- `content_scripts.matches` を `https://app.slack.com/*` のみに限定
- 書き込み（入力・送信）は Human-in-the-loop 承認後のみ実行
- メッセージ本文は Lambda ログに記録しない（CloudWatch PII ポリシー準拠）

### NFR-V2-S4: 音声プライバシー

- STT は Conversational AI SDK 経由（音声データの最終帰着は ElevenLabs のプライバシーポリシーに従う）
- 音声データは AWS に送らない
- TTS 生成テキストのみ Lambda ↔ 拡張間を通過

### NFR-V2-R1: デモ可用性

- **要件**: 決勝当日（2026-06-26）に 100% 動作を保証
- **対策**: 音声認識失敗時の「いいよ」ボタン（UI フォールバック）
- **対策**: Slack DOM 変更時の Webhook フォールバック
- **対策**: デモ 1 時間前の動作確認手順書作成

### NFR-V2-R2: AgentCore Gateway 可用性リスク

- **リスク**: `ap-northeast-1` での MCP エンドポイント GA 未確認（リスク TP-05）
- **対応**: 実装前に `aws bedrock-agentcore-control list-gateways --region ap-northeast-1` で確認
- **フォールバック**: `us-east-1` に Gateway を立て、Hono API は CORS 対応でリージョン越しに呼び出す

### NFR-V2-C1: コスト管理

| サービス | 月額上限 | 制御方法 |
|---------|---------|---------|
| ElevenLabs TTS | $20 | デモ用レート制限（1 分 10 回まで）をアプリ側で実装 |
| Bedrock（追加分） | +$10 | 既存 Throttle 設定継続 |
| 合計 v2 追加分 | ~$63/月 | Free Tier 活用で最小化 |

### NFR-V2-T1: テスト要件

- Chrome 拡張のビジネスロジック（STT フレーズ判定・承認ロジック）: ユニットテスト（Vitest）
- AgentCore Gateway MCP ツール呼び出し: 統合テスト（実環境接続）
- デモフロー（UC-01 全工程）: 手動テスト手順書 + スクリーンレコーディング
- content script DOM 操作: Playwright による E2E テスト（Slack 接続なしのモック環境）

---

## 4. スコープ定義（v2 MVP）

### MVP IN（確定）

- Chrome 拡張 Side Panel UI（チャット + 音声）
- Slack DOM 検知（content script）
- ElevenLabs Conversational AI SDK フロント直結
- AgentCore Gateway による MCP サーバー化
- Human-in-the-loop 音声承認フロー
- Slack 自動返信・断り文送信
- 進捗報告定期自動生成（EventBridge Scheduler）
- Cognito 認証継続（Google OAuth PKCE）

### MVP OUT（意図的除外）

- ゲーミフィケーション（称号・実績・コンボ）
- 3D キャラクター
- ガントスケジュール
- Gmail 検知（初期は Slack のみ）
- Notion 連携
- マルチペルソナ選択 UI
- Chrome Web Store 申請（デモは開発者インストール）

---

## 5. 技術的リスクと未確定論点

| リスク ID | 内容 | 深刻度 | 対応方針 |
|---------|------|-------|---------|
| TP-01 | Slack DOM 構造変更で content script が壊れる | 高 | `data-qa` 属性使用・Webhook フォールバック |
| TP-02 | Lambda cold start による TTS レイテンシ | 中 | Provisioned Concurrency 検討 |
| TP-03 | Web Speech API / STT の精度（デモ会場） | 高 | 「いいよ」ボタンのフォールバック必須 |
| TP-04 | Slack ContentEditable への自動入力 | 中 | `execCommand` + `InputEvent` の二段構え |
| TP-05 | AgentCore Gateway の `ap-northeast-1` GA 確認 | 中 | 事前確認 / `us-east-1` フォールバック |
| TP-06 | ElevenLabs SDK MCP クライアント設定（SDK バージョン依存） | 中 | 実装前に最新ドキュメント確認・バージョン固定 |

---

## 6. ユーザーストーリー参照

詳細は `aidlc-docs/inception/v2/user-stories/` を参照。

---

*要件深度: Comprehensive（v2 の技術的複雑度・新規攻撃面・ハッカソン決勝品質を踏まえた最高深度）*
