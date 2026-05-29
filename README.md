# SABOROU（サボロー） - 何んだって先延ばしにできるサービス

![](./docs/imgs/banner.svg)

## Live Demo

[https://saborou.agentic-jp.com/](https://saborou.agentic-jp.com/)

## 概要

**何をするアプリか**

Slack やメール、カレンダーなど外部サービスからタスクを取り込み、チャットの流れ・未返信・予定の前後といった**文脈ごと**に、AI が「いまどうサボるのが一番うまいか」を根拠付きで提案します。増やすのではなく、**いま手を離してよい線引き**を見つけるためのエージェントです。

さらに、タスクを AI が作業ステップに分解し、Google Calendar の空き時間を自動検出して**3バンドガント（作業 / 意思決定 / さぼろう）**でスケジューリング。「いつサボれるか」まで根拠付きで示します。

**想定ユーザー**

AI でこなせる仕事が増えた結果、**逆にタスクの絶対量が増え続けている社会人**。効率化の先に「やる量のインフレ」が来ている人を想定しています。

| Before | After |
| :--- | :--- |
| AI で仕事は速くなったが、処理できる量が増えたぶんタスクが積み上がり、常に「足りない」の感覚が続く。 | 締切・関係者・リマインドの状況などを踏まえ、**いまサボってよいか**／**最低限どこまでやれば十分か**を判断できる。判断の材料が外から揃う。 |

**表向きの目標**

タスクに追われる人の**心に余白**をつくること。「全部やる」ではなく、「いまはここまででいい」の許可を、根拠とセットで渡す。

**裏設定（人をダメにする能力）**

タスク整理・優先順位づけ・危機管理・締切感覚を、**AI に委ねる前提**で設計しています。楽になるほど、自分の頭での線引きは鈍る——そのトレードオフをコンセプトの核に置いています（詳細は下記「サービスコンセプト」および要件資料）。


## サービスコンセプト

**ーー何んだって先延ばしにできるサービスーー**

外部ツール文脈をもとに 心理学のノウハウを組み込んだ AI Agent が根拠付きで提案するプロダクトです。

| 観点 | 従来のタスク管理 | SABOROU |
|---|---|---|
| 基本発想 | やることを増やして管理する | やらなくていいことを見極める |
| 判断主体 | ユーザーの主観と経験 | 外部文脈 + AI の根拠提示 |
| 心理的負荷 | 常に「本当に後回しでいいか」で消耗 | 「今は寝かせてOK」の許可で余白を作る |
| 裏設定（人をダメにする） | 自力で判断し続ける | 判断を AI に委ね、整理力・優先順位判断・危機管理感覚が徐々に退化 |

📖 **詳細資料**:
- [`aidlc-docs/inception/requirements/requirements.md`](./aidlc-docs/inception/requirements/requirements.md)
	- プロダクト本質・ダメになる4能力の具体例
- [`aidlc-inputs/00-business-brief.md`](./aidlc-inputs/00-business-brief.md)
	- 事業仕様・コンセプト原典

---

## 画面モックアップ

<table>
  <tr>
	<td align="center">
	  <img width="280" src="aidlc-inputs/ui/saborou_v2_02-tasklist.png" alt="タスク一覧画面" />
	  <br />
	  タスク一覧（1行サボり判定サマリ）
	</td>
	<td align="center">
	  <img width="280" src="aidlc-inputs/ui/saborou_v2_03-detail.png" alt="タスク詳細・チャット画面" />
	  <br />
	  タスク詳細（判断材料 + サボローチャット）
	</td>
	<td align="center">
	  <img width="280" src="aidlc-inputs/ui/saborou_v2_04-settings.png" alt="連携設定画面" />
	  <br />
	  設定（Slack / Gmail / Calendar 連携）
	</td>
  </tr>
</table>

補足モック:
- `aidlc-inputs/mockups/01-task-list.png`
- `aidlc-inputs/mockups/02-task-detail-chat.png`

📖 **詳細資料**:
- 全画面UI（Pencil原本）: [`aidlc-inputs/ui/`](./aidlc-inputs/ui/)（`saborou_v2_01-login.png` / `saborou_v2_02-tasklist.png` / `saborou_v2_03-detail.png` / `saborou_v2_04-settings.png` / `ui_design.pen`）
- 各画面の対応ストーリー・受入基準: [`aidlc-docs/inception/user-stories/stories.md`](./aidlc-docs/inception/user-stories/stories.md) US-04〜US-17

---

## ターゲットユーザー

**プライマリペルソナ: 田中 ユカ（34歳 / フリーランスデザイナー）**

| 項目 | 内容 |
|---|---|
| 稼働状況 | 常時 3〜5 社と並行、1日 10〜20 件のタスク |
| 使用ツール | Slack（常時）、Gmail（1日3〜4回）、Google Calendar（朝昼確認） |
| 根本課題 | 「今サボっていいのか」の判断基準がなく、判断疲れが蓄積 |
| 欲しい価値 | 「後回しにしていい」ことを、根拠付きで許可してほしい |

1日の典型:
- 07:30 通知確認でため息
- 10:00 優先順位の判断で手が止まる
- 15:30 「後でいいか」の確信が持てず消耗
- 22:00 仕事後も Slack を確認してしまう

> 「『このタスク、今日中じゃなくていいよ』って誰かに言ってほしかっただけなんだよね。それを、ちゃんと理由と一緒に。」

📖 **詳細資料**:
- ペルソナ完全版（1日のルーティン・心理状態・課題5点・心の声）: [`aidlc-docs/inception/user-stories/personas.md`](./aidlc-docs/inception/user-stories/personas.md)
- ターゲット定義の根拠（Q16=B 副業・フリーランサー）: [`aidlc-docs/inception/requirements/requirements.md`](./aidlc-docs/inception/requirements/requirements.md) §1.2

---

## コアロジック

SABOROU の中核は、**サボり判定エンジン**と**スケジュール自動生成エンジン**の2本柱です。

### 1) サボり判定 — 3フェーズ判定フロー

```mermaid
graph TD
	P1[Phase 1: ContextCollector<br/>Slack/Gmail/Calendar文脈収集] --> P2[Phase 2: Bedrock Tool Use<br/>sabori_judgment構造化出力<br/>Claude Sonnet 4.6]
	P2 --> P3[Phase 3: PersonaRenderer<br/>ペルソナ口調へ変換<br/>Claude Haiku 4.5]
	P3 --> OUT[Proposal出力<br/>verdict + reasoning + chatMessage]
```

### 2) スケジュール自動生成 — SchedulePlannerAgent (AG-03)

```mermaid
graph TD
	S1[タスク詳細 + 締切] --> S2[Bedrock Tool Use<br/>作業ステップ分解<br/>Claude Sonnet 4.6]
	S2 --> S3[Google Calendar<br/>Busy Slot 取得]
	S3 --> S4[saboruBlockCalc<br/>決定論的スケジューリング]
	S4 --> S5[3バンドガント<br/>作業 / 意思決定 / さぼろう]
```

- タスク締切から逆算し、Google Calendar の予定を避けてステップを配置
- 他タスクの「意思決定時刻（decisionAt）」もbusyスロットとして相互反映
- 「さぼろう」帯は確保された自由時間として可視化
- スケジュールは揮発データ（DynamoDB 非永続・PII保護）、ガント編集結果は `plannedSteps` として永続化

### 3) 心理学研究の組み込み（サボり判定への応用）

SABOROU は以下 5 理論を `ContextSignals` にマッピングし、LLM 判定に入力します。

| 理論 | 主著 | シグナル対応 | 判定への使い方 |
|---|---|---|---|
| Collective Effort Model | Karau & Williams (1993) | `contextCoverage` | 文脈欠損や貢献可視性の低さを評価 |
| Identifiability | Williams et al. (1981) | `requesterActiveStatus`, `hasReminder` | 依頼者に見られている度合いを評価 |
| Sucker Effect | Kerr (1983) | `requesterActiveStatus` | 「自分だけ損する」状況を評価 |
| Self-Determination Theory | Ryan & Deci (2000) | `reminderCount`, `urgencyLevel` | 外発的プレッシャー強度を評価 |
| Expectancy Theory | Vroom (1964) | `deadlineMinutes`, `contextCoverage` | 今努力する期待値を評価 |

### 4) ゲーミフィケーション — AI依存度スコアと称号システム

「人をダメにする」をゲームループとして昇華した**AI依存度スコア（0〜100）**を実装しています。

| スコア帯 | 称号 | テーマ |
|---|---|---|
| 0〜20 | AI見習い | 水色 — AI提案に驚く段階 |
| 21〜40 | サボり常習者 | 黄色 — 提案パターンを学習し始める段階 |
| 41〜60 | 依存気味 | オレンジ — 自己判断が委縮し始める段階 |
| 61〜80 | AI奴隷 | 赤紫 — ほぼAIに従う段階 |
| 81〜100 | 存在する怠惰 | 金色（カオス演出）— 完全委譲の段階 |

**実装済みゲーミフィケーション要素:**
- 実績バッジ（COMMON / RARE / EPIC / LEGENDARY レアリティ付き）
- コンボカウンター（連続サボり成功数）
- ストリークバッジ（連日サボり継続）
- ウィークリーチャレンジカード
- シーズンバナー
- ジャックポットオーバーレイ（高得点時の演出）
- PvP・ギルド（モックUI / 将来機能）

### 5) マルチペルソナ — 同じ判定を、違う口調で

ユーザーが好みのAIペルソナを選択でき、サボり提案がそのキャラクター口調で生成されます。

### 6) サボり癖レポート（取扱説明書）

本音データの蓄積から、ユーザー自身の「サボりパターン」を分析・可視化。AI依存が深まるほどレポートが育つ仕様です。

<details>
<summary>心理学理論の詳細（DOI付き）</summary>

| # | フレームワーク | 出典 |
|---|---|---|
| 1 | CEM | Karau & Williams, 1993, https://doi.org/10.1037/0022-3514.65.4.681 |
| 2 | Identifiability | Williams et al., 1981, https://doi.org/10.1037/0022-3514.40.2.303 |
| 3 | Sucker Effect | Kerr, 1983, https://doi.org/10.1037/0022-3514.45.4.819 |
| 4 | SDT | Ryan & Deci, 2000, https://doi.org/10.1037/0003-066X.55.1.68 |
| 5 | Expectancy Theory | Vroom, 1964, *Work and Motivation* |

</details>

📖 **詳細資料**:
- 3フェーズ判定フロー詳細: [`aidlc-docs/inception/application-design/application-design.md`](./aidlc-docs/inception/application-design/application-design.md) 7.2（サボり提案生成シーケンス図）
- サボり判定3状態・判定ロジック・next_check_at計算ルール: 同 8.1〜8.4
- SaboriProposerAgent 実装メソッド・心理学フレームワーク実装マッピング: [`aidlc-docs/inception/application-design/component-methods/AG-02-sabori-proposer-agent.md`](./aidlc-docs/inception/application-design/component-methods/AG-02-sabori-proposer-agent.md)
- 心理学根拠の要約（DOI付き）: [`requirements.md`](./aidlc-docs/inception/requirements/requirements.md) 1.1.2

---

## 機能一覧

| 要件ID | 機能 | 優先度 | 連携/依存 | デモ対象 |
|---|---|---|---|---|
| FR-01 | 外部サービス連携・タスク自動抽出 | MUST | Slack Webhook / EventBridge | Yes |
| FR-02 | タスク候補の承認・編集・削除 | MUST | DynamoDB TaskCandidates/Tasks | Yes |
| FR-03 | 文脈読解・サボり提案生成（SSEストリーム） | MUST | Bedrock Claude Sonnet 4.6 / Claude Haiku 4.5 | Yes |
| FR-04 | サボり提案のリアルタイム更新 | MUST | On-demand + EventBridge Scheduler | Yes |
| FR-05 | 本音データ収集・サボり癖レポート | MUST | DynamoDB HonneData → ManualPage分析 | Yes |
| FR-06 | タスク一覧の1行サマリ表示 | MUST | Proposal summaryText | Yes |
| FR-07 | 認証・外部連携管理 | MUST | Cognito + Google OAuth + Secrets Manager | Yes |
| FR-08 | 手動タスク追加 | SHOULD | Hono API + DynamoDB | Optional |
| FR-09 | 作業ステップ分解 + 3バンドガントスケジュール | MUST | SchedulePlannerAgent + Google Calendar | Yes |
| FR-10 | マルチペルソナ選択 | MUST | PersonaRenderer + DynamoDB Personas | Yes |
| FR-11 | AI依存度ゲーミフィケーション | MUST | 称号・実績・ストリーク・コンボ | Yes |
| FR-12 | PWA対応（インストール可能） | SHOULD | vite-plugin-pwa + Workbox | Yes |
| FR-13 | 日英多言語対応 | SHOULD | i18next / react-i18next | Yes |

📖 **詳細資料**:
- FR-01〜FR-08 の完全仕様（受入基準・根拠Q番号）: [`requirements.md`](./aidlc-docs/inception/requirements/requirements.md) §3
- NFR-01〜NFR-11: 同 §4
- 機能別ユーザーストーリー（Epic E-01〜E-05 / US-01〜17）: [`stories.md`](./aidlc-docs/inception/user-stories/stories.md)
- 5分デモシナリオ（審査員向け時系列）: [`demo-stories.md`](./aidlc-docs/inception/user-stories/demo-stories.md)
- 将来展望（MVPスコープ外）: [`future-stories.md`](./aidlc-docs/inception/user-stories/future-stories.md)

---

## ユーザーストーリー処理シーケンス図

```mermaid
sequenceDiagram
	participant U as User
	participant FE as Web Frontend (React 19 / PWA)
	participant API as Hono API
	participant WH as WebhookHandler
	participant TE as TaskExtractorAgent
	participant SP as SaboriProposerAgent
	participant SCH as SchedulePlannerAgent
	participant DB as DynamoDB (8テーブル)
	participant BR as Amazon Bedrock
	participant GC as Google Calendar API

	WH->>TE: Slack イベント転送 (EventBridge)
	TE->>BR: タスク候補抽出（Claude Sonnet 4.6）
	BR-->>TE: TaskCandidate
	TE->>DB: TaskCandidates 保存

	U->>FE: タスク候補を承認
	FE->>API: POST /api/tasks/candidates/:id/approve
	API->>DB: Tasks 保存

	U->>FE: タスク詳細を開く（サボり提案）
	FE->>API: GET /api/tasks/:id/proposal?stream=true
	API->>SP: proposeStream(taskId)
	SP->>BR: 文脈読解 + 判定（Claude Sonnet 4.6）
	BR-->>SP: verdict/reasoning/summary
	SP->>BR: 口調変換（Claude Haiku 4.5）
	BR-->>SP: chatMessage（ペルソナ口調）
	SP->>DB: Proposals 保存
	API-->>FE: SSE delta 配信
	FE-->>U: サボロー提案表示（ストリーミング）

	U->>FE: ガントスケジュールを確認
	FE->>API: GET /api/tasks/:id/schedule
	API->>GC: busy slot 取得（Google Calendar）
	GC-->>API: BusySlot[]
	API->>SCH: plan(task, busySlots)
	SCH->>BR: 作業ステップ分解（Claude Sonnet 4.6）
	BR-->>SCH: ScheduleStep[]
	SCH-->>API: SaboriSchedule（3バンドガント）
	API-->>FE: { schedule } (no-store)
	FE-->>U: 3バンドガント表示（編集可）

	U->>FE: 本音を返信
	FE->>API: POST /api/tasks/:id/honne
	API->>DB: HonneData 保存（AI依存度スコア更新）
```

📖 **詳細資料**:
- 全7シーケンス図（タスク抽出 / サボり提案 / 本音記録 / 再評価 / 認証 / 連携設定 / エラーハンドリング）: [`application-design.md`](./aidlc-docs/inception/application-design/application-design.md) §7.1〜7.7
- API エンドポイント仕様: 同 §6

---

## 画面構成（実装済みページ）

| ページ | パス | 説明 |
|---|---|---|
| ログイン | `/login` | Google OAuth（Cognito PKCE対応） |
| タスク一覧 | `/tasks` | 候補承認・1行サマリ・AI依存度スコア |
| タスク詳細 | `/tasks/:id` | サボり提案（SSEストリーム）+ 3バンドガント + 本音チャット |
| 設定 | `/settings` | Slack / Google Calendar 連携管理 |
| ペルソナ選択 | `/settings/persona` | AIキャラクター選択（口調変更） |
| 取扱説明書 | `/manual` | サボり癖レポート（本音データ傾向分析） |
| ロードマップ | `/roadmap` | プロダクトロードマップ（日英対応） |

---

## 使用AWSサービス一覧

| カテゴリ | サービス | 用途 | 選定理由 |
|---|---|---|---|
| フロント配信 | CloudFront | HTTPS終端 + CDN配信 + カスタムドメイン | 低遅延・グローバル配信 |
| フロント配信 | S3 | 静的アセットホスティング（PWA含む） | シンプル・低コスト |
| 認証 | Cognito User Pools | ユーザー認証 / Google IdP連携 / Passkey | OAuth実装をマネージド化 |
| API | API Gateway HTTP API | REST入口 + Authorizer | Lambda統合が容易 |
| コンピュート | Lambda | Hono API / Agent実行 / Webhook受信 | サーバーレスでコスト最適 |
| オーケストレーション | EventBridge | イベント中継（Slack→TaskExtractor） | 疎結合・拡張容易 |
| スケジューリング | EventBridge Scheduler | 再評価ジョブ定期実行 | 運用負荷が低い |
| キュー | SQS | TaskExtractor DLQ（障害時リトライ） | イベント損失防止 |
| AI | Amazon Bedrock | タスク抽出 / サボり判定 / スケジュール分解 / 口調変換 | クロスリージョン推論プロファイル活用 |
| データ | DynamoDB | タスク・提案・本音・ペルソナ・Calendarキャッシュ保存 | On-Demandでハッカソン向き |
| シークレット | Secrets Manager | OAuthトークン・署名鍵保管 | 秘密情報の安全管理 |
| パラメータ | SSM Parameter Store | 仮名化ソルト管理 | 軽量な設定値管理 |
| 証明書 | ACM | CloudFront・API Gateway カスタムドメイン用TLS | us-east-1 + ap-northeast-1 |
| 監視 | CloudWatch | ログ・メトリクス・アラート | AWS標準の監視基盤 |
| セキュリティ | cdk-nag | CDKデプロイ時のAWS Solutions Checks | セキュリティ品質担保 |

📖 **詳細資料**:
- AWS全体アーキテクチャ・セキュリティ境界・データフロー: [`aws-architecture.md`](./aidlc-docs/inception/application-design/aws-architecture.md)
- コスト見積り（月額$30.94・NFR-06達成）: 同 §6
- モニタリング・アラーム設計: 同 §7
- AWS制約（リージョン・サーバーレス方針）: [`.claude/rules/aws-constraints.md`](./.claude/rules/aws-constraints.md)
- アーキテクチャ方針: [`aidlc-inputs/03-aws-architecture-policy.md`](./aidlc-inputs/03-aws-architecture-policy.md)

---

## アーキテクチャ図

### 全体アーキテクチャ

```mermaid
graph TD
	subgraph External[外部サービス]
		Slack[Slack API]
		GCal[Google Calendar API]
		User[ユーザー]
	end

	subgraph Edge[エッジ層]
		CF[CloudFront + カスタムドメイン]
		S3[S3 / PWA]
	end

	subgraph Auth[認証]
		Cognito[Cognito / Google OAuth / Passkey]
	end

	subgraph API[API層]
		APIGW[API Gateway HTTP API]
		HonoLambda[Lambda: Hono API]
		WebhookLambda[Lambda: Webhook]
	end

	subgraph Agent[AIエージェント]
		TaskExtractor[TaskExtractorAgent<br/>Claude Sonnet 4.6]
		SaboriProposer[SaboriProposerAgent<br/>Sonnet 4.6 + Haiku 4.5]
		SchedulePlanner[SchedulePlannerAgent<br/>Claude Sonnet 4.6]
		Bedrock[Amazon Bedrock<br/>JP Cross-Region Inference]
	end

	subgraph Data[データ層]
		DDB[DynamoDB<br/>8テーブル]
		SM[Secrets Manager]
		SSM[SSM Parameter Store]
	end

	subgraph Orchestration[オーケストレーション]
		EB[EventBridge]
		EBScheduler[EventBridge Scheduler]
		DLQ[SQS DLQ]
	end

	User --> CF
	CF --> S3
	CF --> APIGW
	APIGW --> HonoLambda
	HonoLambda --> SaboriProposer
	HonoLambda --> SchedulePlanner
	SaboriProposer --> Bedrock
	SchedulePlanner --> Bedrock
	SchedulePlanner --> GCal
	HonoLambda <--> DDB
	HonoLambda --> SM

	Slack --> WebhookLambda
	WebhookLambda --> EB
	EB --> TaskExtractor
	TaskExtractor --> Bedrock
	TaskExtractor --> DDB
	TaskExtractor -.-> DLQ

	EBScheduler --> SaboriProposer
	Cognito --> APIGW
```

### DynamoDB テーブル構成（8テーブル）

| テーブル名 | 用途 | 特記事項 |
|---|---|---|
| saborou-users | ユーザー情報・ペルソナ設定 | |
| saborou-service-connections | 外部サービス連携状態 | |
| saborou-task-candidates | Slack/Gmail 抽出タスク候補 | TTL付き（承認待ち失効） |
| saborou-tasks | 承認済みタスク・plannedSteps | ガント編集結果を永続化 |
| saborou-proposals | サボり提案キャッシュ | nextCheckAt で再生成判定 |
| saborou-honne-data | 本音データ・クイックリプライ履歴 | AI依存度スコア計算元 |
| saborou-personas | AIペルソナ定義 | |
| saborou-google-calendar-cache | Google Calendar取得キャッシュ | TTL=24h / PII保護 |

### CDK スタック構成（8スタック）

```mermaid
graph LR
	ACM[AcmUsEast1Stack<br/>us-east-1 証明書] --> FE
	FE[FrontendStack<br/>S3 + CloudFront] --> Cognito
	Cognito[CognitoStack<br/>ユーザープール] --> Api
	Data[DataStack<br/>DynamoDB + Secrets] --> Api
	Api[ApiStack<br/>API GW + Lambda] --> Agent
	Agent[AgentStack<br/>TaskExtractor + SaboriProposer + SchedulePlanner] --> Webhook
	Data --> Webhook
	Webhook[WebhookStack<br/>Slack + EventBridge + SQS]
	Api --> Config
	FE --> Config
	Cognito --> Config
	Config[ConfigDeployStack<br/>env-config.json → S3]
```

📖 **詳細資料**:
- コンポーネント詳細（FE-01〜08 / BE-01〜06 / AG-01〜04 / INF-01〜06）: [`application-design.md`](./aidlc-docs/inception/application-design/application-design.md) §4
- 各コンポーネントのメソッド定義: [`component-methods/`](./aidlc-docs/inception/application-design/component-methods/)
- コンポーネント依存関係図: [`component-dependency.md`](./aidlc-docs/inception/application-design/component-dependency.md)
- Unit of Work（U-01〜U-05）と実装スケジュール: [`unit-of-work.md`](./aidlc-docs/inception/units/unit-of-work.md)

---

## 技術スタック (Tech Stack)

### フロントエンド

| 技術 | バージョン | 用途 |
|---|---|---|
| React | 19 | UIフレームワーク |
| TypeScript | 6.0 | 型安全 |
| Vite | 8 | ビルドツール / Dev Server |
| Tailwind CSS | 4 | スタイリング |
| shadcn/ui（カスタム実装） | — | UIコンポーネント（button / card / badge 等） |
| Three.js + @react-three/fiber + drei | 0.177 / 9.6 / 10.7 | 3Dキャラクター（SaborouCharacter3D） |
| i18next + react-i18next | 25.6 / 16.2 | 日英多言語対応 |
| Vercel AI SDK (`ai`) | 4.3 | サボローチャット SSEストリーミング（useChat） |
| react-router-dom | 7.6 | SPA ルーティング |
| vite-plugin-pwa + workbox-window | 1.3 / 7.4 | PWA対応（インストール可能） |
| amazon-cognito-identity-js | 6.3 | Cognito PKCE認証 |

### バックエンド

| 技術 | バージョン | 用途 |
|---|---|---|
| Hono | 4.12 | APIフレームワーク（Lambda上） |
| TypeScript | 5.7 | 型安全 |
| Zod | 3.25 | スキーマバリデーション |
| esbuild | 0.21 | Lambda向けバンドル |
| @hono/zod-validator | 0.4 | リクエストバリデーション |
| @hono/swagger-ui | 0.6 | Swagger UI（ローカル開発） |

### AIエージェント

| 技術 | バージョン | 用途 |
|---|---|---|
| @aws-sdk/client-bedrock-runtime | 3.826 | Bedrock converse / Tool Use |
| Claude Sonnet 4.6（JP推論プロファイル） | jp.anthropic.claude-sonnet-4-6 | タスク抽出・サボり判定・スケジュール分解 |
| Claude Haiku 4.5（JP推論プロファイル） | jp.anthropic.claude-haiku-4-5-20251001-v1:0 | ペルソナ口調変換（コスト最適化） |
| Zod | 3.23 | LLM出力バリデーション |

### インフラ・共通

| 技術 | バージョン | 用途 |
|---|---|---|
| AWS CDK v2 | 2.x | IaC（TypeScript） |
| cdk-nag | — | AWS Solutions Checks（セキュリティ準拠） |
| pnpm workspaces | — | モノレポ管理 |
| Biome | — | Linter / Formatter |
| Vitest | 4.x (frontend) / 2.x (agent/shared) | ユニットテスト |
| Playwright | 1.60 | E2Eテスト |

- リージョン: `ap-northeast-1`（東京）、Bedrock クロスリージョン推論で AP全域を活用
- 認証: Cognito（Google OAuth PKCE + HMAC-SHA256署名付きOAuth State CSRF対策）

📖 **詳細資料**:
- 確定済み技術スタック（フロント/バック/AWS/開発ツールチェーン）: [`requirements.md`](./aidlc-docs/inception/requirements/requirements.md) §6.1〜6.5
- 技術選定の意思決定記録: [`aidlc-inputs/01-tech-stack-decisions.md`](./aidlc-inputs/01-tech-stack-decisions.md)
- 開発方針（TDD・TypeScript統一・Biome）: [`aidlc-inputs/02-development-policy.md`](./aidlc-inputs/02-development-policy.md)

---

## AI-DLC ワークフロー成果物

本プロジェクトは [AI-DLC（AI Driven Development Life Cycle）](./AGENTS.md) に準拠して開発しています。Inceptionフェーズの全成果物は以下に格納されています。

| ステージ | 成果物 | パス |
|---|---|---|
| Requirements Analysis | 要件定義書（FR-01〜08 / NFR-01〜11） | [`aidlc-docs/inception/requirements/requirements.md`](./aidlc-docs/inception/requirements/requirements.md) |
| User Stories | Epic 5 / Story 17 + ペルソナ + デモシナリオ | [`aidlc-docs/inception/user-stories/`](./aidlc-docs/inception/user-stories/) |
| Workflow Planning | 実行計画 | [`aidlc-docs/inception/plans/execution-plan.md`](./aidlc-docs/inception/plans/execution-plan.md) |
| Application Design | アプリケーション設計書 + AWSアーキテクチャ + コンポーネント | [`aidlc-docs/inception/application-design/`](./aidlc-docs/inception/application-design/) |
| Units Generation | Unit of Work（U-01〜U-05） | [`aidlc-docs/inception/units/unit-of-work.md`](./aidlc-docs/inception/units/unit-of-work.md) |
| 状態管理 | ワークフロー状態 / 監査ログ / レビューレポート | [`aidlc-state.md`](./aidlc-docs/aidlc-state.md) / [`audit.md`](./aidlc-docs/audit.md) / [`review-report-20260510-final.md`](./aidlc-docs/review-report-20260510-final.md) |

## 動かし方(開発者向け)

### 共通

- 依存関係インストール

	```bash
	pnpm i
	```

- フォーマッター

	```bash
	pnpm run biome:format
	```

- Sharedコンポーネントのビルド

	> これを先に実行しないとフロントやバックエンドでビルドエラーになります。

	```bash
	pnpm shared run build
	```

### AI Agent

- ビルド

	```bash
	pnpm agent run build
	```

### CDK

- ビルド

	```bash
	pnpm cdk run build
	```

- テスト

	```bash
	pnpm cdk run test
	```

- flociのDockerコンテナ起動

	```bash
	pnpm cdk run floci:start
	```

	起動後に以下のコンテナが立ち上がっていればOK!
	
	```bash
	CONTAINER ID   IMAGE                COMMAND                  CREATED          STATUS                    PORTS                    NAMES
	ef3a29634d68   floci/floci:latest   "/usr/local/bin/dock…"   16 seconds ago   Up 16 seconds (healthy)   0.0.0.0:4566->4566/tcp   cdk-floci-1
	```

- flociのDockerコンテナ停止

	```bash
	docker compose down
	```

- flociへのCDKスタックデプロイ

	初回の場合は最初に `bootstrap`しておく必要あり。スクリプトは `AWS_S3_USE_PATH_STYLE=1` を自動設定するため、path-style S3 URL を使用する floci と CDK v2 の互換性問題を解消している。

	```bash
	pnpm cdk run floci:bootstrap
	```

	```bash
	# 1. フロントエンドビルド（先に実行）
	pnpm frontend run build   
	# 2. バックエンドビルド（先に実行）
  pnpm backend run build    
	pnpm cdk run floci:deploy
	```

- flociからのリソースをアンデプロイ

	```bash
	pnpm cdk run floci:destroy
	```

- AWSへデプロイ

	> 事前にAWSへのログインが必要

	```bash
	pnpm run deploy:all
	```

	その後SSMパラメータを作成する

	```bash
	aws ssm put-parameter \
	--name "/saborou/pseudonymize-salt-dev" \
	--value "$(openssl rand -hex 16)" \
	--type "String" \
	--region ap-northeast-1
	```

- AWSからリソースをアンデプロイ

	```bash
	pnpm cdk run destroy --all --force
	```

	> SSMやSecret Managerの一部の値は手動での削除が必要

### バックエンド

- ビルド

	```bash
	pnpm backend run build
	```

- テスト

	```bash
	pnpm backend run test
	```

- ローカルでのサーバー起動

	```bash
	pnpm backend run dev
	```

	起動後、 `http://localhost:3000`にてAPIが起動する

	また、`http://localhost:3000/ui`にてSwagger UIが起動するのでそこからもAPIのテストができる

### フロントエンド

- ビルド

	```bash
	pnpm frontend run build
	```

- テスト

	```bash
	pnpm frontend run test
	```

- E2Eテスト

	```bash
	pnpm frontend run e2e
	```

- ローカルでサーバー起動

	```bash
	pnpm frontend run dev
	```

- モックモードで起動（バックエンド不要）

	```bash
	pnpm frontend run dev:mock
	```
