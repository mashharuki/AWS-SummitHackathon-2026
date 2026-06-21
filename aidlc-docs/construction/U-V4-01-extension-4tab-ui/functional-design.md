# U-V4-01: Chrome 拡張 4タブ UI 再設計（機能設計）

- **Unit ID**: U-V4-01
- **作成日**: 2026-06-20 JST
- **ブランチ**: feature/extension-4tab-ui（base: docs/saborou-v2-brief）
- **対象パッケージ**: pkgs/extension
- **入力**: ユーザー提供モック 8 枚（6 メイン画面 + 承認/断りポップアップ 2 枚）

## 1. 目的

拡張機能の Side Panel UI を、6 ステップのプロダクトストーリー
（①現状把握 ②受け機嫌 ③タスク代行 ④サボれる理由生成 ⑤動いてるフリ ⑥使い道提案）を
体現する **4 タブ構成**に再設計する。バックエンドで既に稼働中のデータ
（Calendar / Tasks / Proposal / ContextSignals / Report）を UI として可視化する。

## 2. タブ ↔ ステップ対応

| タブ | ステップ | データ源 |
|---|---|---|
| ホーム | ①現状把握 | Calendar status(busyScore) + Proposal/ContextSignals + 拡張側算出 |
| 依頼整理 | ②受け機嫌 | GET /tasks/candidates + content 検知マージ、approve/reject、judge |
| 作業中 | ③タスク代行 | GET /tasks/:id/schedule（8-17時/昼休み12-13固定）+ スクレイピング演出モック |
| 余白 | ④⑤⑥ | Proposal(reasoning) チャット + POST /tasks/:id/report + 使い道提案(モック) |

## 3. 確定した設計判断

1. **Slack 送信 = DOM スクレイピング送信を正**。content script が隣の Slack ブラウザタブに
   自分のアカウントとして自動入力・送信する。Bot Token 経路（POST /api/slack/reply）は
   フォールバックに降格。
2. **ホーム数値 = 既存 API + 拡張側算出**。集約専用 API は新設せず、拡張フロントで
   Calendar status と Proposal/ContextSignals を合成し、認知負荷スコア等を算出。
3. **稼働時間固定**: 8:00〜17:00、昼休み 12:00〜13:00。カレンダー密度・余白算出の基準。
4. **1 タスクずつ順次進行**。タスクの合間に別タスクを挟む cross-task decision slot は廃止。
   1 タスクの中に別タスクが入り込まない。
5. **既存「いいよ」音声承認フローは依頼整理タブに統合**。
6. 候補データは candidates API（履歴遡及済み）と content 検知（リアルタイム新着）を
   dedupe してマージ。
7. 進捗報告(フリ) = 実 API(report) 接続 + DOM 送信。使い道提案(Netflix/散歩) = モック。

## 4. コンポーネント構成（新規）

```
src/panel/
  App.tsx                      … タブ shell（認証 + アクティブタブ state）
  tabs/
    HomeTab.tsx                … 現状把握
    InboxTab.tsx               … 依頼整理（候補一覧 + 承認/断りフロー）
    WorkingTab.tsx             … 作業中（ガント風 + 代行演出）
    SlackTab.tsx (余白)        … 余白（チャット + フリ + 使い道）
  components/
    TabBar.tsx                 … 4タブナビ
    Card.tsx / Badge.tsx / Button.tsx / Modal.tsx / Sheet.tsx
    ApprovalModal.tsx          … Bias for Action 承認 + 返信文案
    DeclineSheet.tsx           … 断り文面ポップアップ
    MiniGantt.tsx              … 400px 幅向け簡易ガント
  lib/
    agentClient.ts             … API クライアント（拡充）
    homeMetrics.ts             … ContextSignals 集約 + スコア算出
    workHours.ts               … 8-17時/昼休み固定ロジック
```

## 5. 受入基準

- 4 タブを切り替えでき、各タブがモックのレイアウトに準拠する。
- 認証必須。未ログイン時は従来どおりログイン誘導。
- 依頼整理: 候補カードの承認 → モーダル → 返信文案 → DOM 送信、断り → シート → DOM 送信が動く。
- ホーム: Calendar/Proposal から取得した実データを表示（取得失敗時はフォールバック表示）。
- 余白: 進捗報告が report API から生成され DOM 送信できる。使い道はモック表示。
- 既存ユニットテストを壊さず、新規コンポーネントにテストを追加。
- `npx tsc --noEmit` / `pnpm test` / `pnpm build` が通る。

## 6. 実装結果（2026-06-20 完了）

- ステータス: **Code Generation 完了**。
- 検証: `tsc --noEmit` OK / Vitest **199 tests pass**（新規: workHours 12 / homeMetrics 6 /
  mergeCandidates 3 / App 4タブ 15）/ Biome lint クリーン / `vite build` 成功。
- 新規ファイル:
  - lib: `types.ts` / `workHours.ts` / `homeMetrics.ts`（+ test 2）
  - `SaborouContext.tsx`（共有状態・DOM 送信・候補マージ。mergeCandidates は純粋関数で test 済み）
  - components: `ui.tsx` / `TabBar.tsx` / `ApprovalModal.tsx` / `DeclineModal.tsx` /
    `MiniGantt.tsx` / `ProgressReportSheet.tsx`
  - tabs: `HomeTab.tsx` / `InboxTab.tsx` / `WorkingTab.tsx` / `SlackTab.tsx`
- 変更: `App.tsx`（4タブ shell 化 + 音声トグル保持）/ `agentClient.ts`（API 拡充）/
  `messages.ts`（SEND_SLACK_REPLY に channelId/threadTs 追加）/ `index.css`（slideUp/scanLine）。
- 音声（ElevenLabs）: `@11labs/client` をバンドルに残すためマイクトグルを App ヘッダーに保持。
  ビルドプラグイン `elevenlabs-extension-worklets` は同 SDK のバンドル存在を前提とするため必須。
- 既知の TODO（本ユニット範囲外・将来）:
  - 音声「いいよ」承認をモーダル送信に再配線（現状はマイク接続のみ保持）。
  - 作業中タブの「代行実行」は演出モック（実代行は未実装）。使い道提案もモック。
