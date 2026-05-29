# SABOROU ピッチ資料 — 技術パート（担当セクション）

**対象**: AWS Summit Japan 2026 ハッカソン 予選プレゼン（2026-05-30）
**担当**: 技術アーキテクチャー + AI-DLC の工夫
**持ち時間目安**: 技術アーキテクチャー 約2.5分 / AI-DLC の工夫 約2分

---

## SLIDE A: 技術アーキテクチャー（全体像）

### スライドタイトル
**「心理学 × AI Agents × フルサーバーレス — SABOROUを支える技術の3本柱」**

### スライドに乗せるもの

**アーキテクチャ図（簡略版）**

```
[Slack / Gmail / Google Calendar]
           ↓ Webhook
    [Lambda: Webhook Handler]
           ↓ EventBridge（イベント駆動・疎結合）
    ① [Lambda: TaskExtractorAgent]
           ↓ Bedrock converse API + Tool Use
    ② [Lambda: TaskOrganizerAgent]
           ↓ 心理学5理論でスコアリング
    ③ [Lambda: SaboriProposerAgent + PersonaRenderer]
           ↓ SSE ストリーミング
    [React Frontend] ← CloudFront + S3
```

**AWS サービスバッジ（視覚的に並べる）**
- Amazon Bedrock (Claude Sonnet)
- AWS Lambda (5関数)
- Amazon DynamoDB On-Demand
- Amazon EventBridge + Scheduler
- Amazon Cognito (Google OAuth PKCE)
- AWS CDK v2 (6スタック)

**コスト実績: 月額 $30.94**

### スピーカーノート（ナレーション）

> 「SABOROUの技術的コアは、3つのAIエージェントが連携する**イベント駆動型サーバーレスアーキテクチャ**です。
>
> Slackのメッセージが来ると、まず①TaskExtractorAgentがBedrockのconverse API + Tool Useでタスクを構造化抽出します。次に②TaskOrganizerAgentがタスク間の依存関係を整理し、ここで心理学5理論に基づいた"サボれる度スコア"を計算します。最後に③SaboriProposerAgentが根拠付きの提案を生成し、SSEでリアルタイムにユーザーの画面に届きます。
>
> 全コンピュートがLambda——常時稼働インスタンスはゼロ。月額$30.94で本番運用できる設計です。」

### 成功の状態
審査員が「AWSサービスをただ並べるのではなく、設計に意図がある」と感じる。

---

## SLIDE B: 技術アーキテクチャー（Bedrockの使い方）

### スライドタイトル
**「Bedrock converse API + Tool Use — 構造化出力で"説明できるAI判定"を実現」**

### スライドに乗せるもの

**3フェーズ判定フロー（アニメーション推奨: 1フェーズずつ表示）**

| フェーズ | 処理 | 技術的ポイント |
|---------|------|----------------|
| Phase 1: ContextCollector | Slack/Gmail/Calendar から文脈収集 | OAuth token は Secrets Manager から都度取得・キャッシュ |
| Phase 2: Bedrock Tool Use | `sabori_judgment` スキーマを強制 | `tool_choice: {type: "tool"}` で構造化出力を保証 |
| Phase 3: PersonaRenderer | 「おっとり口調」に変換 | 判断ロジックと表現を分離（将来の多人格対応）|

**Bedrockの出力スキーマ（視覚的に示す）**
```
verdict:              "skip" | "delay" | "do_it"
reasoning:            string（根拠）
summaryText:          string（1行サマリ）
nextCheckOffsetMinutes: number
```

**心理学5理論の組み込み（表形式）**

| 理論 | ContextSignal | 効果 |
|------|--------------|------|
| Collective Effort Model | contextCoverage | 文脈欠損を検出 |
| Identifiability Effect | requesterActiveStatus | 依頼者の監視度を評価 |
| Sucker Effect | requesterActiveStatus | 損な役回りを回避 |
| Self-Determination Theory | reminderCount / urgencyLevel | 外発プレッシャーを定量化 |
| Expectancy Theory | deadlineMinutes | 今やる期待値を計算 |

### スピーカーノート（ナレーション）

> 「SABOROUの判断は"なんとなく"ではありません。
>
> Bedrockのconverse APIで`tool_choice: {type: "tool"}`を指定することで、AIに必ず構造化スキーマ——verdict（サボるか否か）、reasoning（根拠）、nextCheckOffsetMinutes（次に確認すべき時刻）——を出力させます。AIが何を根拠に判断したかが常にユーザーに示せる設計です。
>
> そして判断の入力には、行動科学・心理学の5理論から導いたContextSignalsを使います。「依頼者が今アクティブか」「締切まで何分か」——これらの数値がサボり判定を科学的に裏付けます。」

### 成功の状態
審査員が「BedrockをAPIとして使うだけでなく、Tool Useで制御している」という設計の深さを理解する。

---

## SLIDE C: 技術アーキテクチャー（インフラ品質）

### スライドタイトル
**「AWS CDK v2 × 542テスト全パス × cdk-nag準拠 — プロダクション品質のインフラ」**

### スライドに乗せるもの

**CDK 6スタック構成（依存関係矢印付き）**

```
CognitoStack ──→ ApiStack ──→ FrontendStack
DataStack ────→ ApiStack
DataStack ────→ AgentStack ──→ WebhookStack
AgentStack ───→ WebhookStack
```

**テスト実績（大きく表示）**

| 対象 | テスト数 | 結果 |
|------|---------|------|
| pkgs/shared | 93 | ALL PASS |
| pkgs/cdk | 35 | ALL PASS |
| pkgs/agent | 104 | ALL PASS |
| pkgs/backend | 117 | ALL PASS |
| pkgs/frontend | 53 | ALL PASS |
| E2E (Playwright) | 5 | ALL PASS |
| **合計** | **542** | **ALL PASS** |

**セキュリティ実装のポイント**
- Cognito + Google OAuth（PKCE対応）
- OAuth state に HMAC-SHA256 署名（CSRF対策）
- Slack Webhook 署名検証（@slack/bolt）
- 外部サービスの生データは処理後即削除（DynamoDBにはサマリのみ保存）

### スピーカーノート（ナレーション）

> 「インフラはAWS CDK v2をTypeScriptで記述し、6スタックに役割分離しています。
>
> ハッカソンとはいえ、テストは妥協しませんでした。shared・agent・backend・frontend・CDK・E2Eを合わせて542テストが全パス。cdk-nagによるAWSベストプラクティス準拠チェックもエラーゼロ。
>
> 認証はCognitoとGoogle OAuthのPKCEフロー。OAuth stateにはHMAC-SHA256署名をつけてCSRF対策。Slackからのwebhookも署名検証済み。ハッカソンではなく、実際にリリースできる品質を目指しました。」

### 成功の状態
審査員が「このチームは動くだけでなく、安全なプロダクトを作っている」と確信する。

---

## SLIDE D: AI-DLC の工夫（全体戦略）

### スライドタイトル
**「AI-DLC をただ使うのではなく、強化した——私たちのワークフロー革新」**

### スライドに乗せるもの

**3つの工夫（アニメーション: 1つずつ表示）**

```
工夫 1: ベース環境を最初に整備してからInceptionを開始
       → AIがロジック設計に集中できる環境を作った

工夫 2: Lean 4 による形式検証をワークフローに組み込み
       → コアロジックの正しさを数学的に証明

工夫 3: 発見したバグをOSS公式リポジトリにPRして修正
       → awslabs/aidlc-workflows PR #276 → マージ済み ✅
```

### スピーカーノート（ナレーション）

> 「AI-DLCは強力なワークフローですが、私たちはただ従うだけでなく、3つの観点で強化しました。
>
> 1つ目は、Inceptionフェーズを始める前にモノレポ・CI・テスト設定・フォーマッターを整備したこと。AIがアーキテクチャやロジックの設計に集中できるように、環境整備という"ノイズ"を先に除去したんです。
>
> 2つ目は形式検証の導入。3つ目は、AI-DLCを実際に使って発見したバグをAWSの公式OSSに対してPRで修正したことです——そしてそのPRはマージされました。」

---

## SLIDE E: AI-DLC の工夫（Lean 形式検証）

### スライドタイトル
**「Lean 4 形式検証——"AIが作ったロジック"の正しさを数学的に証明」**

### スライドに乗せるもの

**形式検証の対象（3ファイル）**

| 検証対象 | 証明した命題 |
|---------|------------|
| `GuardTokenLimit.lean` | 二分探索の終了性、オフバイワン証明、結果のトークン数制約 |
| `Pseudonymize.lean` | 仮名化の冪等性、SHA-256の決定性 |
| `ContextUtils.lean` | 文脈スコアの単調性、ゼロ除算不発生 |

**GuardTokenLimit の核心（コード断片を視覚的に示す）**

```lean
-- オフバイワン証明: 通常の mid だと low=h-1 で無限ループ
-- 上側バイアス式 ⌊(low+high+1)/2⌋ でloopを保証
theorem upperBiasedMid_gt_low :
    low < high → upperBiasedMid low high > low := by omega
```

**実装フロー**

```
Inception Application Design 完了
           ↓
  Lean 4 でロジックを形式検証  ←── 専用 SKILL + サブエージェントを自作
           ↓ 証明成功
  Construction Code Generation へ進む
```

### スピーカーノート（ナレーション）

> 「AIが設計したロジックに、本当にバグはないのか——この問いに答えるために、私たちはLean 4という定理証明言語を使った形式検証をAI-DLCワークフローに組み込みました。
>
> たとえばトークン制限の二分探索。通常の中点計算 `⌊(low+high)/2⌋` だとlow=h-1のとき無限ループが発生する。これをLeanで証明し、上側バイアス式への変更の正当性を数学的に示しました。
>
> Lean検証のための専用SKILLとサブエージェントも自作しました。Inceptionフェーズでロジックを設計したら、コードを書く前に形式検証を通過させる——このフローがSABOROUの品質保証の核心です。」

### 成功の状態
審査員が「AIが書いたコードを形式検証で担保するというアプローチは他チームにない」と評価する。

---

## SLIDE F: AI-DLC の工夫（OSS コントリビューション）

### スライドタイトル
**「AI-DLC を理解し、改善し、公式 OSS に貢献した」**

### スライドに乗せるもの

**大きく目立つバッジ（スライド中央に配置）**

```
awslabs/aidlc-workflows
Issue #275 → PR #276 → MERGED ✅
Approved by: harmjeff, mayakost
```

**Issue の内容（1行で）**

> `session-continuity.md` の Per-Unit Design 読み込み指示に3つのバグ。
> マルチユニット Construction でセッション再開時、ファイルパスが存在しない名前を指している。

**修正の内容（Before / After）**

| Before（バグあり） | After（修正後） |
|------------------|----------------|
| `Read functional-design.md, nfr-requirements.md, ...` | `Read aidlc-docs/construction/{unit-name}/{functional-design,nfr-requirements,...}/` |
| どのユニットのファイルか不明 | `aidlc-state.md` から進行中ユニットを特定してから読む |
| 実在しないファイル名を指定 | ステージルールファイルを単一情報源として参照 |

**インパクトを視覚化**

```
私たちは AI-DLC を "使った" だけではなく
"実際に動かして問題を発見し" "直した" チームです
```

### スピーカーノート（ナレーション）

> 「6ユニット・マルチユニット構成でAI-DLCのConstructionフェーズを進める中で、私たちはワークフロー自体のバグに気づきました。
>
> `session-continuity.md`——セッション中断後に再開するためのルールファイルです。ここでの Per-Unit Design の読み込み指示が、実際のディレクトリ構造と一致していない。存在しないファイル名を指定していて、マルチユニットプロジェクトではどのユニットを読めばいいかも分からない状態でした。
>
> 私たちはこれをGitHub Issueに詳細に報告し、修正PRを送りました。そのPRはAWSのメンテナー2名のレビューを経てマージされました（PR #276）。
>
> AI-DLCを使ったチームはたくさんいると思います。でも、そのワークフローを深く理解してOSSに貢献したチームは、ほとんどいないはずです。」

### 成功の状態
審査員が「このチームはツールを使うだけでなく、技術コミュニティに貢献している」と強く印象付けられる。

---

## 全体タイムライン（参考）

| スライド | 内容 | 目安時間 |
|---------|------|---------|
| A | 技術アーキテクチャー全体像 | 1.0分 |
| B | Bedrock の使い方（心理学5理論） | 0.75分 |
| C | インフラ品質（CDK・テスト・セキュリティ） | 0.75分 |
| D | AI-DLC 工夫の全体戦略 | 0.5分 |
| E | Lean 4 形式検証 | 0.75分 |
| F | OSS コントリビューション | 0.75分 |
| **合計** | | **4.5分** |

> 「展望」スライドが前後にある場合、技術アーキテクチャーをA+Bの2枚に絞り（C省略）して3.5分に収めることも可能。

---

## Q&A 想定問答（審査員から来やすい質問）

**Q: なぜBedrockのAgentCoreを使わずconverse APIを直接使ったのですか？**

> A: 「AgentCoreはマネージドですが、今回はサボり判定の"出力スキーマ"を完全にコントロールすることが最優先でした。Tool UseでJSONスキーマを強制することで、LLMが毎回必ず`verdict`と`reasoning`を返すことを保証できます。AgentCoreへの移行は`IBedrockClient`インタフェースで抽象化済みです。」

**Q: 心理学理論の根拠はどこですか？**

> A: 「5理論すべてにDOI付きの査読論文があります。Karau & Williams (1993)のCollective Effort Model、Ryan & Deci (2000)のSelf-Determination Theoryなど。要件定義書にDOI一覧を記載しています。」

**Q: 実際のコストはいくらですか？**

> A: 「月額$30.94の見積もりです。Bedrock呼び出しが最大コストで、1リクエスト8,000トークン制限をアプリ層でガードしています。DynamoDBはOn-Demandモードなので使わなければゼロです。」

**Q: Lean形式検証は本番コードに影響しますか？**

> A: 「いいえ。Leanは設計フェーズでの証明専用です。TypeScriptの本番コードと1対1で対応する数学的モデルをLeanで書き、定理を証明することで実装の正しさを担保します。証明が成功したら、そのロジックをそのままTypeScriptで実装します。」

**Q: PR #276はどのくらいの規模の変更ですか？**

> A: 「additions 6行、deletions 1行の小さな変更です。しかし実際のマルチユニットConstructionランで再現したバグの根本原因を分析し、単一情報源の原則に従った修正を提案しました。レビュアーのharmjeffとmayakostから2つのApprovalを得てマージされました。」

---

## スライド作成時の注意点

1. **技術アーキテクチャー図はシンプルに**: AWS公式アイコンを使い、サービス間の矢印の意味（EventBridge = 疎結合）を一目で分かるように。
2. **数字は大きく**: 542テスト、$30.94、5理論、PR #276 は視覚的に目立たせる。
3. **PR #276 はスクリーンショット推奨**: マージ済みの証拠としてGitHubのPRページのスクリーンショットをスライドに貼る（Approved・Merged ラベルが見えるもの）。
4. **Lean コードは1定理のみ**: `omega` タクティクで短く終わるものを選ぶと「数学的証明」のインパクトが伝わりやすい。
5. **アニメーション活用**: Slide Dの3つの工夫は1つずつ表示して、各ポイントで少し間を取る。
