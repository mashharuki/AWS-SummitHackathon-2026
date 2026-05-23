SABOROU ブラッシュアップ計画 — 「先延ばし許可エンジン」軸での尖鋭化

競合調査により、SABOROUの独自ポジションが「業務文脈 × サボらせる × 学術根拠付き延期エ
ンジン」という構造的空白地帯にあることが確認された。しかし現実装では：

1. nextCheckOffsetMinutes がバックエンドに存在するがフロントで不可視 —
競合（PrioritAI等）との決定的差別化要素が埋もれている
2. 心理学引用が「シグナル名」止まり — 「Karau &
Williamsによると...」という論文ベースの説得体験がない
3. 既知バグ（Slack/Cognito IDミスマッチ・設定ページ） — デモE2E フローが通らない
4. AI依存スコアの演出が弱い — 「人をダメにする」テーマとの一致が5分以内に体感できない

M2 MVP デモ期限:
2026-05-30（残7日）。競合に対して際立つ体験を届けるため、以下3層の優先度で実装する。

---
推奨アプローチ

「既存実装の尖鋭化」＋「差別化UIの追加」の組み合わせ

完全新機能の開発ではなく、すでに存在するバックエンドの判定ロジック（nextCheckOffsetMin
utes、psychSignals、reasoning）をフロントエンドで最大限可視化することで、デモインパク
トを最大化する。

---
Tier 1 — デモ必須（Day 1-3）

1. Slack/Cognito ユーザーIDミスマッチ修正

問題: audit.md で特定済み。Slack User ID と Cognito sub
が紐づかずE2Eフローが通らない。

変更箇所:
- pkgs/api/src/routes/auth.ts — Slack ID → Cognito sub
マッピングテーブル参照ロジック追加
- pkgs/infra/lib/tables/ — users テーブルの GSI 確認（slackUserId
インデックス追加が必要か確認）
- pkgs/shared/src/types/user.ts — slackUserId フィールドの型定義確認

検証: Slack Webhook → TaskExtractor → SaboriProposer → フロントエンド表示
のE2Eフロー確認

---
2. 設定ページのユーザー情報表示

問題: SettingsPage.tsx でプロフィール欄にユーザー名・メールアドレスが未表示。

変更箇所:
- pkgs/frontend/src/pages/SettingsPage.tsx — useAuth() から user.email, user.name
を取得して表示
- pkgs/frontend/src/hooks/useAuth.ts — Cognito ユーザー属性（given_name,
email）のマッピング確認

---
3. nextCheckOffsetMinutes 可視化UI（新機能・最大差別化要素）

Why: 全競合が「やる/消す」の2値判定。SABOROUだけが「90分後に再判定」という時間軸付き延
期を持つ。これを可視化することでPrioritAI/Saner.aiとの決定的差別化になる。

新規コンポーネント: pkgs/frontend/src/components/verdict/DeferralCountdown.tsx
表示仕様:
- サボれ判定 → 判定カードの下に「⏰ 90分後に再判定」バッジ表示
- カウントダウン（HH:MM:SS）または「X分後」表示
- 時間が来たら「再判定しますか？」ボタンに変化
- 再判定ボタン → TaskDetailPage の再判定フロー起動

変更箇所:
- pkgs/frontend/src/components/verdict/DeferralCountdown.tsx — 新規作成
- pkgs/frontend/src/pages/TaskDetailPage.tsx — nextCheckOffsetMinutes を受け取り
DeferralCountdown へ渡す（L280付近のverdictセクション）
- pkgs/frontend/src/hooks/useProposalStream.ts — nextCheckOffsetMinutes
をストリーミングレスポンスから受け取る（型追加）
- pkgs/shared/src/types/proposal.ts — nextCheckOffsetMinutes
フィールド確認（バックエンドに存在することを確認済み）

---
4. AI依存スコアの演出強化

Why: 現状の -3%/-2% の減少はデモ中5分で体験するには変化が小さい。「人をダメにする」テ
ーマの即時体験が不可欠。

変更箇所:
- pkgs/frontend/src/pages/TaskDetailPage.tsx L131-136 — agree_with_ai の減少量を -3% →
-8% に増加（デモ用設定として環境変数で制御可能にする）
- pkgs/frontend/src/components/ui/DependencyScoreDisplay.tsx —
スコア減少時のアニメーション強化
  - 現状: shake 0.5秒
  - 改善: shake + pulse + 赤フラッシュ + 「判断を手放しました」テキスト表示（1.5秒）
- 新規カウンター追加: 「今日の判断委譲回数: X回」（ローカルストレージで当日カウント）

表示仕様追加:
スコア 80%以上: 🧠 "自己判断力: 残りXX%" (緑)
スコア 60-79%: 😅 "自己判断力: 残りXX%" (黄) + 軽い揺れ
スコア 40-59%: 😰 "自己判断力: 残りXX%... AIへの依存が進行中" (オレンジ)
スコア 39%以下: 🫠  "自己判断力: 残りXX% AIに支配されています" (赤) + 常時パルス

---
Tier 2 — 差別化強化（Day 4-5）

5. 学術引用の可視化強化

Why: 「Karau-Williams
によるとあなたのケースは...」という体験が競合との決定的差。現在はシグナル名だけ。

変更箇所:
- pkgs/frontend/src/components/verdict/PsychSignalsCard.tsx —
各シグナルの引用文を自然言語で表示

表示変更仕様:
Before: 「Sucker Effect — ピア努力知覚」
After:  「Sucker Effect (Kerr, 1983)
        「周囲のメンバーも動いていません。あなたが今動く必要はありません。」
        → low」

- pkgs/frontend/src/lib/verdictMeta.ts — 各心理学理論に citation と
naturalLanguageExplanation フィールド追加
  - Identifiability → "Williams et al. (1981): あなたの貢献は依頼者から見えていません"
  - Expectancy → "Vroom (1964): この努力が報酬につながる期待値が低い状態です"
  - Sucker Effect → "Kerr (1983): 周囲も動いていません"
  - SDT → "Ryan & Deci (2000): 外発的プレッシャーが弱い"

---
6. 判定監査証跡UI（Verdict History）

Why: AWSジャッジへの「説明可能AI」アピール。verdict/reasoning/summaryText
の構造化出力可視化。Bedrock AgentCore の監査証跡としても機能。

新規コンポーネント: pkgs/frontend/src/components/verdict/VerdictHistory.tsx
- タスクリストページの下部に「最近の判定履歴」セクション追加
- 最新5件: タスク名 + verdict + reasoning の要約 + 判定時刻
- 「あなたは今日X回サボりの許可を得ました」サマリ

変更箇所:
- pkgs/frontend/src/components/verdict/VerdictHistory.tsx — 新規作成
- pkgs/frontend/src/pages/TaskListPage.tsx — 下部にVerdictHistory追加
- pkgs/frontend/src/hooks/useTasks.ts — 判定済みタスクの履歴取得

---
7. ManualPage — 実データへの移行とプログレス表示

問題:
モックデータが残っている可能性。本番データが少ない場合に「データ蓄積中」表示がない。

変更箇所:
- pkgs/frontend/src/pages/ManualPage.tsx — データ件数に応じた段階的表示
  - 0-9件: 「まだデータが少なすぎます。SABOROUと対話を重ねてください」
  - 10-49件: 「傾向が見えてきました（X/100件）」+ 部分表示
  - 50-99件: 「かなりあなたの癖が見えてきました」
  - 100件以上: 「完全版取扱説明書」

---
Tier 3 — ポジショニング強化（Day 6-7）

8. 競合対比ポジショニングUI

変更箇所:
- pkgs/frontend/src/pages/TaskListPage.tsx — ヘッダー直下にサブタイトル追加
  - "AIに、サボっていいと言わせよう。" (subtle, small text)
- 初回ログイン時のみ表示するオンボーディングモーダル（OnboardingModal.tsx 新規）
  - スライド1: "あなたのタスクをAIが判定します"
  - スライド2: "サボっていい根拠を、5つの心理学理論で説明します"
  - スライド3: "使うほど、あなたはAIに依存していきます..."（裏設定の示唆）

---
9. 30秒デモフロー最適化

目標: "Slackを見てサボれるかをAIが教えてくれる" を30秒で体験できるデモ動線。

変更箇所:
- pkgs/frontend/src/pages/TaskListPage.tsx — デモ用FABボタンのラベルを
"Slackのタスクを解析" に変更
- pkgs/frontend/src/components/task/TaskAddModal.tsx —
Slackメッセージのサンプルプリセット追加（デモ実行の高速化）
- デモ用サンプルデータ整備: 判定が can_saboru になるリアルなSlackメッセージセット

---
重要ファイル一覧

┌──────────────────────────────────────────────────────────┬───────────────┬─────┐
│                         ファイル                         │  変更タイプ   │ Tie │
│                                                          │               │  r  │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/api/src/routes/auth.ts                              │ バグ修正      │ 1   │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/frontend/src/pages/SettingsPage.tsx                 │ バグ修正      │ 1   │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/frontend/src/pages/TaskDetailPage.tsx               │ 機能追加・修  │ 1,2 │
│                                                          │ 正            │     │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/frontend/src/hooks/useProposalStream.ts             │ 型追加        │ 1   │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/frontend/src/components/verdict/DeferralCountdown.t │ 新規作成      │ 1   │
│ sx                                                       │               │     │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/frontend/src/components/ui/DependencyScoreDisplay.t │ 演出強化      │ 1   │
│ sx                                                       │               │     │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/frontend/src/lib/verdictMeta.ts                     │ データ拡充    │ 2   │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/frontend/src/components/verdict/PsychSignalsCard.ts │ 表示改善      │ 2   │
│ x                                                        │               │     │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/frontend/src/components/verdict/VerdictHistory.tsx  │ 新規作成      │ 2   │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/frontend/src/pages/TaskListPage.tsx                 │ 追加          │ 2,3 │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/frontend/src/pages/ManualPage.tsx                   │ 実データ対応  │ 2   │
├──────────────────────────────────────────────────────────┼───────────────┼─────┤
│ pkgs/frontend/src/components/OnboardingModal.tsx         │ 新規作成      │ 3   │
└──────────────────────────────────────────────────────────┴───────────────┴─────┘