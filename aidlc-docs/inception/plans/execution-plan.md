# 実行計画書 — SABOROU

**プロジェクト名**: SABOROU（サボロー）
**作成日**: 2026-05-09
**バージョン**: 2.0.0
**更新日**: 2026-05-16（予選向け全面改訂: 14日計画 / AgentCore廃止 / デプロイ計画追加 / Well-Architected評価 / Lean Verification）
**ステータス**: 確定（予選向け実行版）
**対象イベント**: AWS Summit Japan 2026 ハッカソン（予選: 2026-05-30）

---

## 1. Detailed Analysis Summary

### 1.1 Change Impact Assessment（変更影響評価）

本プロジェクトは Greenfield（新規開発）であるため、全領域に新規構築の影響がある。

| 影響領域 | 評価 | 詳細 |
|---------|------|------|
| **User-facing changes** | Yes（新規） | タスク一覧・タスク詳細・チャット・認証・連携設定の全画面を新規構築 |
| **Structural changes** | Yes（新規） | Dual-Agent 協調構成（エージェント①タスク抽出 / エージェント②サボり提案）を新規設計 |
| **Data model changes** | Yes（新規） | Tasks / Proposals / HonneData / Personas テーブル（DynamoDB）を新規設計 |
| **API changes** | Yes（新規） | REST API（Hono on Lambda + API Gateway HTTP API）を新規設計。Slack / Gmail / Google Calendar Webhook エンドポイントを含む |
| **NFR impact** | Yes（要設計） | NFR-01〜NFR-11: パフォーマンス・セキュリティ・コスト・モニタリングすべて設計対象 |

### 1.2 Risk Assessment（リスク評価）

**総合リスクレベル: Medium-High**

| リスク要因 | レベル | 詳細 |
|-----------|-------|------|
| **外部API 連携** | Medium | Slack OAuth / Bedrock converse API の認証・API連携が必須。v1.0.0 は Slack + Bedrock の2系統のみ。1つでも失敗するとコア機能が動作しない |
| **Bedrock converse API レイテンシ** | Medium | ap-northeast-1 での converse API レスポンスタイム。10秒SLO（NFR-01）を超えた場合の UI フォールバック設計が必要 |
| **マルチエージェント協調** | Medium | エージェント①→②のデータフロー設計・エラーハンドリングが複雑。DynamoDB を介した非同期連携の整合性確保が必要 |
| **ハッカソン時間制約** | High | 書類審査 2026-05-10（翌日）/ MVP デモ 2026-05-30（21日後）/ 決勝 2026-06-26（48日後）の3段階締切 |
| **Bedrock コスト超過** | Medium | 1リクエスト最大 8,000 トークン制限あり。トークン管理ロジックの実装が必須（NFR-06） |
| **データプライバシー** | Low-Medium | Slack/Gmail 本文の生データ不保持方針（NFR-07）の実装を全 Lambda で遵守する必要あり |

**ロールバック複雑度**: Moderate（サーバーレスのため差し替えは容易だが、DynamoDB スキーマ変更は慎重に対応）

**テスト複雑度**: Complex（外部 API モック / Bedrock 推論モック / EventBridge 統合テスト）

---

## 2. Workflow Visualization

### 2.1 Mermaid フローチャート

```mermaid
flowchart TD
    Start(["ユーザーリクエスト"])

    subgraph INCEPTION["INCEPTION フェーズ"]
        WD["Workspace Detection<br/><b>COMPLETED</b>"]
        RE["Reverse Engineering<br/><b>SKIPPED</b><br/>Greenfield のため不要"]
        RA["Requirements Analysis<br/><b>COMPLETED</b>"]
        US["User Stories<br/><b>COMPLETED</b>"]
        WP["Workflow Planning<br/><b>IN PROGRESS</b>"]
        AD["Application Design<br/><b>EXECUTE</b>"]
        UG["Units Generation<br/><b>EXECUTE</b>"]
    end

    subgraph CONSTRUCTION["CONSTRUCTION フェーズ（Unit ループ）"]
        FD["Functional Design<br/><b>EXECUTE</b><br/>各 Unit"]
        NFRA["NFR Requirements<br/><b>EXECUTE</b><br/>各 Unit"]
        NFRD["NFR Design<br/><b>EXECUTE</b><br/>各 Unit"]
        ID["Infrastructure Design<br/><b>EXECUTE</b><br/>各 Unit"]
        CG["Code Generation<br/><b>EXECUTE</b><br/>各 Unit（必須）"]
        BT["Build and Test<br/><b>EXECUTE</b><br/>全 Unit 完了後（必須）"]
    end

    subgraph OPERATIONS["OPERATIONS フェーズ"]
        OPS["Operations<br/><b>PLACEHOLDER</b>"]
    end

    Start --> WD
    WD --> RE
    RE --> RA
    RA --> US
    US --> WP
    WP --> AD
    AD --> UG
    UG --> FD
    FD --> NFRA
    NFRA --> NFRD
    NFRD --> ID
    ID --> CG
    CG --> BT
    BT --> OPS
    OPS --> End(["完了"])

    style Start fill:#CE93D8,stroke:#6A1B9A,stroke-width:3px,color:#000
    style End fill:#CE93D8,stroke:#6A1B9A,stroke-width:3px,color:#000
    style WD fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    style RE fill:#BDBDBD,stroke:#424242,stroke-width:2px,stroke-dasharray: 5 5,color:#000
    style RA fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    style US fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    style WP fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    style AD fill:#FFA726,stroke:#E65100,stroke-width:3px,stroke-dasharray: 5 5,color:#000
    style UG fill:#FFA726,stroke:#E65100,stroke-width:3px,stroke-dasharray: 5 5,color:#000
    style FD fill:#FFA726,stroke:#E65100,stroke-width:3px,stroke-dasharray: 5 5,color:#000
    style NFRA fill:#FFA726,stroke:#E65100,stroke-width:3px,stroke-dasharray: 5 5,color:#000
    style NFRD fill:#FFA726,stroke:#E65100,stroke-width:3px,stroke-dasharray: 5 5,color:#000
    style ID fill:#FFA726,stroke:#E65100,stroke-width:3px,stroke-dasharray: 5 5,color:#000
    style CG fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    style BT fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    style OPS fill:#BDBDBD,stroke:#424242,stroke-width:2px,stroke-dasharray: 5 5,color:#000
```

### 2.2 テキスト代替表現（Mermaid 非対応環境用）

```
[START] ユーザーリクエスト

INCEPTION フェーズ:
  [COMPLETED] Workspace Detection
  [SKIPPED]   Reverse Engineering（Greenfield のため不要）
  [COMPLETED] Requirements Analysis
  [COMPLETED] User Stories
  [IN PROGRESS] Workflow Planning
  [EXECUTE]   Application Design
  [EXECUTE]   Units Generation

CONSTRUCTION フェーズ（Unit ごとのループ）:
  [EXECUTE]   Functional Design（各 Unit）
  [EXECUTE]   NFR Requirements（各 Unit）
  [EXECUTE]   NFR Design（各 Unit）
  [EXECUTE]   Infrastructure Design（各 Unit）
  [EXECUTE]   Code Generation（各 Unit・必須）
  [EXECUTE]   Build and Test（全 Unit 完了後・必須）

OPERATIONS フェーズ:
  [PLACEHOLDER] Operations

[END] 完了
```

---

## 3. Phases to Execute（実行判定一覧）

### INCEPTION フェーズ

| ステージ | 判定 | 根拠 |
|---------|------|------|
| Workspace Detection | COMPLETED | 完了済み（2026-05-09T07:00:00Z） |
| Reverse Engineering | SKIPPED | Greenfield のため不要。既存コードベースなし |
| Requirements Analysis | COMPLETED | 完了済み（FR-01〜FR-08 / NFR-01〜NFR-11 確定） |
| User Stories | COMPLETED | 完了済み（Epic 5件 / Story 17件） |
| Workflow Planning | IN PROGRESS | 本ステージ（実行中） |
| **Application Design** | **EXECUTE** | 新規コンポーネント多数（フロントエンド / バックエンド / Dual-Agent）。サービス層・コンポーネント責務・API インタフェースの定義が必須 |
| **Units Generation** | **EXECUTE** | システム規模が大きく（フロント / バック / エージェント / インフラ / 共有パッケージ）、並行開発可能な Unit への分解が必要 |

### CONSTRUCTION フェーズ（全 Unit 共通）

| ステージ | 判定 | 根拠 |
|---------|------|------|
| **Functional Design** | **EXECUTE** | 新規データモデル（Tasks / Proposals / HonneData / Personas）・複雑なビジネスロジック（Dual-Agent フロー・Persona レンダリング）が存在するため |
| **NFR Requirements** | **EXECUTE** | パフォーマンス（NFR-01: 10秒以内 / NFR-02: 10〜20秒）・セキュリティ（NFR-07）・コスト（NFR-06: $50/月）・モニタリング（NFR-11）が明示的に定義されているため |
| **NFR Design** | **EXECUTE** | NFR Requirements を実行するため自動的に対象。Bedrock トークン制御・CloudWatch アラーム・Secrets Manager 設計が必要 |
| **Infrastructure Design** | **EXECUTE** | AWS インフラを全て新規構築（Lambda / API Gateway / DynamoDB / Cognito / Bedrock / CloudFront + S3 / Secrets Manager / EventBridge）。CDK スタック設計が必要 |
| **Code Generation** | **EXECUTE（必須）** | 常に実行。実装計画 → コード生成の2部構成 |
| **Build and Test** | **EXECUTE（必須）** | 常に実行。ビルド / ユニットテスト / 統合テスト / E2E テスト手順を生成 |

### OPERATIONS フェーズ

| ステージ | 判定 | 根拠 |
|---------|------|------|
| Operations | PLACEHOLDER | 将来の拡張予定。現時点では Build and Test フェーズで対応 |

---

## 4. Module Update Strategy（モジュール更新戦略）

### 4.1 モノレポ構成と依存関係

```
AWS-SummitHackathon-2026/
├── apps/
│   ├── web/              # フロントエンド（React + Vite + shadcn/ui）
│   └── api/              # バックエンド（Hono on Lambda）
├── packages/
│   ├── shared/           # 型定義・共通ユーティリティ（全モジュールが依存）
│   └── agent/            # エージェント実装（Bedrock converse API + Tool Use）
└── infra/                # AWS CDK スタック
```

**依存関係の方向**:

```
infra/ → （全リソース定義）
shared/ ← api/, agent/, web/ （全モジュールが依存）
agent/ ← api/ （API からエージェントを呼び出す）
api/ ← web/ （フロントエンドが API を呼び出す）
```

### 4.2 推奨実装順序

| 順序 | モジュール | 理由 |
|------|-----------|------|
| 1 | `packages/shared` | 型定義・共通インタフェースを先に確定。全モジュールがここに依存 |
| 2 | `infra/` | AWS リソース（DynamoDB / Cognito / Secrets Manager / API Gateway / S3 / CloudFront）を先にプロビジョニング。ローカル開発でモック代替も可 |
| 3 | `packages/agent` | Bedrock converse API + Tool Use によるエージェント①②の実装。shared の型に依存 |
| 4 | `apps/api` | Hono ハンドラ・Webhook エンドポイント。shared + agent に依存 |
| 5 | `apps/web` | React フロントエンド。API エンドポイントが確定してから結合 |

**更新アプローチ**: Sequential（順次更新）
**クリティカルパス**: shared → infra → agent → api → web
**テストチェックポイント**:
1. `infra/` デプロイ後: AWS コンソールでリソース確認
2. `agent/` 完成後: Bedrock API 疎通テスト（モックデータ）
3. `api/` 完成後: Postman / curl での API 単体テスト
4. `web/` 完成後: E2E デモシナリオ通し確認

---

## 5. 14日実行タイムライン（v2.0.0 — 2026-05-16〜5/30）

> **前提**: 1人開発。AI-DLC Construction ステージの粒度を予選向けに軽量化（1ステージあたり最大2時間）。

### マイルストーン構成

| マイルストーン | 日程 | 目標 |
|-------------|------|------|
| **M1: 書類審査提出** | 2026-05-10 | 完了済み（書類審査通過）|
| **M2: MVP デモ（予選）** | 2026-05-30 | 動作する MVP + プレゼン（Slack連携・Dual-Agent動作・Three.js演出） |
| **M3: 決勝** | 2026-06-26 | AWS デプロイ済み完成品 + 本番品質デモ |

### 14日詳細スケジュール（1人開発・予選向け最速計画）

```
[Day 1-2: 5/16-17] Inception文書確定 + U-01 shared 実装
  - ✅ Inception ドキュメント全面更新（v1.2.0）
  - U-01 shared: TypeScript 型定義 / Zod スキーマ / エラークラス / ユーティリティ
  - 目標: packages/shared/ が tsc --noEmit で通る状態

[Day 3-5: 5/18-20] U-02 infra CDK 実装・ローカル検証・デプロイ
  - CDK スタック（Cognito / DynamoDB / Lambda / API Gateway / S3 / CloudFront / Secrets Manager）
  - **Floci ローカル検証ステップ**（本番 AWS デプロイ前に必ず実施）:
    - Day 3: docker compose up -d でFloci起動 / npx cdk synth で全スタック検証
    - Day 4: AWS_ENDPOINT_URL=http://localhost:4566 npx cdk deploy DataStack でDynamoDB検証
    - Day 4: AWS_ENDPOINT_URL=http://localhost:4566 npx cdk deploy ApiStack AgentStack WebhookStack でLambda/API GW検証
    - Day 5: Floci上でスモークテスト実施（テーブル作成・Lambda invoke疎通確認）
    - Day 5: docker compose down → npx cdk deploy --all で本番AWSへデプロイ
  - Slack アプリ設定（App 作成 / Event Subscriptions URL 登録）
  - 目標: Flociローカル検証パス / AWS コンソールでリソース確認 / Slack Webhook URL 疎通

[Day 6-8: 5/21-23] U-03a task-extractor 実装
  - IBedrockClient インタフェース + ConverseBedrockClient 実装
  - AG-01: converse API + Tool Use で Slack メッセージ → TaskCandidate 変換
  - DynamoDB TaskCandidates テーブルへの書き込み確認
  - **Floci ローカル統合テスト**: docker compose up → Floci上のDynamoDB（localhost:4566）に接続してTaskCandidate書き込み検証
  - 目標: モックSlackイベントで TaskCandidate が生成される（Floci DynamoDB に書き込み確認）

[Day 9-11: 5/24-26] U-03b sabori-proposer 実装
  - AG-02: converse API + Tool Use で サボり判定3状態
  - Lambda Response Streaming（Function URL）でSSE配信
  - AG-03: PersonaRenderer（おっとりサボロー口調変換）
  - **Floci ローカル統合テスト**: Proposals / HonneData テーブルへの書き込みを Floci DynamoDB で検証
  - 目標: curl で SSE ストリームが返る（Floci Lambda + Floci DynamoDB で疎通確認）

[Day 12-13: 5/27-28] U-04 api + U-05 web MVP 実装
  - U-04: Hono on Lambda コアエンドポイント（認証・タスク・提案）
  - **Floci ローカル統合テスト**: Hono ハンドラが Floci DynamoDB / Floci Lambda に接続した状態で全エンドポイント疎通確認
  - U-05: React 画面（TaskList / TaskDetail / Login）
  - Three.js サボローキャラクター3D表示（基本形）
  - 目標: ブラウザでログイン→タスク承認→提案表示が動く（Floci バックエンドで動作確認後、本番AWSへ切替）

[Day 14: 5/29-30] デプロイ・デモリハーサル
  - AWS dev 環境への全スタックデプロイ
  - CloudFront URL でデモシナリオ通し確認
  - 5分デモリハーサル（バックアップ動画撮影）
  - 目標: デモが完走する
```

### カットライン（意思決定基準）

lean formal verification によるクリティカルパス検証に基づくカットライン定義:

| 判断日 | 状況 | カットライン（意思決定） |
|--------|------|----------------------|
| **5/21（Day 6）** | U-02 infra が未デプロイ | CDK デプロイを後回しにして SAM Local でローカル開発を続行。デプロイは Day 10 に延期 |
| **5/25（Day 10）** | U-03a が未完成 | converse API のレスポンスをハードコードしたスタブに差し替えてパイプライン疎通を優先 |
| **5/25（Day 10）** | U-03b が未着手 | SSEストリーミングを廃止してポーリング（5秒間隔）で代替 |
| **5/27（Day 12）** | U-04 api が未完成 | デモ用シードデータを DynamoDB に直接投入し、フロントエンドだけで動作する静的デモに切り替え |
| **5/28（Day 13）** | Three.js 未実装 | Three.js を M3 決勝スコープに延期。Lottie アニメーション（2D）で代替 |

### クリティカルパス検証（lean formal verification 適用）

```
依存チェーン: U-01(2-3h) → U-02(6-10h) → U-03a(4-6h) → U-03b(5-7h) → U-04(8-12h) → U-05(8-12h)

最楽観ケース:  2+6+4+5+8+8  = 33時間（約4.1日 @ 8h/day）
現実的ケース:  3+8+6+7+10+10 = 44時間（約5.5日 @ 8h/day）
最悲観ケース:  3+10+6+7+12+12 = 50時間（約6.3日 @ 8h/day）

14日間（8h/day = 112時間）は十分なバッファを持つ。
ただし設計・デバッグ・テスト・デプロイ作業が加わるため、
実質の実装時間は 50〜60時間 と見積もる。

判定: 14日計画は1人開発で実現可能（リスク: Medium）。
カットライン基準を守れば最悪ケースでも5/29には基本動作が完成する。
```

---

## 6. Success Criteria（成功基準）

### 6.1 Primary Goal（最重要目標）

**「人をダメにするサービス」コンセプトの訴求力**: 審査員が笑いと共感を感じ、「タスク整理能力が AI に委ねられて退化していく」というコンセプトを直感的に理解できること。

### 6.2 Key Deliverables（主要成果物）

#### 書類審査（2026-05-10）必須成果物

| 成果物 | パス | 品質基準 |
|--------|------|---------|
| requirements.md | `aidlc-docs/inception/requirements/requirements.md` | FR-01〜FR-08 / NFR-01〜NFR-11 全項目記載。受入基準明確 |
| user-stories.md（stories.md） | `aidlc-docs/inception/user-stories/stories.md` | Epic 5件・Story 17件。Given-When-Then 形式・エラーシナリオ完備 |
| execution-plan.md | `aidlc-docs/inception/plans/execution-plan.md` | 本文書（Mermaid 付き・3マイルストーン明記） |
| application-design.md | `aidlc-docs/inception/application-design/application-design.md` | コンポーネント・サービス・API・依存関係マトリクス完備 |

#### MVP デモ（2026-05-30）必須成果物

- 外部ツール連携（Slack / Gmail / Google Calendar）からのタスク自動抽出が動作
- エージェント②によるサボり提案生成（おっとりサボロー口調）が動作
- タスク一覧・タスク詳細・チャット画面の UI が動作
- 本音データ収集（クイック返信 4種 + 自由入力）が動作
- 5分デモシナリオが完走できること

#### 決勝（2026-06-26）必須成果物

- AWS（ap-northeast-1）へのデプロイが完了し、公開 URL が存在
- CDK スタックでインフラが完全コード化
- ユニットテスト（主要ロジック 80%以上カバレッジ）+ 統合テスト
- README（日本語）に環境構築手順・デモ手順が記載

### 6.3 Quality Gates（品質ゲート）

| ゲート | 基準 |
|--------|------|
| Mermaid 構文 | 全 Mermaid 図が構文エラーなし |
| TypeScript | strict mode 有効・any 原則禁止・Biome チェック通過 |
| セキュリティ | API キーハードコード禁止・Secrets Manager 使用・HTTPS 全通信 |
| コスト | Bedrock 1リクエスト 8,000 トークン以内・月額 $50 以内 |
| パフォーマンス | タスク抽出 10秒以内 / サボり提案 10〜20秒以内 |
| データ保護 | 外部ツール生データは処理後即削除（NFR-07 準拠） |
| GitHub | パブリックリポジトリ必須（書類審査要件） |

---

## 7. リスク対応策（v2.0.0 — 予選向け更新）

### リスク分類と対応状況

| リスクID | リスク内容 | 深刻度 | 対応状況 |
|---------|----------|--------|---------|
| R-01 | Lambda Cold Start + Bedrock 推論でレイテンシ目標超過 | 高 | 対応済み（NFR-01a 現実化・デモ前ウォームアップ） |
| R-02 | SSE ストリーミングが Lambda + API Gateway で動作しない | 高 | 対応済み（Lambda Response Streaming + Function URL に設計変更） |
| R-03 | Bedrock コスト上振れ | 中 | 監視中（guardTokenLimit + AWS Budgets） |
| R-04 | DynamoDB アクセスパターン設計漏れ | 中 | 対応済み（unit-of-work.md §8 に GSI 設計追加） |
| R-05 | Three.js バンドルサイズ増大 | 中 | 受容（動的インポート + カットライン5/28設定） |
| R-06 | Slack Event Subscriptions URL 検証の手順 | 中 | 監視中（Day 3-5 で優先対応） |

### 7.1 Slack Webhook 連携リスク

**リスク**: Slack Event Subscriptions の URL 検証が CDK デプロイ後まで進められない

**対応策**:
- Day 3-5 で CDK デプロイを最優先。API Gateway URL 取得後すぐに Slack アプリ設定を実施
- Slack からの URL 検証リクエスト（challenge パラメータ）に応答するエンドポイントを U-04 の先行実装として切り出す
- デモ用シードデータを DynamoDB に事前投入し、Webhook なしでもデモが成立するフォールバックを用意

### 7.2 Bedrock converse API + Tool Use 実装リスク

**リスク**: converse API + Tool Use の Tool 呼び出し仕様・JSON スキーマ定義でハマる

**対応策**:
- `IBedrockClient` インタフェースで実装を抽象化し、モックに差し替え可能にする
- ローカル開発・Vitest 時は Bedrock を完全モック化（vitest + モック実装）
- カットライン 5/25: converse が動かない場合はハードコードスタブに差し替え

### 7.3 Bedrock コストリスク

**リスク**: 開発・テスト中のトークン消費で $50/月 を超過する

**対応策**:
- ローカル開発・ユニットテスト時は Bedrock を完全モック化
- AWS Budgets で $30（警告）/ $50（通知）のアラートを設定
- `guardTokenLimit()` でプロンプトトリム（8,000 トークン上限）

### 7.4 Lambda Cold Start + Bedrock レイテンシリスク

**リスク**: 合算レイテンシが NFR-01a 目標（15秒）を超過する

**対応策**:
- デモ前に Lambda ウォームアップスクリプトを実行（最低1回 invoke してコンテナを温める）
- Provisioned Concurrency は決勝（M3）で検討（ハッカソン期間は不要）
- UX 対策: Webhook 受信後すぐに「処理中バナー」を表示してユーザーの体感待ち時間を軽減

### 7.5 Three.js バンドルサイズリスク

**リスク**: Three.js 追加でバンドルサイズが肥大化し初期ロードが遅くなる

**対応策**:
- React.lazy + dynamic import で Three.js コンポーネントを遅延ロード
- vite build で manual chunks 設定
- カットライン 5/28: 未実装の場合は Lottie（2D）で代替

---

## 7.6 AWSデプロイ計画

### デプロイ事前準備チェックリスト

```
□ AWSアカウント確認:
  - AWS コンソールにログインできる状態であること
  - ap-northeast-1 リージョンでの IAM ユーザー or IAM Identity Center ユーザー
  - 必要なサービスの利用可能状態を確認（Bedrock モデルアクセス申請）

□ Bedrock モデルアクセス権限:
  - Amazon Bedrock コンソール → モデルアクセス → Claude Sonnet 系を有効化
  - ap-northeast-1 でのモデル利用可能状況を確認（クロスリージョン推論の要否確認）
  - 推奨モデル: claude-3-5-sonnet-20241022（ap-northeast-1 対応を確認）

□ CDK ブートストラップ:
  npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1

□ Slack アプリ設定:
  - api.slack.com でアプリを新規作成
  - Bot Token Scopes: chat:write, channels:history, channels:read
  - Event Subscriptions: message.channels を購読
  - Signing Secret を Secrets Manager に保存

□ デモ用 URL 確保:
  - CloudFront Distribution URL: d[xxxxxxxx].cloudfront.net
  - API Gateway URL: https://[api-id].execute-api.ap-northeast-1.amazonaws.com
  - （オプション）Route 53 + ACM でカスタムドメイン設定
```

### デプロイコマンド手順

```bash
# 1. 依存関係インストール
pnpm install

# 2. 全パッケージのビルド確認
pnpm build

# 3. CDK デプロイ（全スタック）
cd infra
npx cdk synth   # テンプレート確認
npx cdk diff    # 変更内容確認
npx cdk deploy --all --require-approval never

# 4. フロントエンドのビルド＆S3アップロード
cd ../apps/web
VITE_API_BASE_URL=https://[api-id].execute-api.ap-northeast-1.amazonaws.com pnpm build
aws s3 sync dist/ s3://saborou-frontend-[env]/

# 5. CloudFront キャッシュ無効化
aws cloudfront create-invalidation --distribution-id [dist-id] --paths "/*"

# 6. Lambda ウォームアップ（デモ前必須）
aws lambda invoke --function-name saborou-task-extractor-dev --payload '{}' /dev/null
aws lambda invoke --function-name saborou-sabori-proposer-dev --payload '{}' /dev/null
```

### GitHub Actions CI/CD（任意・決勝向け）

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-region: ap-northeast-1
          role-to-assume: arn:aws:iam::ACCOUNT_ID:role/github-actions-role
      - run: pnpm install && pnpm build
      - run: cd infra && npx cdk deploy --all --require-approval never
```

---

## 8. Hackathon Specific Plan（ハッカソン特化計画）

### 8.1 書類審査まで（2026-05-10）の最優先成果物

| 優先度 | 成果物 | 状態 | アクション |
|--------|--------|------|-----------|
| 1 | requirements.md | 完了 | 承認済み |
| 2 | stories.md（user-stories.md） | 完了 | 承認済み |
| 3 | **execution-plan.md** | 本文書 | 本日完了 |
| 4 | **application-design.md** | 未着手 | 本日最優先で生成 |

**提出要件**:
- GitHub リポジトリが **パブリック** であること（現状確認必須）
- `aidlc-docs/` 配下に上記4文書が存在すること
- `aidlc-docs/audit.md` に全操作ログが記録されていること
- `aidlc-docs/aidlc-state.md` に Inception フェーズの進捗が正確に記録されていること

### 8.2 MVP デモまで（2026-05-30）の実装スコープ

**MUST 実装（デモ成立の最低条件）**:
- FR-01: Slack Webhook からのタスク自動抽出（converse API + Tool Use エージェント①稼働）
- FR-02: タスク候補の承認・編集・削除
- FR-03: サボり提案の生成（converse API + Tool Use エージェント②稼働・おっとりサボロー口調）
- FR-05: 本音データ収集（クイック返信 4種 + 自由入力）
- FR-06: タスク一覧の1行サボり判定サマリ
- FR-07: 認証（Cognito Google ログイン + Slack OAuth 連携）
- **Three.js によるサボローキャラクター3D演出（ラスベガス差別化要素）**

**SHOULD 実装（余裕があれば）**:
- FR-04: サボり提案のリアルタイム更新（EventBridge バックグラウンド更新）
- FR-08: 手動タスク追加

**スコープ外（v1.1.0 以降）**:
- Gmail / Google Calendar 連携

### 8.3 決勝まで（2026-06-26）の完成スコープ

- 全 FR（FR-01〜FR-08）の完全実装
- AWS 本番デプロイ（CloudFront + S3 + API Gateway + Lambda + DynamoDB + Cognito + Bedrock）
- CDK スタックによるインフラ完全コード化
- ユニットテスト（80%以上）+ 統合テスト + E2E テスト
- README（日本語）完備
- 5分デモシナリオ本番完走確認
- 将来ビジョン（取扱説明書・複数人格）の説明資料準備

---

## 9. AWS Well-Architected 評価サマリ（aws-well-architected スキル適用）

詳細は `aidlc-docs/inception/application-design/well-architected-review.md` を参照。

| 柱 | スコア | 主な改善アクション |
|----|--------|-----------------|
| 運用上の優秀性 | B+ | CloudWatch Dashboard CDK自動生成 / X-Ray 有効化 / デモ前チェックリスト |
| セキュリティ | A- | cdk-nag 実行 / IAM最小権限 / Secrets Manager |
| 信頼性 | B | Bedrock フォールバックメッセージ / DynamoDB リトライロジック |
| パフォーマンス効率 | B | Lambda Function URL でSSE / デモ前ウォームアップスクリプト |
| コスト最適化 | A | サーバーレス完全採用 / 月額 $22〜$32 見積り / guardTokenLimit |
| 持続可能性 | A- | サーバーレス + 東京 / TTL設定 / Bedrock結果キャッシュ |

---

## 10. Lean Formal Verification — 計画の形式的検証

### 10.1 クリティカルパス検証

```
依存チェーン: U-01 → U-02 → U-03a → U-03b → U-04 → U-05
推定工数:
  U-01 shared:         2-3h（実装容易）
  U-02 infra CDK:      6-10h（リスク: Slack URL検証待ち）
  U-03a task-extractor: 4-6h（リスク: converse API 仕様習熟）
  U-03b sabori-proposer: 5-7h（リスク: Lambda Streaming）
  U-04 api:            8-12h（リスク: Hono + 全エンドポイント実装）
  U-05 web:            8-12h（リスク: Three.js バンドル）

現実的合計: 33〜50時間の純実装時間
14日 × 8h = 112時間（バッファ: 62〜79時間）

命題1: 14日計画は1人開発で実現可能
証明: 現実的ケース44時間 < 112時間 ← 成立（余裕あり）
ただし: 設計・デバッグ・デプロイ・テスト・ドキュメント作業を加算すると
        実質コーディング時間は 60〜70時間程度（それでも112時間内に収まる）

判定: TRUE（計画は実現可能。カットライン遵守が条件）
```

### 10.2 カットライン定義（意思決定基準）

| Day | 状況 | カットライン（即断基準） |
|-----|------|---------------------|
| Day 6（5/21）| U-02 CDK デプロイ未完了 | SAM Local でローカル開発を続行。デプロイは Day 10 に延期 |
| Day 10（5/25）| U-03a converse API 未完成 | スタブ（ハードコードタスク候補）に差し替えてパイプライン疎通優先 |
| Day 10（5/25）| U-03b 未着手 | SSEストリーミングを廃止してポーリング（5秒間隔）に切り替え |
| Day 12（5/27）| U-04 api 未完成 | DynamoDB シードデータ + 静的デモに切り替え |
| Day 13（5/28）| Three.js 未実装 | Lottie（2Dアニメーション）で代替。Three.js は M3 に延期 |

### 10.3 リスク分類

| リスク | 分類 | 根拠 |
|--------|------|------|
| Bedrock converse API + Tool Use 実装 | **監視中** | 公式SDKサポートあり。カットライン5/25設定済み |
| Lambda Response Streaming 設定 | **監視中** | AWS公式ドキュメントあり。設定が複雑だが手順明確 |
| Three.js バンドルサイズ | **受容** | カットライン5/28でLottie代替可能 |
| Slack Event Subscriptions URL検証 | **対応済み** | Day 3-5 で CDK デプロイ後すぐに設定する計画 |
| Cold Start + Bedrock レイテンシ | **対応済み** | NFR-01a 現実化 + デモ前ウォームアップ |
| DynamoDB アクセスパターン不足 | **対応済み** | unit-of-work.md §8 に GSI 設計追加 |

---

## 11. Extension Configuration（拡張設定）（旧§9）

| Extension | 設定 | 理由 |
|-----------|------|------|
| Security Baseline | **無効**（Q23=B） | PoC・プロトタイプ扱い。ただし基本セキュリティ（IAM 最小権限・Secrets Manager・HTTPS）は実装する |
| Property-Based Testing | **無効**（Q24=C） | シンプルな CRUD・統合レイヤーが主体。複雑なビジネスロジックは限定的 |

---

## 12. 参照文書（旧§10）

| 文書 | パス |
|------|------|
| 要件定義書 | `aidlc-docs/inception/requirements/requirements.md` |
| ユーザーストーリー | `aidlc-docs/inception/user-stories/stories.md` |
| ペルソナ定義書 | `aidlc-docs/inception/user-stories/personas.md` |
| デモシナリオ | `aidlc-docs/inception/user-stories/demo-stories.md` |
| 将来展望 | `aidlc-docs/inception/user-stories/future-stories.md` |
| 状態管理 | `aidlc-docs/aidlc-state.md` |
| 監査ログ | `aidlc-docs/audit.md` |
| AWSアーキテクチャ方針 | `.claude/rules/aws-constraints.md` |
| Well-Architectedレビュー | `aidlc-docs/inception/application-design/well-architected-review.md` |
| Unit of Work（v1.2.0）| `aidlc-docs/inception/units/unit-of-work.md` |
| 要件定義書（v1.2.0）| `aidlc-docs/inception/requirements/requirements.md` |

---

*本文書は Workflow Planning ステージの成果物です。ユーザーの承認後、Application Design ステージに進みます。*
