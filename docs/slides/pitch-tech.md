---
marp: true
theme: excel
paginate: true
size: 16:9
html: true
style: |
  /* AWS Summit Edition — SABOROU v2 */
  section {
    --accent:      #FF9900;
    --accent-warm: #0073BB;
    --dark:        #0a1628;
    --dark-2:      #1a2a45;
    --muted:       #64748b;
    --border:      #e2e8f0;
    --bg-subtle:   #f8fafc;
    width: 1280px; height: 720px;
    box-sizing: border-box;
    font-family: 'Hiragino Sans', 'BIZ UDGothic', 'Yu Gothic Medium',
                 'Noto Sans JP', 'Segoe UI', -apple-system, sans-serif;
    background: #ffffff; color: #1e293b;
    padding: 48px 72px 58px;
    font-size: 24px; line-height: 1.65;
    display: flex; flex-direction: column; position: relative;
  }
  section::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0;
    height: 5px; background: linear-gradient(90deg, #FF9900, #0073BB);
  }
  section::after { font-size: 0.5em; color: var(--muted); bottom: 20px; right: 40px; letter-spacing: 0.04em; }
  h1 { font-size: 2.0em; font-weight: 800; color: #0a1628; margin: 0 0 14px; line-height: 1.2; letter-spacing: -0.02em; }
  h2 { font-size: 1.4em; font-weight: 700; color: #0a1628; margin: 0 0 16px; padding-bottom: 10px; border-bottom: 3px solid var(--accent); line-height: 1.3; }
  h3 { font-size: 1.0em; font-weight: 600; color: var(--accent); margin: 12px 0 6px; }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0; padding-left: 1.4em; }
  li { margin: 4px 0; }
  ul > li::marker { color: var(--accent); font-size: 1.1em; }
  strong { color: var(--accent); font-weight: 700; }
  em     { color: var(--accent-warm); font-style: normal; font-weight: 600; }
  code { font-family: 'JetBrains Mono', 'Fira Code', monospace; background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; font-size: 0.82em; color: #be123c; }
  pre { background: #0a1628; border-radius: 10px; padding: 16px 20px; margin: 8px 0; flex-shrink: 0; }
  pre code { background: none; border: none; color: #e2e8f0; padding: 0; font-size: 0.72em; line-height: 1.6; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 0.82em; }
  th { background: var(--accent); color: white; padding: 7px 12px; text-align: left; font-weight: 600; }
  td { padding: 6px 12px; border-bottom: 1px solid var(--border); }
  tr:nth-child(even) td { background: var(--bg-subtle); }
  blockquote { border-left: 4px solid var(--accent); background: var(--bg-subtle); margin: 8px 0; padding: 8px 16px; border-radius: 0 6px 6px 0; color: var(--muted); font-size: 0.92em; }
  hr { border: none; border-top: 2px solid var(--border); margin: 14px 0; }

  /* === Slide class variants === */
  section.title { background: linear-gradient(145deg, #1c0a00 0%, #3d1f00 55%, #150800 100%); color: white; justify-content: flex-end; padding-bottom: 64px; }
  section.title::before { height: 6px; }
  section.title h1 { color: white; font-size: 2.4em; letter-spacing: -0.03em; max-width: 86%; border-bottom: none; margin-bottom: 0; }
  section.title h2 { color: rgba(255,255,255,0.65); font-size: 1.0em; font-weight: 400; border-bottom: none; margin-top: 12px; }
  section.title p { color: rgba(255,255,255,0.5); font-size: 0.8em; margin-top: 28px; }

  section.section { background: linear-gradient(135deg, #FF9900 0%, #e67e00 100%); color: white; justify-content: center; }
  section.section::before { background: rgba(255,255,255,0.25); }
  section.section h2 { color: white; font-size: 2.0em; border-bottom: 2px solid rgba(255,255,255,0.4); padding-bottom: 12px; }
  section.section p { color: rgba(255,255,255,0.85); font-size: 0.9em; }

  section.dark { background: #0a1628; color: #e2e8f0; }
  section.dark h1 { color: white; }
  section.dark h2 { color: #FF9900; border-color: #FF9900; }
  section.dark h3 { color: #FF9900; }
  section.dark strong { color: #FF9900; }
  section.dark em { color: #60a5fa; }
  section.dark code { background: #1a2a45; border-color: #2a3a55; color: #94a3b8; }
  section.dark td { border-color: #2a3a55; }
  section.dark tr:nth-child(even) td { background: #1a2a45; }
  section.dark blockquote { background: #1a2a45; border-color: #FF9900; color: #94a3b8; }
  section.dark th { background: #FF9900; }

  section.ending { background: linear-gradient(145deg, #0a1628 0%, #1a3a6a 100%); color: white; justify-content: center; align-items: center; text-align: center; }
  section.ending::before { height: 6px; }
  section.ending h1 { color: white; font-size: 2.4em; border-bottom: none; margin-bottom: 16px; }
  section.ending h2 { color: rgba(255,255,255,0.65); border-bottom: none; font-weight: 400; font-size: 1.0em; }
  section.ending p { color: rgba(255,255,255,0.5); font-size: 0.82em; margin-top: 20px; }

  /* === Layout Components === */
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; }
  .columns.col-3    { grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
  .columns.col-6-4  { grid-template-columns: 3fr 2fr; }
  .columns.col-4-6  { grid-template-columns: 2fr 3fr; }
  .columns.middle   { align-items: center; }
  .card { background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; margin: 5px 0; }
  .card.accent  { border-left: 4px solid var(--accent);      background: rgba(255,153,0,0.05); }
  .card.warn    { border-left: 4px solid var(--accent-warm); background: rgba(0,115,187,0.05); }
  .card.success { border-left: 4px solid #22c55e;            background: rgba(34,197,94,0.05); }
  .card.purple  { border-left: 4px solid #8b5cf6;            background: rgba(139,92,246,0.05); }
  .highlight { background: linear-gradient(135deg, rgba(255,153,0,0.10), rgba(0,115,187,0.10)); border: 1px solid rgba(255,153,0,0.3); border-radius: 10px; padding: 12px 20px; font-size: 1.0em; font-weight: 600; text-align: center; margin: 8px 0; }
  .number { font-size: 2.8em; font-weight: 800; color: var(--accent); line-height: 1.0; display: block; letter-spacing: -0.03em; }
  .number.blue { color: var(--accent-warm); }
  .number.green { color: #22c55e; }
  .tag { display: inline-block; background: var(--accent); color: white; font-size: 0.6em; font-weight: 600; padding: 3px 10px; border-radius: 999px; vertical-align: middle; letter-spacing: 0.03em; margin: 0 3px; }
  .tag.blue    { background: var(--accent-warm); }
  .tag.success { background: #22c55e; }
  .tag.purple  { background: #8b5cf6; }
  .tag.outline { background: none; border: 1.5px solid var(--accent); color: var(--accent); }
  .steps { counter-reset: step; }
  .step { display: flex; align-items: flex-start; gap: 14px; margin: 10px 0; }
  .step::before { counter-increment: step; content: counter(step); background: var(--accent); color: white; font-weight: 700; font-size: 0.85em; width: 28px; height: 28px; min-width: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .aws-badge { display: inline-flex; align-items: center; background: #0a1628; color: #FF9900; font-size: 0.6em; font-weight: 700; padding: 3px 10px; border-radius: 6px; border: 1px solid #FF9900; letter-spacing: 0.02em; margin: 2px; }
  .merged-hero { display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a0a3a, #2d1060); border: 2px solid #8b5cf6; border-radius: 16px; padding: 20px; text-align: center; height: 100%; }
  .merged-hero .repo { font-size: 0.72em; color: #a78bfa; font-weight: 600; margin-bottom: 4px; }
  .merged-hero .pr-num { font-size: 1.5em; font-weight: 800; color: white; margin: 4px 0; }
  .merged-hero .badge { background: #8b5cf6; color: white; font-size: 0.75em; font-weight: 700; padding: 6px 20px; border-radius: 999px; margin: 8px 0; display: inline-block; }
  .merged-hero .approvers { font-size: 0.65em; color: #a78bfa; margin-top: 10px; line-height: 1.8; }
  .merged-hero .approver-name { color: #FF9900; font-weight: 700; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin: 8px 0; }
  .stat-item { text-align: center; }
  .stat-value { font-size: 2.4em; font-weight: 800; color: var(--accent); line-height: 1; display: block; }
  .stat-value.blue { color: var(--accent-warm); }
  .stat-value.green { color: #22c55e; }
  .stat-label { font-size: 0.68em; color: var(--muted); font-weight: 600; margin-top: 4px; display: block; }
  .cdkgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .cdk-item { background: rgba(255,153,0,0.06); border-left: 3px solid var(--accent); border-radius: 6px; padding: 6px 10px; font-size: 0.8em; }
  .cdk-item strong { color: var(--accent); }
---

<!-- _paginate: false -->
<!-- _class: title -->

# 技術アーキテクチャー と AI-DLC の実践と工夫
## SABOROU — AWS Summit Japan 2026 Hackathon

---

<!-- _class: section -->
<!-- _paginate: false -->

## 技術アーキテクチャー

心理学 × AI Agent × フルサーバーレス

---

![height:700](./../saborou-architecture.drawio.png)

---

![height:500](./../imgs/agent-1-task-extractor.png)

---

![height:600](./../imgs/agent-2-scheduler.png)

---

![height:600](./../imgs/agent-3-saboru-proposer.png)

---

## 3 AI Agents がつくる「サボり判定エンジン」

<div class="columns col-3">
<div class="card accent">

### Agent ① 抽出
<strong>TaskExtractorAgent</strong>

Slack Webhookを受信し
Bedrock Tool Use で
タスクを<strong>構造化抽出</strong>

</div>
<div class="card warn">

### Agent ② 整理
<strong>SchedulePlannerAgent</strong>

依存関係を解析し
心理学5理論で
<em>サボれる度</em>スコアを算出

</div>
<div class="card success">

### Agent ③ 提案
<strong>SaboriProposerAgent</strong>

根拠付きのサボり提案を生成
PersonaRenderer で
<strong>おっとり口調</strong>に変換

</div>
</div>

<div class="highlight">

EventBridge でイベント駆動連携 — Slack Webhook から <br/>SSE ストリーミング配信まで、3 Agents が<strong>疎結合で一気通貫</strong>

</div>

---
<!-- _class: dark -->

## Bedrock Tool Use で「説明できるAI判定」を実現

<div class="columns">
<div>

### 構造化出力を強制する設計

```typescript
// Tool Use で LLM の出力形式を保証
toolChoice: { type: "tool",
              name: "sabori_judgment" }
```

判定結果は必ずこの5フィールドで返る:

<table>
<thead><tr><th>フィールド</th><th>内容</th></tr></thead>
<tbody>
<tr><td style="color:#FF9900;"><code>verdict</code></td><td style="color:#FF9900;">can_saboru / borderline / must_do</td></tr>
<tr><td style="color:#FF9900;"><code>reasoning</code></td><td style="color:#FF9900;">判断の根拠（自然言語）</td></tr>
<tr><td style="color:#FF9900;"><code>summaryText</code></td><td style="color:#FF9900;">1行サマリ</td></tr>
<tr><td style="color:#FF9900;"><code>rawChatMessage</code></td><td style="color:#FF9900;">元の入力メッセージ</td></tr>
<tr><td style="color:#FF9900;"><code>nextCheckOffsetMinutes</code></td><td style="color:#FF9900;">次に確認する分数</td></tr>
</tbody>
</table>

> AIが<strong>何を根拠に判断したか</strong>をユーザーに開示。<br/>ブラックボックスにしない設計

</div>
<div>

### 心理学5理論をContextSignalに変換

<div class="card accent"><strong>Collective Effort Model</strong> 文脈欠損を検出</div>
<div class="card accent"><strong>Identifiability Effect</strong> 監視度を評価</div>
<div class="card accent"><strong>Self-Determination Theory</strong> <br/>外発プレッシャーを定量化</div>
<div class="card accent"><strong>Expectancy Theory</strong> 今やる期待値を算出</div>
<div class="card accent"><strong>Sucker Effect</strong> —損な役回りを検出</div>

<div style="margin-top:10px; font-size:0.8em; color:#FF9900;">
5理論中4理論に査読論文 DOI あり<br/>（Expectancy Theory は書籍）
</div>

</div>
</div>

---

## プロダクション品質のサーバーレスインフラ

<div class="columns">
<div>

### AWS CDK v2 — 7スタック構成

<div class="cdkgrid">
<div class="cdk-item"><strong>CognitoStack</strong> 認証・Google OAuth</div>
<div class="cdk-item"><strong>DataStack</strong> DynamoDB 8テーブル</div>
<div class="cdk-item"><strong>ApiStack</strong> Hono on Lambda</div>
<div class="cdk-item"><strong>AgentStack</strong> 3 AI Agents</div>
<div class="cdk-item"><strong>WebhookStack</strong> EventBridge</div>
<div class="cdk-item"><strong>FrontendStack</strong> CloudFront+S3</div>
<div class="cdk-item"><strong>ConfigDeployStack</strong> 環境設定・デプロイ制御</div>
</div>

<div style="margin-top:10px; margin-bottom:6px;">
<span class="aws-badge">Lambda</span>
<span class="aws-badge">DynamoDB</span>
<span class="aws-badge">Bedrock</span>
<span class="aws-badge">EventBridge</span>
<span class="aws-badge">Cognito</span>
<span class="aws-badge">CDK v2</span>
</div>

<div style="font-size:0.72em; color:#64748b; line-height:1.7;">
Lambda = サーバーレスでコスト最適 / DynamoDB = On-Demand で0→スケール対応<br>
Bedrock = モデルガバナンスとTool Use強制 / EventBridge = Agent間の疎結合
</div>

</div>
<div>

### 品質の証拠

<div class="stat-grid">
<div class="stat-item">
<span class="stat-value">1,322</span>
<span class="stat-label">テスト全パス</span>
</div>
<div class="stat-item">
<span class="stat-value green">0</span>
<span class="stat-label">cdk-nag エラー</span>
</div>
<div class="stat-item">
<span class="stat-value blue">$31</span>
<span class="stat-label">月額コスト</span>
</div>
</div>

<div class="highlight">

Cognito PKCE + <strong>HMAC-SHA256 署名</strong>付き OAuth state でCSRF対策済み。Slack Webhook 署名検証。<strong>入力生データは永続化せず、構造化データをTTL 30日保持</strong>

</div>

</div>
</div>

---

<!-- _class: section -->
<!-- _paginate: false -->

## AI-DLC の工夫

ただ使うのではなく、強化した

---

## 工夫 1 — Inception 前に環境を整え、AIをロジック設計に集中させた

<div class="columns">
<div>

### AI-DLC 開始前にやったこと

<div class="steps">
<div class="step">

<strong>モノレポ構築</strong> (pnpm workspaces)
7 Unit の依存順序を先に設計

</div>
<div class="step">

<strong>CI / テスト環境を先行整備</strong>
Vitest・Playwright・Biome を設定済みに

</div>
<div class="step">

<strong>チームでゴールイメージを徹底すり合わせ</strong>
要件・設計・ユーザーストーリーを何度も確認

</div>
</div>

</div>
<div>

### 効果

<div class="card warn">

<strong>AIへの「ノイズ」を排除</strong>

環境整備を人間側で実施して開始することで、AIが<strong>アーキテクチャ設計とロジック実装だけに集中</strong>できる状態を作った

</div>

<div class="card success">

<strong>人間が何度も確認・修正した →</strong>
要件・設計・ストーリーを繰り返しレビューし<br>チームで<strong>合意してから</strong>実装に進んだ

</div>

</div>
</div>

---
<!-- _class: dark -->

## 工夫 2 — 形式検証をワークフローに追加し、安全性を通学的に証明した

<div class="columns">
<div>

### 証明した3つのコアロジック

<div class="card accent"><strong>GuardTokenLimit</strong> <br/>　— 二分探索の<strong>終了性</strong>と境界値安全性</div>
<div class="card accent"><strong>Pseudonymize</strong><br/> 　— <strong>旧実装の衝突存在</strong>・HMAC 単射性</div>
<div class="card accent"><strong>ContextUtils</strong><br/> 　— スコアの<strong>単調性</strong></div>

### 専用 SKILL + サブエージェントを自作

Inception Application Design 完了後、<strong>実装前に</strong>Leanで定理を証明してから Construction へ進むフローを AI-DLC に組み込んだ

</div>
<div>

### オフバイワン証明（核心）

```lean
-- 通常の mid だと low=h-1 で無限ループ!
-- 上側バイアス式で終了を数学的に保証:
def upperBiasedMid (low high : Nat) :=
  (low + high + 1) / 2

theorem upperBiasedMid_gt_low
    (h : low < high) :
    upperBiasedMid low high > low := by
  simp [upperBiasedMid]; omega  -- QED ✓
```

<div class="highlight">

AIが設計したロジックの正しさを<br><strong>数学的定理として証明</strong>してから実装

</div>

</div>
</div>

---

## 工夫 3 — AI-DLCのバグを発見し、公式OSSに PR してマージさせた

<div class="columns col-6-4 middle">
<div>

### 発見したバグ: `session-continuity.md` の不整合

Construction 実行時に遭遇した問題:

<div class="card accent"><strong>問題①</strong> パスに `{unit-name}` が含まれない <br/>→ ファイルが見つからない</div>
<div class="card accent"><strong>問題②</strong> 複数ユニット時にどれを読むか指示がない</div>
<div class="card accent"><strong>問題③</strong> 実在しないファイル名を指定していた</div>

### 修正方針

`Read functional-design.md` を
`aidlc-docs/construction/{unit-name}/functional-design/` に修正し、`aidlc-state.md` から進行中ユニットを特定するよう改善

</div>
<div>

<div class="merged-hero">
<div class="repo">awslabs / aidlc-workflows</div>
<div class="pr-num">PR #276</div>
<div class="badge">✓ MERGED</div>
<div class="approvers">
Approved by<br>
<span class="approver-name">harmjeff</span><br>
<span class="approver-name">mayakost</span>
</div>

<a href="https://github.com/awslabs/aidlc-workflows/pull/276"
   style="display:inline-block; margin-top:10px; font-size:0.55em;
          color:#a78bfa; text-decoration:none; word-break:break-all;">
  PRのリンクはこちら
</a>
</div>

</div>
</div>

---

![bg](./../imgs/2.png)