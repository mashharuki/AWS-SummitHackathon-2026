# User Stories 質問ファイル

**プロジェクト名**: SABOROU  
**フェーズ**: INCEPTION - User Stories Part 1（Planning）  
**作成日**: 2026-05-09  
**目的**: ストーリー生成に必要な不明点・選択事項を確認する

---

以下の質問に回答してください。各質問の `[Answer]:` タグの後に選択肢のアルファベット（A/B/C 等）を記入してください。requirements.md で確定済みの事項は質問しません。

---

## Question 1
プライマリペルソナ「副業・フリーランサー」の代表的な年齢・職種の組み合わせとして、最もリアルに感じるものはどれですか？

A) 28歳・副業エンジニア（本業は会社員エンジニア）
B) 34歳・フリーランスデザイナー（複数クライアントと並行）
C) 26歳・フリーランスライター（企業ブログ / SNS運用等）
D) 年齢・職種は複数並列（ペルソナは1人に絞らず「副業・フリーランサー全般」として記述する）
E) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 2
プライマリペルソナが1日に抱えているタスク数（Slack / Gmail / Calendar 合計の把握タスク）は平均どのくらいをイメージしていますか？

A) 5〜10件（小規模・集中型）
B) 10〜20件（一般的な複数案件掛け持ち）
C) 20〜30件（かなりのタスク過多）
D) 件数は重要でない（「常にタスク過多」という感覚だけ記述すれば十分）
E) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 3
ストーリーの優先順位付けにおいて、書類審査（2026-05-10）までに必ず user-stories.md に含めるべき MUST ストーリーはどれですか？（複数選択可 — 選択したアルファベットをすべて記入）

A) FR-01: Slack Webhook によるタスク自動抽出（エージェント①コア）
B) FR-03: 文脈読解によるサボり提案生成（エージェント②コア）
C) FR-07: Cognito Google ログイン + 外部サービス連携管理
D) FR-02: タスク候補の承認・編集・削除フロー
E) FR-04: サボり提案のリアルタイム更新
F) FR-05: 本音データ収集（クイック返信・自由入力）
G) FR-06: タスク一覧の1行サボり判定サマリ表示
H) FR-08: 手動タスク追加（SHOULD）
I) Other (please describe after [Answer]: tag below)

[Answer]: A, B, C, D, E, F, G, H（記入漏れ修正：FR-02 も MUST に含める）

---

## Question 4
受入基準（Given-When-Then）の詳細度をどのレベルにしますか？

A) 高詳細: 画面名・ボタン名・DynamoDB テーブル名まで具体的に記述する（mockups と完全対応）
B) 中詳細: ユーザー操作と期待結果を記述するが、実装詳細（DB名等）は省略する
C) 低詳細: 「〜ができる」という一文で済ませる（開発者判断に委ねる）
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 5
Slack OAuth エラー時・Bedrock タイムアウト時などのエラーシナリオを、ユーザーストーリーとして独立して記述しますか？

A) 独立したストーリーとして記述する（例: 「Slack 連携が失敗したとき、私はエラー通知を受け取りたい」）
B) 対応する MUST ストーリーの受入基準（Given-When-Then）の一つとして組み込む
C) 書類審査向けのストーリーには含めない（エラー要件は requirements.md のみで十分）
D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 6
5分デモシナリオ（requirements.md §5.2）における「花形ストーリー」を user-stories.md の先頭またはハイライトとして明示しますか？

A) 明示する: stories.md の最初に「デモ花形ストーリー」セクションを設けて 1〜2 件を抜粋する
B) 明示しない: Epic 順で通常通り並べる（審査員は読めば分かる）
C) 別ファイル（demo-stories.md 等）として分離する
D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 7
「将来展望ストーリー」（取扱説明書・複数人格・SNS 機能）を user-stories.md に含めますか？

A) 含める: 「参考付録」セクションとして E-05 を stories.md 末尾に追加する
B) 含めない: MVP スコープ外なので stories.md には記載しない（requirements.md の将来展望記述で十分）
C) 別ファイル（future-stories.md 等）として分離し、stories.md からリンクする
D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 8
FR-08「手動タスク追加」（優先度 SHOULD）はユーザーストーリーに含めますか？

A) 含める: mockups に + ボタンが存在するため、審査員に説明できるよう SHOULD ストーリーとして記述する
B) 含めない: 書類審査の優先度的に MUST のみに絞る
C) 含めるが最後尾に配置し、SHOULD であることを明記する
D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 9
ペルソナ B（ハッカソン審査員・テッキーな早期採用者）向けのストーリーを別途記述しますか？

A) 記述する: 審査員がどのようにデモを体験するかをペルソナ B のストーリーとして書く
B) 記述しない: ペルソナ A（エンドユーザー）のストーリーのみで十分。審査員向けはデモシナリオ（requirements.md §5.2）が担う
C) ペルソナ B は personas.md に定義するが、stories.md のストーリーはペルソナ A に絞る
D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 10
「サボり判定」の状態（サボれる / 注意 / 危ない）をユーザーストーリーでどのように扱いますか？

A) 3状態それぞれに個別のストーリーを書く（「危ない」ときユーザーが警告を受け取るストーリー等）
B) FR-03 の1つのストーリーの中で受入基準として3状態をカバーする
C) 「サボれる」状態のストーリーのみ書く（デモで見せる主要ケース）
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 11
personas.md に記載するペルソナの情報量はどのくらいにしますか？

A) 詳細: 名前・年齢・職業・1日のルーティン・ツール利用シーン・心理状態・課題・インサイトを全て記述する
B) 標準: 名前・職業・課題・インサイトを記述し、詳細属性は省略する
C) 最小限: 名前と主要な特徴を 2〜3 行で記述する
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 12
ストーリー文書（stories.md）の構成として好むものはどれですか？

A) Epic > Story の2階層構成（Epic ヘッダーの下にストーリーを列挙）
B) Epic > Story > Task の3階層構成（タスクも追加で記述）
C) 優先度別（MUST / SHOULD / COULD）に並べてから、その中で Epic 分類する
D) デモシナリオ順（5分デモのシーン順にストーリーを配置）
E) Other (please describe after [Answer]: tag below)

[Answer]: A

---

以上 12 問です。すべて回答したら「回答完了しました」とお伝えください。

---

**回答方法**: 各 `[Answer]:` タグの後に選択肢のアルファベット（A, B, C... ）を記入してください。複数選択が明記されている場合はカンマ区切りで記入してください（例: A, C, F）。選択肢に合うものがない場合は最後の選択肢（Other）を選び、`[Answer]:` の後に詳細を記入してください。
