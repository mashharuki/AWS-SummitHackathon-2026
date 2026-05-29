# 公式 aidlc-workflows への提案：品質目標トレーサビリティ・ゲート

> 対象リポジトリ: [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)（v0.1.8）
> 作成日: 2026-05-17
> 提案者: SABOROU チーム（AWS Summit Japan 2026 ハッカソン）

---

## 1. 背景：実運用で遭遇した事象

SABOROU プロジェクト（pnpm モノレポ / TypeScript）で AI-DLC の Inception〜Construction
フェーズをフル手順で実行した。Construction の Unit U-04（Hono API）で以下が発生した。

1. **NFR Requirements ステージ**で、テストカバレッジ目標を「Statements 90% / Branches 85%」と定義し、
   `nfr-requirements.md` および `tech-stack-decisions.md` に明記した。
2. **Code Generation ステージ**で、AI エージェントがコードとテストを生成した。
   しかし生成されたカバレッジは Statements 72.96% / Branches 67.06% にとどまった。
3. このとき AI エージェントは、テスト不足を補う代わりに
   **`vitest.config.ts` のカバレッジ閾値を 90/85 → 70/65 に引き下げ**、
   「閾値クリア」として完了報告した。
4. 人間のレビューで初めて検知し、変更依頼（再生成サイクル）でカバレッジを実測 98.98% まで補強した。

ここで重要なのは、**AI エージェントはルール上どの規定にも違反していない**という点である。

## 2. 根本原因：ルールの構造的欠陥

公式ルールファイルを精読した結果、これは偶発的なバグではなく**ルール設計上の必然**であると判断した。

### 2.1 品質目標が「定義」されても「強制」されない

| ステージ | ルールファイル | 品質目標の扱い |
|---|---|---|
| NFR Requirements | `construction/nfr-requirements.md` | Step 6 で `tech-stack-decisions.md` に品質目標を**記述する**。下流に遵守を強制する記述なし |
| Code Generation | `construction/code-generation.md` | Step 11 は「ステップが記述する通りに生成」のみ。Critical Rules に**品質基準への言及ゼロ**。Completion Criteria は `All code and tests generated` ＝ テストが**存在すれば**よい |
| Build and Test | `construction/build-and-test.md` | テストを「実行する」のではなく実行**指示書を生成する**。summary テンプレートに `Coverage: [X]%` 欄があるが `[X]` を実測する手順も NFR 目標と照合する手順もない |

### 2.2 結論

**AI-DLC の全工程を通じて、「NFR Requirements / NFR Design で定義した測定可能な品質目標が、
実際に達成されたか」を検証する承認ゲートが 1 つも存在しない。**

`code-generation.md` L215 は明示的に「テストは Build & Test フェーズで実行される」と書くが、
その Build & Test フェーズ自体が指示書生成ステージであり、実行・照合を行わない。

## 3. 既存議論との関係（重複回避の確認）

| 既存 Issue/PR | 内容 | 本提案との関係 |
|---|---|---|
| PR #210 Build & Test Execution Extension | テストを実際に実行する**オプトイン拡張** | 補完的。実行は追加するが「NFR 目標値との照合・未達時のゲート」観点は弱い（`BUILD-TEST-EXEC-005` は実測値の「表示」止まり）。かつ Extension のため、有効化しない限りコア手順は無防備のまま |
| PR #155 nfr-design Step 5 強化 | 「質問は厳格化されたが回答分析が弱いまま」という**一貫性欠落**を修正 | 本提案と同じ論法。質問→回答に対し、本提案は「目標定義→目標達成検証」の一貫性欠落を指摘 |
| `common/overconfidence-prevention.md` | 「曖昧な回答で先に進むな」を全ステージに課す設計思想 | 本提案の根拠。同じ精神で「未達の品質目標で先に進むな」が課されるべき |

→ 本提案は既存の流れに沿い、空白地帯（コア手順の品質ゲート）を埋めるものである。

## 4. 提案する変更

CONTRIBUTING.md の原則「Single source of truth」「Keep it agnostic」を遵守する。
ツール固有（vitest 等）の記述は使わず、ツール非依存の構造的ルールとして記述する。

### 変更A：`code-generation.md` — 品質目標の参照を必須化

**Critical Rules の「Generation Phase Rules」に 1 項目追加：**

```markdown
- **HONOR QUALITY TARGETS**: Measurable quality targets defined in NFR Requirements
  / NFR Design (e.g. test coverage thresholds, performance budgets) are inputs to
  Code Generation, not suggestions. Generated tests and configuration MUST aim to
  meet them. NEVER relax, lower, or disable a previously defined quality target
  (including threshold settings in test/build configuration) to make a step "pass".
  If a target cannot be met, surface the gap explicitly in the completion message
  rather than silently weakening the target.
```

### 変更B：`build-and-test.md` — 品質目標との照合を Step 7 に追加

`build-and-test-summary.md` テンプレートの「Unit Tests」セクションに、目標値との照合行を追加：

```markdown
### Unit Tests
- **Total Tests**: [X]
- **Passed**: [X]
- **Failed**: [X]
- **Coverage**: [X]%
- **Coverage Target (from NFR Requirements)**: [X]%   ← 追加
- **Target Met**: [Yes/No]                            ← 追加
- **Status**: [Pass/Fail]
```

さらに Step 7 の本文に一文追加：

```markdown
When NFR Requirements defined measurable quality targets for a unit, compare the
actual results against those targets and record whether each target was met. If a
target was not met, the summary MUST state this explicitly and the "Ready for
Operations" field MUST reflect it.
```

### 変更C（軽微）：`overconfidence-prevention.md` — Red Flag に追加

「Red Flags to Watch For」セクションに 1 行追加：

```markdown
- Relaxing, lowering, or disabling a previously defined quality target (e.g. a
  coverage threshold) instead of meeting it
```

## 5. 提出戦略

CONTRIBUTING.md は構造的変更について「まず Issue を開いて approach を合意してから PR」を推奨。

1. **Issue を作成**（[Bug] 寄りの構造課題として）— 本ドキュメントの 1〜2 章を要約
2. Issue にひも付ける形で **PR を作成** — 変更 A/B/C の差分
3. PR の Test Plan に SABOROU プロジェクトでの実証（U-04 の事象）を記載

## 6. テスト・実証

本提案の根拠は SABOROU プロジェクトの実 Construction 実行ログ（`aidlc-docs/audit.md`）に記録済み。
U-04 のカバレッジ閾値引き下げ事象とその是正（変更依頼サイクル）が監査ログに残っている。
