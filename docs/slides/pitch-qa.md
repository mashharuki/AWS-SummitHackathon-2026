# SABOROU 想定 Q&A 集
## AWS Summit Japan 2026 ハッカソン 予選（2026-05-30）

> 審査員（AWSエンジニア・事業責任者）が投げてくる質問を6カテゴリに分類。
> 各回答は「結論→根拠→証拠」の順で構成している。

---

## カテゴリ 1: テーマ・コンセプト

### Q1. 「人をダメにする」という点が正直分かりづらい。便利なタスク整理ツールでは？

**A:**
SABOROUは意図的な二重設計になっています。
表の顔は「科学的根拠に基づいてサボれる理由を提示する便利ツール」ですが、
裏の設計は「AIが毎回サボりを許可し続けることで、ユーザー自身の判断力を外部化・AI依存化していく」点にあります。

具体的には、使い続けるほど次の4能力が退化します：

| 能力 | 使用前 | 3ヶ月後 |
|------|--------|---------|
| タスク整理 | 自分でリスト化できる | AIの抽出を待つだけ |
| 優先順位判断 | 自分で決定できる | サボローの判定待ちになる |
| 危機管理 | 自分で「そろそろ危ない」と察知 | システムの警告待ちになる |
| 締切感覚 | 体感で時間を把握 | 内在化された感覚が弱まる |

「道具として便利」と「依存して無力化」は矛盾しない設計です。

---

### Q2. ユーザーはサボりを推奨されても本当に嬉しいのか？需要があるのか？

**A:**
ターゲットは「タスクが多すぎて判断疲れしている会社員」です。
「今これをやるべきか」という判断コストは、実務で非常に高い。
サボローは「今やらなくていい合理的な理由を、科学的根拠付きで提示してくれる」という体験を提供します。

ユーザーは最初から「ダメになる」と思って使うのではなく、
「便利で気持ちが楽になる」から継続する。その過程で依存が形成される設計です。
これはスマートフォンやSNSが「便利だから使い続けた結果として人を変えた」構造と同じです。

---

### Q3. Slack だけの連携では文脈が足りないのではないか？

**A:**
MVPスコープはSlack単独に絞っています。
理由はデモの信頼性と時間制約です。Slackは職場のコミュニケーションのハブであり、
タスクの依頼・締切・リマインドの大部分がSlack上に存在します。

技術アーキテクチャはWebhook + EventBridgeで外部サービスを差し込み可能に設計されており、
Gmail・Google Calendarへの拡張は構造的にサポートしています。予選デモではSlack一本に集中してコアバリューを見せます。

---

## カテゴリ 2: 技術アーキテクチャ

### Q4. なぜWebSocketではなくSSEを選んだのか？

**A:**
SABOROUのユースケースはサーバーからクライアントへの一方向ストリーミング（判定結果の逐次配信）です。
双方向通信は不要なため、実装コストとインフラコストが低いSSEが最適です。

具体的なメリット：
- HTTP/1.1互換（API GatewayのHTTPモードで動作）
- WebSocketと異なりコネクション管理が不要（サーバーレスとの相性が良い）
- Hono on Lambda上でネイティブに実装できる

---

### Q5. Lambda の cold start はどう対処しているのか？

**A:**
SaboriProposerAgentはmemorySize=1024MB / timeout=90sに設定しており、
Bedrockへのリクエスト前にSecretsManagerキャッシュを再利用する設計でコールドスタートの影響を最小化しています。

予選のデモシナリオでは事前にwarm-upリクエストを行います。
本番用途では Provisioned Concurrency の適用が次のアクションとして計画されています。

---

### Q6. DynamoDB の設計でホットパーティション問題は起きないのか？

**A:**
パーティションキーをユーザーIDではなく `userId + taskId` の複合キーにしており、
特定ユーザーへのアクセスが集中してもパーティションが分散される設計です。
また、On-Demandモードを採用しており、バーストアクセスに自動スケールします。
DynamoDB 8テーブル全てに対してcdk-nagのWarning 0件を確認済みです。

---

### Q7. EventBridge で Agent 間を疎結合にしている理由は？

**A:**
3つのAgentが直接呼び出しあう構造にした場合、1つのAgentの遅延・障害が全体に波及します。
EventBridgeを仲介することで：

- Agent間の依存を排除（どちらかが落ちても影響を局所化）
- 各AgentのSLAを独立して設定可能
- 将来のAgent追加・差し替えが設定変更だけで済む

また、EventBridgeのルールによりイベントのフィルタリング・ルーティングが宣言的に管理できます。

---

### Q8. 7スタック構成の意図は？分割のルールは何か？

**A:**
責務分離とデプロイ独立性が分割基準です。

| スタック | 理由 |
|---------|------|
| CognitoStack | 認証基盤は最初に立て、他全スタックが参照する |
| DataStack | DynamoDBテーブルはAPIとAgentが共有するため先に独立 |
| ApiStack | Hono on Lambda はフロントとは独立してデプロイ可能 |
| AgentStack | AIエージェント3本は一体で管理 |
| WebhookStack | EventBridgeルールはSlack側変更と切り分け |
| FrontendStack | CloudFront+S3はフロントデプロイのみで差し替え可能 |
| ConfigDeployStack | 環境設定・デプロイ制御を他スタックから分離 |

customDomain有効時はさらに2スタック追加されて合計9スタックになります。

---

### Q9. テスト 1,322 件は何を担保しているのか？内訳は？

**A:**
内訳は以下の通りです：

| パッケージ | テスト数 | 主な検証内容 |
|-----------|---------|------------|
| shared | 149件 | ドメインエンティティ・ビジネスロジック・バリデーション |
| agent | 264件 | TaskExtractorAgent・SchedulePlannerAgent・SaboriProposerAgent |
| backend | 376件 | APIエンドポイント・DynamoDB操作・認証フロー |
| frontend | 464件 | Reactコンポーネント・ユーザーインタラクション |
| cdk | 69件 | インフラ定義・スタック間依存・cdk-nag準拠 |

cdk-nagエラー0件・カバレッジはsharedで100%を達成しています。

---

## カテゴリ 3: AI・Bedrock 活用

### Q10. なぜプロンプトエンジニアリングだけでなく Tool Use を使うのか？

**A:**
プロンプトだけでは出力形式が保証されません。
LLMは指示に反してJSONでなく自然言語で返すことがあります。

`toolChoice: { type: "tool", name: "sabori_judgment" }` を指定することで、
BedrockにsaboriJudgmentスキーマへの出力を**強制**します。
これにより後続処理が例外なくパースできることを保証し、ユーザーへの「判断根拠の開示」も確実に行えます。

出力の5フィールドは次の通りです：

| フィールド | 内容 |
|-----------|------|
| `verdict` | can_saboru / borderline / must_do |
| `reasoning` | 判断の根拠（自然言語） |
| `summaryText` | 1行サマリ |
| `rawChatMessage` | 元の入力メッセージ |
| `nextCheckOffsetMinutes` | 次に確認する分数 |

---

### Q11. なぜ Claude Sonnet 4.6 なのか？Haiku では十分では？

**A:**
心理学5理論の5つのContextSignalを同時に推論し、
矛盾なく重み付けしてverdictを出すタスクは複雑な多段推論を要します。
Haiku では推論深度が不足し、verdictの整合性が低下することを検証で確認しています。

コスト面ではSaboriProposerAgentのみSonnet 4.6を使用し、
他の軽量タスク（PersonaRenderingなど）はHaikuを使うことでコストと精度を両立しています。

---

### Q12. 心理学5理論はどのようにContextSignalに変換されるのか？

**A:**
各理論に対応するシグナルをSlackのWebhookペイロードから抽出します：

| 理論 | 対応するContextSignal | 取得元 |
|------|---------------------|--------|
| Collective Effort Model | contextCoverage（文脈充足度） | Slackメッセージのスレッド深度 |
| Identifiability Effect | requesterActiveStatus | Slackのユーザーステータス |
| Sucker Effect | requesterActiveStatus | 依頼者の直近アクティビティ |
| Self-Determination Theory | reminderCount / urgencyLevel | リマインドメッセージ回数 |
| Expectancy Theory | deadlineMinutes | 締切日時の抽出値 |

これらを数値化してBedrockへ入力することで、LLMの恣意的な判断ではなく学術理論に基づく判定を実現します。

---

### Q13. 5理論の根拠に査読論文があると言っているが、全部DOIがあるのか？

**A:**
5理論中4理論に査読論文DOIがあります。
Expectancy Theory（Vroom, 1964）は書籍（*Work and Motivation*, Wiley）であるためDOIが存在しません。
残る4理論はいずれも *Journal of Personality and Social Psychology* 等に掲載された査読済み論文です。

#### 各理論の査読論文詳細

---

**① Collective Effort Model（集団努力モデル）**

| 項目 | 内容 |
|------|------|
| 著者 | Steven J. Karau（スティーブン・J・カロー）& Kipling D. Williams（キプリング・D・ウィリアムズ） |
| 年 | 1993 |
| タイトル | Social loafing: A meta-analytic review and theoretical integration |
| タイトル（訳） | 社会的手抜き：メタ分析レビューと理論的統合 |
| 掲載誌 | *Journal of Personality and Social Psychology*, 65(4), 681–706 |
| DOI | [10.1037/0022-3514.65.4.681](https://doi.org/10.1037/0022-3514.65.4.681) |

**概要:** 78件の社会的手抜き研究を統合したメタ分析。個人の貢献が集団の成果に埋没するほど、努力の期待価値が下がり手抜きが起きるという CEM を定式化。SABOROU では「文脈が不足したタスク依頼（contextCoverage低下）」がこのシグナルに対応し、集団内での個人責任の薄さをスコア化している。

---

**② Identifiability Effect（識別可能性効果）**

| 項目 | 内容 |
|------|------|
| 著者 | Kipling D. Williams（キプリング・D・ウィリアムズ）, Stephen G. Harkins（スティーブン・G・ハーキンズ）, & Bibb Latané（ビブ・ラタネ） |
| 年 | 1981 |
| タイトル | Identifiability as a deterrent to social loafing: Two cheering experiments |
| タイトル（訳） | 社会的手抜きの抑止としての識別可能性：2つの応援実験 |
| 掲載誌 | *Journal of Personality and Social Psychology*, 40(2), 303–311 |
| DOI | [10.1037/0022-3514.40.2.303](https://doi.org/10.1037/0022-3514.40.2.303) |

**概要:** 個人パフォーマンスが識別・評価可能になると社会的手抜きが消失することを実験で実証。依頼者（上司・同僚）が自分の行動を観察できない状況では努力が低下する。SABOROU では `requesterActiveStatus`（依頼者がオフラインかどうか）として実装しており、依頼者が離席中であれば「識別されない＝サボれる」とスコアに反映する。

---

**③ Sucker Effect（カモ回避効果）**

| 項目 | 内容 |
|------|------|
| 著者 | Norbert L. Kerr（ノーバート・L・カー） |
| 年 | 1983 |
| タイトル | Motivation losses in small groups: A social dilemma analysis |
| タイトル（訳） | 小集団における動機づけの損失：社会的ジレンマ分析 |
| 掲載誌 | *Journal of Personality and Social Psychology*, 45(4), 819–828 |
| DOI | [10.1037/0022-3514.45.4.819](https://doi.org/10.1037/0022-3514.45.4.819) |

**概要:** 他のメンバーがサボっているときに自分だけ頑張ると「カモ（Sucker）」になるため、人は努力量を意図的に引き下げることを示した。依頼者本人が最近タスクを完了していない場合、「損な役回りを引き受ける必要はない」という判断が働く。SABOROU では依頼者のアクティビティ履歴を `requesterActiveStatus` で評価し、この効果をスコアに組み込んでいる。

---

**④ Self-Determination Theory（自己決定理論）**

| 項目 | 内容 |
|------|------|
| 著者 | Richard M. Ryan（リチャード・M・ライアン）& Edward L. Deci（エドワード・L・デシ） |
| 年 | 2000 |
| タイトル | Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being |
| タイトル（訳） | 自己決定理論と内発的動機づけ・社会的発達・ウェルビーイングの促進 |
| 掲載誌 | *American Psychologist*, 55(1), 68–78 |
| DOI | [10.1037/0003-066X.55.1.68](https://doi.org/10.1037/0003-066X.55.1.68) |

**概要:** 人間の動機づけには「自律性・有能感・関係性」の3基本欲求が必要であり、外発的コントロール（監視・プレッシャー・リマインド）はむしろ内発的動機づけを阻害することを示した。SABOROU では `reminderCount`（リマインド回数）が高いほど「強制されている感＝やりたくない」としてスコアに反映し、外圧が動機を逆説的に下げることを理論的根拠にしている。

---

**⑤ Expectancy Theory（期待理論）**

| 項目 | 内容 |
|------|------|
| 著者 | Victor H. Vroom（ビクター・H・ブルーム） |
| 年 | 1964 |
| タイトル | *Work and Motivation*（ワーク・アンド・モチベーション） |
| タイトル（訳） | 働くことと動機づけ |
| 出版社 | Wiley, New York |
| DOI | なし（書籍のため） |

**概要:** 動機づけ＝期待（努力→成果）× 手段性（成果→報酬）× 誘意性（報酬の価値）という E×I×V モデルを提唱。締切が遠すぎる・または近すぎて諦めている場合、「今やっても意味がない」という低い期待値が成立しサボりを正当化できる。SABOROU では `deadlineMinutes` から期待値を推定し、このシグナルをスコアに組み込んでいる。

---

### Q14. AI の判定精度はどうやって測るのか？主観的では？

**A:**
現時点での精度測定は定性評価（実際のSlackメッセージを入力した場合の判定の納得感）です。
定量的な正解ラベルを定義することが難しいドメインのため、次のアプローチを計画しています：

1. ユーザーフィードバック（「この判定は正しかったか」のサムアップ）
2. A/Bテストによるverdictの比率分析
3. 締切超過率・タスク完了率との相関分析

予選段階ではコアバリュー（「説明できるAI判定」）のデモが主目的です。

---

## カテゴリ 4: セキュリティ・プライバシー

### Q15. Slack の OAuth トークンはどう管理しているのか？

**A:**
AWS Secrets Managerに保存し、Lambda実行時に都度取得してメモリ上でのみ使用します。
コードへのハードコードは一切なく、環境変数経由でのSecret名のみを参照します。
SecretsManagerへのIAMアクセスは最小権限原則に従いAgentStackのみに付与しています。

---

### Q16. Slack のメッセージ内容（個人情報）はどう扱うのか？保存されるのか？

**A:**
入力生データ（rawChatMessage）はBedrockへの推論入力として使用しますが、DynamoDBには永続化しません。
抽出済みの構造化データ（タスクID・deadlineMinutes・verdictなど）をTTL 30日で保持します。
「即削除」ではなく「生データは永続化せず、構造化データはTTL管理」が正確な表現です。

Slack Webhook受信時の署名検証（HMAC-SHA256）も実装済みで、
正規のSlackからのリクエストのみを処理します。

---

### Q17. Cognito の認証でどのようなCSRF対策をしているのか？

**A:**
Google OAuthの認可コードフロー（PKCE）を使用し、
OAuthのstateパラメーターにHMAC-SHA256署名を付加したCSRF対策を実装しています。
stateを検証することで、不正なリダイレクトからのコード注入攻撃を防いでいます。
cdk-nagの`AwsSolutionChecks`でセキュリティルール違反0件を確認済みです。

---

### Q18. Slack のエンタープライズ環境で使う場合、管理者の許可は必要では？

**A:**
正しい指摘です。Slack WorkspaceへのBot登録には管理者権限が必要です。
予選段階では開発者自身のWorkspaceで動作検証しています。

商用展開時はSlack App Marketplaceへの申請・審査を経て、
管理者が承認した上でインストールする形になります。
これはエンタープライズ採用時の標準フローであり、技術的な制約ではありません。

---

## カテゴリ 5: ビジネス・スケール

### Q19. マネタイズはどうするのか？

**A:**
SaaSサブスクリプションモデルを想定しています：

| プラン | 対象 | 想定価格 |
|--------|------|---------|
| Free | 個人・月50判定まで | 無料 |
| Pro | 個人・無制限 | 月額980円 |
| Team | 企業・Slack Workspace単位 | 月額9,800円〜 |

月額コスト$31（実測値）に対し、100ユーザーでProプランに加入した時点で黒字化します。
DynamoDB On-Demand + Lambda従量課金のため、ユーザー数に比例してコストが増えるモデルです。

---

### Q20. 競合との差別化は何か？他のタスク管理ツールとどう違うのか？

**A:**
既存のタスク管理ツール（Notion, Asana, Todoist等）は「タスクを確実にやらせる」方向に設計されています。
SABOROUは逆に「今やらなくていい科学的根拠を提示する」唯一のサービスです。

技術的差別化点：
- Bedrock Tool Useによる構造化判定（ブラックボックスにしない）
- 心理学5理論をContextSignalに変換した独自スコアリング
- PersonaRendererによる「おっとり口調」の人格表現

「サボりを推奨する」というコンセプト自体が競合のいないブルーオーシャンです。

---

### Q21. スケールしたとき Bedrock のレート制限は問題にならないのか？

**A:**
Amazon Bedrockのスロットリングリミットはモデル・リージョンごとに設定されており、
本番利用では Service Quotas から引き上げ申請が可能です。

アーキテクチャ面では：
- EventBridgeのキューイングで同時Bedrock呼び出し数を制御
- SaboriProposerAgentに指数バックオフ付きリトライを実装
- 1ユーザーの判定はほぼ独立して処理されるため、同時負荷は分散されます

---

### Q22. 月額 $31 という数字は何で構成されているのか？

**A:**
主要コスト構成（実測・推定）：

| サービス | 想定コスト |
|---------|-----------|
| Amazon Bedrock (Sonnet 4.6) | $20〜25 |
| Lambda 実行 | $2〜3 |
| DynamoDB On-Demand | $1〜2 |
| CloudFront + S3 | $1 |
| その他（Cognito, EventBridge等） | $1〜2 |

開発・テスト環境での実測値であり、ユーザー数増加に伴いBedrockコストが線形に増加します。

---

## カテゴリ 6: AI-DLC・開発プロセス

### Q23. AI-DLC を使った結果、どんな効果があったのか？

**A:**
最も大きな効果は「AIに設計の意思決定を丸投げしなかった」ことです。

具体的には：
- Requirements Analysis・User Storiesで7回以上のレビューサイクルを回した
- Application Designでエージェント数・責務分離を人間側で議論し、AIの提案を修正した
- Construction各Stageでコード生成前に必ず設計書を人間がレビューしてから進んだ

その結果、1,322テスト・cdk-nagエラー0件・Lean形式検証という品質水準を達成できています。
audit.md に全インタラクションの記録があります。

---

### Q24. Lean 形式検証を取り入れた理由は？過剰では？

**A:**
過剰ではありません。SABOROUには「証明できないと怖いロジック」が3つあります：

1. **GuardTokenLimit**: Bedrockへのトークン分割で無限ループが起きないか
2. **Pseudonymize**: 仮名化の旧実装に衝突が存在し、HMAC単射性が必要だった
3. **ContextUtils**: スコア計算の単調性が崩れると判定が逆転する

これらは「テストでカバー」ではなく「数学的証明」が必要な性質のロジックです。
Leanで定理を証明してからコード生成に進む、というフローをAI-DLCに組み込みました。

---

### Q25. awslabs/aidlc-workflows への OSS 貢献について詳しく教えてほしい。

**A:**
ConstructionフェーズのCode Generation実行中に `session-continuity.md` の参照パスが実際のディレクトリ構造と一致しないバグを発見しました。

具体的な問題：
1. パスに `{unit-name}` が含まれておらず、ファイルが見つからない
2. 複数ユニット並行時にどのユニットを参照するか指示がない
3. 実在しないファイル名を指定していた

修正内容は `aidlc-docs/construction/{unit-name}/functional-design/` への正しいパス修正と、`aidlc-state.md` から進行中ユニットを特定するロジックの追加です。

PR #276 は harmjeff・mayakost の2名に承認されマージされています。
ツールを使いながらバグを見つけてフィードバックする、AIと人間の協働のよい例だと考えています。

---

### Q26. AI が生成したコードを人間がどの程度確認しているのか？

**A:**
全ての生成コードを人間がレビューしています。
AI-DLCではCode Generationを「Plan（計画）→ 承認 → Generation（実行）」の2段階に分けています。

- Plan段階でAIが「何を・どの順番で・どのテストで検証するか」を提示
- 人間がPlanを承認してからコード生成を開始
- 生成後にテスト全通過・型チェック・lintをパスすることを人間が確認してStage完了

audit.md にはAIの提案を人間が修正・却下した記録が複数存在します。

---

## カテゴリ 7: デモ・実装

### Q27. デモで見せられる機能は何か？実際に動くのか？

**A:**
予選デモでは以下のフローをライブで見せます：

1. Slackにタスク依頼メッセージを送信
2. SABOROUがWebhookを受信し、TaskExtractorAgentがタスクを抽出
3. SchedulePlannerAgentが依存関係を整理し、心理学スコアを算出
4. SaboriProposerAgentがSSEでリアルタイムに判定結果をストリーミング配信
5. フロントエンドに `can_saboru / borderline / must_do` と根拠が表示される

AWSにデプロイ済みの環境でデモします。ローカル環境ではありません。

---

### Q28. 「おっとり口調」はどうやって実現しているのか？

**A:**
PersonaRendererが担当しており、SaboriProposerAgentとは実装を分離しています。
verdictとreasoningが確定した後、PersonaRendererがBedrockに対して
「おっとりした口調でreasoningを言い換える」プロンプトを送信します。

分離のメリット：
- 判断ロジック（心理学理論）と表現スタイルが独立して変更可能
- 将来的に「関西弁」「敬語」など複数のペルソナに差し替えられる
- PersonaRenderer単体のテストが容易

---

### Q29. SSE ストリーミングはどこからどこへ流れているのか？

**A:**
Hono on Lambda（ApiStack）内でSaboriProposerAgentを直接実行し、
その出力をSSEとしてフロントエンドにストリーミングします。

SaboriProposer Lambdaは定期再評価（EventBridge Scheduler）専用で、
リアルタイムのSSE配信とは別パスになっています。

```
[フロントエンド]
    ↑ SSE接続
[Hono Lambda] ← SaboriProposerAgentを直接実行
    ↑ Bedrock Tool Use
[Amazon Bedrock (Claude Sonnet 4.6)]
```

---

## カテゴリ 8: 形式検証（スライド12 深掘り）

> 他チームがほぼやっていない領域。審査員の好奇心・専門的な突っ込みが集中するポイント。

---

### Q30. そもそも Lean とは何か？なぜ Lean を選んだのか？

**A:**
Leanは定理証明支援系（Theorem Prover）と呼ばれるツールで、数学的命題をコードとして記述し、
その正しさをコンピュータが機械的に検証するものです。
「テストが通った」ではなく「あらゆる入力に対して必ず正しい」ことを証明できます。

選定理由は3点です：
1. Lean 4はプログラミング言語として実用的な構文を持ち、TypeScriptエンジニアでも読み書きできる
2. `omega` タクティクで自然数の不等式を自動証明できるため、GuardTokenLimitのような算術問題に最適
3. AI（Claude）が定理証明の補助コードを生成する実績があり、AI-DLCとの親和性が高い

---

### Q31. テストを書けば十分では？なぜ形式証明が必要なのか？

**A:**
テストは「試したケースが正しい」ことしか保証しません。
形式証明は「すべての入力に対して正しい」ことを保証します。

たとえばGuardTokenLimitの二分探索では：
- テストで `low=0, high=100` や `low=49, high=50` を試しても合格できる
- しかし `low=high-1` のとき `mid=(low+high)/2=low` になり**無限ループ**が発生する
- このケースはテストの網羅性に依存するため、見落とすリスクがある

Leanで `∀ low high, low < high → upperBiasedMid low high > low` を証明すれば、
整数の全域で無限ループが起きないことが**数学的に保証**されます。

---

### Q32. スライドの Lean コードを具体的に説明してほしい。

**A:**
```lean
def upperBiasedMid (low high : Nat) :=
  (low + high + 1) / 2

theorem upperBiasedMid_gt_low
    (h : low < high) :
    upperBiasedMid low high > low := by
  simp [upperBiasedMid]; omega
```

通常の二分探索の `mid = (low + high) / 2` は、`low = high - 1` のとき
`mid = (2*low + 1) / 2 = low`（切り捨て）となり、`mid > low` を満たせません。

上側バイアス式 `(low + high + 1) / 2` は常に `low < mid ≤ high` を保証します。
`omega` は Lean 4 の自然数算術を自動証明するタクティクで、
`simp` で定義を展開した後 `omega` が不等式の正しさを機械的に確認します。
結果として二分探索が必ず収束することが定理として保証されます。

---

### Q33. Pseudonymize の「旧実装の衝突存在」とは何か？

**A:**
仮名化（Pseudonymize）とはユーザーIDなどの識別情報を可逆性のないハッシュに置き換える処理です。
旧実装ではSHA-256のみを使っており、異なるユーザーIDが同一のハッシュ値を生成する
衝突（collision）の可能性が理論上存在しました。

Leanで「旧実装には衝突となる入力ペアが存在する」（単射でない）という命題を証明し、
その後HMAC-SHA256（秘密鍵付きハッシュ）に切り替えることで単射性（異なる入力→異なる出力）を保証しました。

これはセキュリティ上の根拠があり、「SHA-256単体より安全」という定性的な説明ではなく、
「旧実装に具体的な問題が存在する」という数学的証明に基づいた設計変更です。

---

### Q34. ContextUtils のスコア単調性とは何を意味するのか？

**A:**
単調性とは「サボれる条件が増えるほど、スコアが増加する（または同値を保つ）」という性質です。
数式で書くと `signal_A ≤ signal_B → score(A) ≤ score(B)` です。

なぜ重要かというと、単調性が崩れると以下のような逆転が起きます：
- 「依頼者がオフライン かつ 締切が3日後」→ スコア高（サボれる）
- 「依頼者がオフライン かつ 締切が3日後 かつ リマインドなし」→ スコアが下がる（誤り）

条件を追加するほどサボれる度が下がる、という不整合はユーザーの信頼を失います。
Leanで単調性を証明することでスコアリングの整合性を数学的に担保しています。

---

### Q35. 形式検証はAI-DLCのどのステージで実施したのか？誰が書いたのか？

**A:**
Inception の Application Design 完了後、Construction の Code Generation 開始前に実施しました。
つまり「設計書→Lean証明→実装コード」という順番を徹底しています。

Lean コードの初稿はAI（Claude）が生成しましたが、人間が定理の意味を確認し、
証明の前提条件（`h : low < high` など）が実装の実際の呼び出し条件と一致しているかを検証しました。
この「AIが書いて人間が確認する」フローを担う専用スキルとサブエージェントをAI-DLCの拡張として自作しています。

---

### Q36. Lean を書けるメンバーがチームにいるのか？学習コストは？

**A:**
ハッカソン前にLeanの経験があったメンバーはいませんでした。
今回証明した3つのロジックはいずれも算術・論理的な性質のものであり、
Lean 4の `omega`・`simp`・`decide` の3タクティクでほぼカバーできます。

AIを活用して「証明したい命題を自然言語で記述→Lean コードを生成→型検査で正誤確認」
というループを回すことで、Lean未経験者でも実装前に形式検証を組み込めることを今回実証しました。
学習時間は各ロジック2〜3時間程度です。

---

### Q37. 形式検証を3つのロジックだけにした理由は？他にも怪しいロジックがあるのでは？

**A:**
「証明しなければ怖い」という基準で選定しています。

3つを選んだ根拠：
- GuardTokenLimit: 無限ループはLambdaのタイムアウトとコスト爆発に直結する
- Pseudonymize: 衝突が起きると異なるユーザーのデータが同一視される（セキュリティ問題）
- ContextUtils: スコアの逆転はサボり判定の信頼性を根本から壊す

他のロジック（API認証・DynamoDB操作など）はAWS SDKのマネージド保証・テストカバレッジ・
cdk-nagによるIaC検証で十分にカバーできると判断しています。
形式検証はコストが高いので「これだけは証明が必要」な箇所に限定するのが現実的です。

---

### Q38. 形式証明したからといって、実装コードが正しいとは限らないのでは？

**A:**
正確な指摘です。Leanで証明するのは「数学的モデル上での性質」であり、
TypeScriptの実装コードが同じ性質を持つことは別途確認が必要です。

対処は2段階で行っています：
1. Lean の定義と TypeScript の実装を 1対1 で対応させ、アルゴリズムの構造を同一にする
2. 実装コードに対して証明した境界値・性質を必ずカバーするユニットテストを追加する

形式証明はテストの「設計根拠」として機能し、どの境界値をテストすべきかを明確にします。
証明とテストの二重構造により「モデルの正しさ」と「実装の正しさ」の両方を担保しています。

---

### Q39. スライドの Lean コードは TypeScript の実装コードと本当に対応しているのか？

**A:**
1対1で対応しています。`guardTokenLimit.ts` の二分探索のミッド計算が、Lean 定義と完全に一致します。

```typescript
// TypeScript (pkgs/shared/src/utils/guardTokenLimit.ts:66)
const mid = Math.floor((low + high + 1) / 2);
```

```lean
-- Lean 4 定義
def upperBiasedMid (low high : Nat) :=
  (low + high + 1) / 2   -- Nat の除算は自動的に floor
```

`Nat` の除算は切り捨てなので、`Math.floor(...)` と完全に同義です。
定理 `upperBiasedMid_gt_low` が `low < high → mid > low` を証明しているため、
TypeScript の `while (low < high)` ループは必ず収束します。

証明との対応を確認するために `low = high - 1`（最悪ケース）のユニットテストも追加しており、
「証明が保証するケース」を実装側でも明示的に通過させています。

---

### Q40. Pseudonymize の「ソルト境界消失」とはどういう脆弱性か？実証コードはあるのか？

**A:**
`SHA256(salt + name)` の素朴な結合では、文字列の結合位置が区別されません。

```
SHA256("abc" + "def") = SHA256("abcd" + "ef")
  → どちらも SHA256("abcdef") と同じ入力 → 同一ハッシュ → 衝突！
```

つまり `salt="abc"`, `name="def"` と `salt="abcd"`, `name="ef"` が同一のハッシュになります。
これはユーザーIDの仮名化で「別ユーザーが同一ハッシュを持つ」という事態を招きます。

`pseudonymize.test.ts` の「HMAC collision prevention」テストがこのケースを直接検証しています：

```typescript
// salt="abc_valid_salt_16", name="def" のハッシュ
process.env["PSEUDONYMIZE_SALT"] = "abc_valid_salt_16";
const hash1 = pseudonymize("def");

// salt="abcd_valid_salt_1", name="ef" のハッシュ
process.env["PSEUDONYMIZE_SALT"] = "abcd_valid_salt_1";
const hash2 = pseudonymize("ef");

expect(hash1).not.toBe(hash2); // HMAC なら必ず異なる
```

HMAC-SHA256 はソルトをキー（鍵）として扱うため、結合ではなく別の演算が行われ、この脆弱性が原理的に発生しません。Lean では「旧実装にはこの衝突ペアが存在する（= 単射でない）」という命題を証明してから実装変更を決定しています。

---

### Q41. 形式検証専用の SKILL とサブエージェントはどう自作したのか？

**A:**
`lean-formal-verification` という独自 SKILL を `.claude/skills/` 配下に作成し、
AI-DLC の Construction フェーズに組み込みました。

SKILL の役割は3段階です：

| ステップ | 内容 |
|---------|------|
| 1. 証明対象の識別 | Application Design 完了後、「テストでは証明できない性質」を持つロジックをリストアップ |
| 2. Lean 定理の生成 | Claude が Lean 4 の定理コードを生成し、型検査（`lean --check`）でエラーがないことを確認 |
| 3. 実装との対応検証 | Lean の定義と TypeScript 実装を並べ、アルゴリズム構造が一致しているかを人間がレビュー |

サブエージェントとして動作させることで、メインの Construction コンテキストを圧迫せず、
「Lean 証明に集中した独立コンテキスト」で証明作業を完結させています。
証明完了後にサマリーを Construction フェーズに戻し、Code Generation Plan に反映する設計です。

---

### Q42. Lean 証明で失敗・修正したことはあったか？

**A:**
GuardTokenLimit で1回、証明が失敗しています。

最初の定理は通常の下側バイアス式を前提に書いていました：

```lean
-- 最初の（失敗した）試み
def biasedMid (low high : Nat) := (low + high) / 2
theorem biasedMid_gt_low (h : low < high) :
    biasedMid low high > low := by
  simp [biasedMid]; omega  -- ❌ omega が証明できない
```

`omega` が反例として `low=0, high=1` を見つけ、`(0+1)/2=0` で `0 > 0` が偽と判断しました。
この失敗が「上側バイアス式 `(low + high + 1) / 2` に変更する」という設計変更を引き出しています。

Lean の証明失敗がバグの発見につながった実例であり、
「AIが設計したロジックに数学的な穴があった」ことを形式検証が具体的に指摘した瞬間です。

---

### Q43. ContextUtils の単調性はどのような Lean 定理として書いたのか？

**A:**
`externalPressureLevel` の判定ロジックを例に取ると、以下のような形式になります。

```lean
-- 圧力レベルの順序付け (high > low > unknown)
def pressureOrder : String → Nat
  | "high"    => 2
  | "low"     => 1
  | _         => 0

-- SDT シグナル: reminderCount が増えるほど pressureLevel は単調非減少
theorem pressure_monotone
    (r1 r2 : Nat) (h : r1 ≤ r2) :
    pressureOrder (sdtPressure r1) ≤ pressureOrder (sdtPressure r2) := by
  simp [sdtPressure, pressureOrder]; omega
```

実装の `derivePsychSignals()` では `reminderCount >= 2` をしきい値として
`"high"` / `"low"` を返します。Lean ではこのしきい値設計が
「より多くのリマインドを受け取るほど pressure スコアが下がらない」ことを
全自然数の範囲で保証することを証明しています。

これにより「リマインド3回→サボれる」という逆転バグを数学的に排除しています。

---

## 補足: 審査員が詰めてくるポイント TOP 5

| 優先度 | 質問の核心 | 一言回答 |
|--------|-----------|---------|
| ★★★★★ | 「ダメになる」メカニズムの具体性 | 4能力の退化プロセスを二重設計で説明する |
| ★★★★☆ | Bedrock Tool Use の設計意図 | 「出力を保証する」＝ユーザーへの説明責任 |
| ★★★★☆ | テスト1,322件の内訳と品質保証 | パッケージ別内訳と cdk-nag 0件を示す |
| ★★★★☆ | 形式検証：テストで十分では？ | 「全入力での正しさ」はテストでは保証できない |
| ★★★☆☆ | プライバシー・データ保持の正確な説明 | 「生データ非永続化・構造化データTTL 30日」 |
| ★★★☆☆ | AI-DLCで何が変わったか | 設計書→Lean証明→実装の順番を人間が制御した |
