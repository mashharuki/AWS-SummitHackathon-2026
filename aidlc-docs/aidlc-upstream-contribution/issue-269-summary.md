# Issue #269 まとめ — サイクル固有ドキュメントのアーカイブ提案

> 作成日: 2026-06-07 / 対象リポジトリ: [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)

## 参照リンク

- **Issue 本体**: https://github.com/awslabs/aidlc-workflows/issues/269
- **私（Mameta29）のコメント**: https://github.com/awslabs/aidlc-workflows/issues/269#issuecomment-（2026-05-17T10:58:39Z 投稿）
- **クローズしたメンテナのコメント**: 同 Issue 内 `leandrodamascena`（2026-06-04T09:40:53Z）
- **関連**: Issue #275 / PR #276（マージ済み）、Issue #273 / PR #274（私の関連提案・OPEN）

## メタ情報

| 項目 | 内容 |
|---|---|
| Issue 番号 | #269 |
| タイトル | Suggestion: Archive cycle-specific docs after Build and Test approval to prevent stale context on new requirements |
| 起票者 | **@MMVesap**（他者。私ではない） |
| 起票日 | 2026-05-15 |
| クローズ日 | 2026-06-04 |
| 状態 | **CLOSED（NOT_PLANNED = 対応しない方針）** |
| クローズした人 | メンテナ `leandrodamascena` |
| 私の関与 | **コメント1件のみ**（賛同＋実体験＋実装意思の表明） |

---

## 1. 元々どのような Issue だったか

**問題提起**: AI-DLC で完成済みプロジェクトが次のセッションで新しい要件を受け取ると、AI が
`session-continuity.md` の指示により**過去サイクルの全成果物を無条件にロード**してしまう。
これらは「完了したサイクルの *intent*（意図）」であって現実（＝コード）ではないため、
新要件と衝突し、AI が過去の決定にアンカーしてオーバースコープしたり誤誘導される。

**具体的な汚染源**:
- 古い `requirements.md` が新要件と並んでロードされる → 混同リスク
- 古いユーザーストーリーが、もう当てはまらないペルソナ／フローを記述
- 古いワークフロー計画が、既に完了したスコープを記述
- per-unit の functional design が「元の設計意図」を記述（実装と乖離しうる）

**提案された解決策（cycle archive ステップ）**:
- Build and Test 承認時に、サイクル固有ドキュメントを `aidlc-docs/archive/cycle-N/` へ自動移動
  （requirements / user-stories / inception plans / construction plans / per-unit functional-design）
- **エバーグリーン文書は移動しない**: application-design（アーキ決定）、reverse-engineering、
  per-unit `code/` サマリ、build-and-test、aidlc-state.md、audit.md
- `session-continuity.md` に「**`archive/` 配下は絶対に読むな**」ルールを追加。
  ロードを「常時ロード（evergreen）」と「未アーカイブ時のみロード（cycle-specific）」に分割
- 新サイクルは「現コード + aidlc-state.md」をグラウンドトゥルースとし、デルタにスコープした
  クリーンスレートから Requirements Analysis を開始
- 影響ファイル: `build-and-test.md`（Step 9 追加）/ `session-continuity.md` / `core-workflow.md`

---

## 2. 私（Mameta29）はどのようなコメントをしていたか

2026-05-17 に**賛同コメント**を投稿。要旨は以下の4点:

1. **実体験での共鳴**: SABOROU の greenfield 実運用（6 units, Inception→Construction 全工程）で
   同じ問題に直面。`construction/` だけで unit ごとに5つの per-stage ディレクトリ + `plans/` を抱え、
   将来サイクルが無条件ロードする「intent 文書の山」になっていた。

2. **evergreen vs cycle-specific の切り分けが正しい**: 実運用では per-unit `code/` サマリと
   application-design は正確さを保ったが、per-unit functional-design と nfr-* はコード変更後に
   最もドリフトしやすかった。提案の振り分け表は実体験と一致する。

3. **#275 / PR #276 ときれいに合成できる**: #276 が per-unit 成果物を「*どこから* ロードするか」を
   修正したのに対し、本提案は新サイクルで「*そもそもロードするか否か*」をスコープする補完関係。
   両者とも同じ `session-continuity.md` のロードリストに触れる。

4. **スコープ質問の提起**: 本機能以前から存在するプロジェクトの初回サイクルで `cycle-N` を
   どう採番するか（既存成果物を初回アーカイブで `cycle-1` にするか、据え置いて次から採番するか）。
   私は前者推奨（archive-on-approval は常に `cycle-N` を生成、N は既存 `archive/` から推論）。

**末尾**: メンテナが approach に同意するなら、3ファイル変更を実装する PR を出す意思を表明
（採番ルールとトリガー文言を先に合意したい、と礼儀を保持）。

> ⚠️ 私は **PR は出していない**。あくまで「賛同＋実装意思の表明」コメントのみ。
> これは方針 [[feedback-issue-before-pr]]（Issue で合意 → PR の順序）に沿った動き。

---

## 3. なぜクローズに至ったか

メンテナ `leandrodamascena` が 2026-06-04 に **NOT_PLANNED（対応しない方針）でクローズ**。
ただし内容は**否定ではなく「解決済みクローズ」**。理由の要旨:

> 「指摘された問題は本物で、よく言語化されている。**朗報は、v2 がこれを構造的に設計で解決している**こと。」

具体的な v2 の解決メカニズム:

1. **Intent isolation（意図の分離）**: v2 では開発サイクルごとに番号付きディレクトリ
   （`intent-001-slug/`, `intent-002-slug/`）で完全分離。新サイクル開始時に orchestrator が
   独自の `state.json` / `audit.json` / `stages/` を持つ新ディレクトリを作る。
   **過去 intent の成果物を一切継承・ロードしない**。

2. **Stage execution is scoped（ステージ実行のスコープ化）**: stage-execution スキルは
   現ステージの定義と「同一 intent 内」の先行ステージ入力のみを読む。v1 の
   `session-continuity.md` のように**全成果物を無条件ロードする機構は存在しない**。

3. **No stale context bleeding（古い文脈の混入なし）**: ディレクトリ分離により、
   `intent-002` の作業中に `intent-001/stages/requirements.md` を誤って読むことがない。
   過去の決定と新要件を混同する問題が**アーキテクチャ上そもそも発生しない**。

**クローズの決め手となった方針表明**:

> 「**この時点で v1 に大きな変更を加えたくない**。なぜなら、まさにこの種のフィードバックから
> 学んで v2 で改善したから。解決済みとしてクローズする。」

参照先（v2 の進捗）:
- https://github.com/awslabs/aidlc-workflows/tree/v2
- https://github.com/awslabs/aidlc-workflows/tree/feature/real-world-simulation（近くv2へマージ予定）

---

## 4. 私への影響・教訓

- **#269 の「v1には大きな変更を入れない／v2で構造的に解決済み」という方針表明は、
  私のオープン中の貢献にも同じ判断が下る予兆**だった。
- 特に **#299 / PR #300**（build-time discovery の Unit 間伝播）は #269 と問題領域が隣接する
  **機構追加型**のため、同じ理由でクローズされるリスクが高い。
- 一方 **#273 / PR #274**（カバレッジ閾値の検証ゲート欠落）は v1 の**バグ修正**であり論点が直交。
  → v2 ブランチを clone して検証した結果、**この品質ゲートは v2 にも未実装**であることを確認し、
  それを事実提示して #273 に再ping コメント投稿（2026-06-04）。「v2で解決済み」返しを封じる動き。
  詳細は [[aidlc-upstream-contributions]] 参照。

**教訓**: 機構を「追加する」提案は v2 のアーキ刷新と競合してクローズされやすい。
「決めたことを守らせる」バグ修正・ガードレール型の提案のほうが、v2 方針下でも生き残りやすい。
