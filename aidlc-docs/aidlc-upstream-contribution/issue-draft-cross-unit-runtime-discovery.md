# Issue ドラフト（公式リポジトリへ投稿する英語本文）

> **【投稿済み 2026-05-23】**
> - Issue **#299**: https://github.com/awslabs/aidlc-workflows/issues/299
>   （タイトルは `[Feature]:` プレフィックスでテンプレ慣習に統一。`@mayakost` を co-reporter 明記、
>   example 原文引用、#117/#269/#72 との関係を本文に記載。ラベルは外部コントリビューター権限不足で
>   付与不可＝メンテナのトリアージ待ち）
> - PR **#300**: https://github.com/awslabs/aidlc-workflows/pull/300
>   （`feat/cross-unit-discovery-log`、最終 +37/-1、head `b0034f6`。`construction/code-generation.md`
>   Step1=参照リユース（Affected Resource で照合）／Step11=記録／Critical Rules にスキーマ・ライフサイクル・
>   初期ヘッダーを単一定義。`common/session-continuity.md` は再開時の独立チェックリスト項目として参照のみ。
>   **Ready for review**。本文で「approach は #299 で合意してから／注文あれば revise・最悪 close→RFC」を明示）
> - **品質検証 2 回（source-code-reviewer 委譲）→ 反映済み**: 1回目で C-1配置/W-1スキーマ/W-4コミットスコープを是正、
>   2回目で W-2（"own" 曖昧→shared-resource 列挙判定）/W-3（session-continuity 視認性リグレッション）/Step1長文を是正。
>   Critical 0・markdownlint 0err。残 Info（terminology.md 登録）はスコープ最小化のため見送り。各改訂は PR にコメントで明示。
> - PR #276 スレッドに「私が起票する」確認コメント→起票→#299/#300 リンクコメントを投稿済み。
> - **次アクション**: #299 でメンテナ／`@mayakost` の approach 合意を待つ。
>   方向性に注文が付いたら #300 を revise（最悪 close して RFC テンプレに移行）。

**Title**: `[Enhancement]: Construction should propagate runtime discoveries (rate limits, API quirks, pivots) across units, independent of declared dependencies`

**Labels (suggest)**: enhancement, construction

**起票方針**: PR #276 の `@mayakost` レビューが発端。Issue先行方針（[[feedback-issue-before-pr]]）に従い、
PR #276 の返信コメントに本ドラフトを同梱して提示済み。`@mayakost` の合意（および誰が起票するか）を
確認してから投稿する。投稿時は `@mayakost` を co-author / co-reporter として明記する。

---

## Which rule or stage is affected

- `construction/code-generation.md`
- `common/session-continuity.md`
- `inception/units-generation.md` (`unit-of-work-dependency.md` の生成元)

## Summary

Construction phase は per-unit ループで進む。Unit 間のコンテキスト共有は、Units Generation で
**静的に宣言された** 依存マトリクス (`unit-of-work-dependency.md`) を辿る形でのみ行われる。

しかし、ある Unit の構築中に発生する **実行時の発見 (runtime discovery)** — 未文書化のレート制限、
API の癖、設計時には想定できなかったピボット判断 — は、依存マトリクスに表れない。依存関係を
宣言していない別の Unit が同じ外部リソースに触れる場合、その Unit のエージェントは先行 Unit の
知見を一切ロードせず、**同じ調査と同じピボットを独立に繰り返す**。

PR #276 はあくまで「session resume 時に per-unit 成果物を正しいパスでロードする」修正であり、
静的依存グラフの射程内の話。本 Issue が扱うのは、その射程の **外** にある runtime cross-cutting
discovery の共有という別レイヤーの課題。

## Concrete example (raised by @mayakost on PR #276)

> Unit 1 is a Notification module. While building it, the agent tries to use the platform's
> email API v2, discovers it's rate-limited to 10 req/s (undocumented), and pivots to batching
> with API v1. Unit 2 is a User Onboarding module that also sends emails. Since it has no
> declared connection to Unit 1, that context is never loaded — the agent independently tries
> API v2, hits the same wall, and has to repeat the same discovery and pivot.

## Expected vs actual behavior

- **Actual**: 各 Unit は自分の成果物 + 宣言された依存 Unit の成果物のみをロードする。実行時に
  得られた横断的知見は次の Unit に伝播しない。
- **Expected**: ある Unit の構築中に得られた、Unit 境界を越えて影響する発見（外部 API の制約、
  レート制限、採用/不採用の判断とその理由）が記録され、後続の Unit の構築時に参照される。

## Proposed direction (議論のたたき台)

1. **横断的発見ログの導入**: Construction 中に発生した runtime discovery を
   `aidlc-docs/construction/cross-unit-discoveries.md`（仮）に追記する。
   1 エントリ = 発見・影響範囲・採った対応・理由。
2. **全 Unit 起動時にロード**: per-unit ループの各 Unit 開始時に、自 Unit 成果物・依存 Unit 成果物に
   加えて、この横断ログを必ずロードする（`session-continuity.md` の Smart Context Loading に追記）。
3. **記録の責務**: `code-generation.md` に「外部リソースの制約・想定外のピボットに遭遇したら
   横断ログへ追記する」ステップを追加する。
4. 依存マトリクスは設計時依存のまま据え置き。本仕組みはそれと **直交する別レイヤー** として足す。

## Notes

- `@mayakost` がレビューで提起した課題。example は本人の文面をそのまま引用。
- スコープが `common/` への新仕組み追加に及ぶため、CONTRIBUTING の "Single source of truth" /
  "Be reproducible" に沿って、approach をこの Issue で合意してから PR を作成する。
