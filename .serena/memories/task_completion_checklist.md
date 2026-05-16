# タスク完了時のチェックリスト（2026-05-16 更新）

## 毎回のタスク完了時
1. [ ] audit.md に作業ログを追記（タイムスタンプ付き、完全な入力を記録、APPEND ONLY）
2. [ ] aidlc-state.md を更新（完了済みステージを反映）
3. [ ] 該当フェーズのチェックボックスを更新
4. [ ] ユーザーへ完了報告と次ステップの提示

## Construction フェーズ各 Unit 完了時
1. [ ] コード生成の完了（pkgs/ 配下に実装）
2. [ ] テスト実装の確認（vitest / jest）
3. [ ] Biome フォーマット確認（pnpm biome:check）
4. [ ] ユーザー承認
5. [ ] aidlc-docs/construction/{unit-name}/code/ に Markdown サマリー作成

## Unit 実装順序（推奨）
```
U-01 shared → U-02 infra → U-03a task-extractor → U-03b sabori-proposer → U-04 api → U-05 web
（U-03c task-organizer は v1.1.0 スコープ・低優先度）
```

## 現在の実装状態（2026-05-16 時点）
- **pkgs/backend**: スケルトン（/health エンドポイント + /doc + /ui のみ）
- **pkgs/cdk**: 空のスタック（CdkStack に何も実装されていない）
- **pkgs/frontend**: デフォルトスキャフォールド（カウンターボタンのみ）
- **pkgs/backend/tests/**: 空（テスト未作成）

## マイルストーン
- M1: 書類審査（2026-05-10）— **完了・通過済み**
- M2: MVP デモ（2026-05-30）— **次の目標**
- M3: 決勝（2026-06-26）— 最終目標

## コードレビュー
- CodeRabbit が PR を自動レビュー（日本語）

## 注意
- audit.md は APPEND ONLY で更新（完全上書き禁止）
- ユーザー入力は要約せずそのまま記録
- アプリコードは pkgs/ 配下（aidlc-docs/ に置かない）
- pnpm を使う（npm/yarn 禁止）
