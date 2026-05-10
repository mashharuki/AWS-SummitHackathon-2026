# ドキュメント修正案

---

## Plan: AWS Summit Hackathon 2026 一次審査ドキュメント品質向上

**目的**: レビューで発見された重大な欠陥を修正し、競争力を**上位30%→上位10%**に引き上げる

**TL;DR**: 3つの重大な欠陥のうち2つ（AWS図・シーケンス図）は修正済み。残る**Critical Defect #1（Vercel Chat SDK未反映）**を4ファイルに反映し、README.md を作成することで一次審査突破確率が大幅に向上します。所要時間: 2.5〜3時間（最優先項目のみ）。

---

### **Steps**

#### **🔴 フェーズ1: Vercel Chat SDK整合性修正**（最優先・2〜3時間）

1. **requirements.md を更新**
   - FR-01テーブルに実装SDK行を追加: `| **実装SDK（Slack）** | Vercel Chat SDK (chat npm package) - マルチアダプター・型安全・Webhook/Event統合 |`
   - 場所: 「トリガー方式」と「処理内容」の間

2. **components.md を更新** (*depends on 1*)
   - BE-06 WebhookHandler の「依存サービス」に `Vercel Chat SDK (chat npm package) - Slack アダプター` を追加
   - 「技術実装詳細」サブセクションを新設し、Chat SDK の役割を詳述

3. **application-design.md を更新** (*parallel with 2*)
   - Section 4.1 コンポーネント一覧のBE-06行を更新: `Slack Webhook 受信（Vercel Chat SDK使用）`

4. **unit-of-work.md を更新** (*depends on 2, 3*)
   - U-04 api unit に新しい「#### 使用技術」セクションを追加（テーブル形式で5つの技術を列挙）
   - U-04 の「責務」パラグラフに「Vercel Chat SDK による Slack Webhook 処理」を追記
   - U-04 の「含まれるコンポーネント」テーブルのBE-06行に「Vercel Chat SDK による」を追記

5. **audit.md に変更履歴を記録** (*depends on 1-4完了*)
   - 4ファイルの修正内容と変更理由を記録

---

#### **🟡 フェーズ2: README.md 作成**（高優先度・30分）

6. **README.md を作成** (*parallel with フェーズ1*)
   - プロジェクト名・タグライン・ロゴ（🛏️ SABOROU）
   - コンセプト（表向き + 裏設定「人をダメにする」）
   - ドキュメントリンク（aidlc-docs/ 構成）
   - 技術スタック概要（React + Hono + Bedrock + DynamoDB + CDK + **Vercel Chat SDK**）
   - AI-DLCワークフロー実践の強調

---

#### **🟢 フェーズ3〜4: 追加改善項目**（中優先度・各30分・時間次第で実施）

7. **requirements.md に「ダメになる能力」具体例テーブルを追加** (*depends on フェーズ1完了*)
   - 4つの能力（タスク整理・優先順位判断・危機管理・締切感覚）の退化プロセスを表形式で可視化

8. **tech-stack-decisions.md に Bedrock AgentCore 選択理由を追加** (*parallel with 7*)
   - 3つの候補（AgentCore / Strands / 自前）の比較表を作成
   - 決定打を明記

---

#### **🔵 フェーズ5〜6: オプション項目**（低優先度・時間が許せば実施）

9. **unit-of-work.md の U-03 粒度を再評価**（1時間）
   - 選択肢A: U-03を2つに分割（task-extractor / sabori-proposer）
   - 選択肢B: 規模を「L」→「XL」に上方修正

10. **requirements.md にマネタイズ戦略を追加**（30分）
    - フェーズ別戦略（フリーミアム → チーム → エンタープライズ → API）

---

### **Relevant files**

- requirements.md - FR-01更新・能力退化テーブル追加
- components.md - BE-06詳細更新
- application-design.md - BE-06一覧更新
- unit-of-work.md - U-04使用技術セクション新設
- audit.md - 変更履歴記録
- README.md - 新規作成
- tech-stack-decisions.md - AgentCore選択理由追加

---

### **Verification**

#### フェーズ1完了時
1. `grep -r "Vercel Chat SDK" aidlc-docs/` で4ファイル全てにヒット
2. FR-01に「実装SDK（Slack）」行が存在
3. components.md BE-06に「依存サービス」と「技術実装詳細」でChat SDK記載
4. unit-of-work.md U-04に「使用技術」セクションが存在し、Chat SDK記載
5. audit.md に変更履歴エントリが追加

#### フェーズ2完了時
1. README.md がリポジトリルートに存在
2. aidlc-docs/ へのリンクが動作
3. 技術スタックにChat SDK記載

---

### **Decisions**

1. **Vercel Chat SDK は新しいFR（FR-09）として独立させない**
   - 理由: 実装手段であり機能要件ではない。FR-01の実装詳細として記載する方がクリーン

2. **unit-of-work.md に「使用技術」セクションを新設する**
   - 理由: 現在「使用 AWS サービス」しかなく、npm package等の記載場所がない

3. **README.md はフェーズ1と並行実施**
   - 理由: 独立しており時間短縮のため並行処理可能

4. **フェーズ5〜6はオプション**
   - 理由: 一次審査突破には必須ではない。残り時間次第で判断

---

### **Further Considerations**

#### 1. シーケンス図 7.1 に Chat SDK Adapter ノードを追加すべきか？

**推奨**: 不要（現状維持）
- 理由: Chat SDKはWebhookHandler内部実装なので、コンポーネント間相互作用を示すシーケンス図には登場しない

#### 2. user-stories.md にも反映すべきか？

**推奨**: 不要
- 理由: User Storiesは機能を記述するもので、実装技術は記載しない

#### 3. aidlc-state.md の「書類審査レビュー」セクションを更新すべきか？

**推奨**: フェーズ1完了後に更新
- 「最優先修正項目」1番目を ✅ に変更
- 「総合評価」を B+ → A- に更新

---

## 🎯 優先度に基づく推奨実施順序

### **必須（24時間以内）**:
- ✅ フェーズ1（Vercel Chat SDK整合性修正）
- ✅ フェーズ2（README.md作成）

### **推奨（時間が許せば）**:
- フェーズ3（「ダメになる能力」具体例）
- フェーズ4（AgentCore選択理由）

### **オプション（予選前でも可）**:
- フェーズ5（Unit分解粒度）
- フェーズ6（マネタイズ戦略）

---

## 📊 修正後の期待効果

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| **技術スタックの妥当性** | ⭐⭐☆☆☆ (2.0/5.0) | ⭐⭐⭐⭐☆ (4.0/5.0) |
| **ドキュメント品質** | ⭐⭐⭐☆☆ (3.5/5.0) | ⭐⭐⭐⭐☆ (4.5/5.0) |
| **総合スコア** | B+ (3.69/5.0) | **A- (4.2/5.0)** |
| **競争力** | 上位30%圏内 | **上位10%圏内** |

---