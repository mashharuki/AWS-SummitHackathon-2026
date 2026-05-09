# AWS全体アーキテクチャ

**プロジェクト名**: SABOROU（サボロー）  
**作成日**: 2026-05-09  
**バージョン**: 1.0.0  
**対象環境**: AWS ap-northeast-1 (東京)

---

## 1. AWS全体アーキテクチャ図（Mermaid）

```mermaid
graph TB
    subgraph "外部サービス"
        Slack[Slack API]
        Gmail[Gmail API]
        Calendar[Google Calendar API]
        GoogleIdP[Google Identity Provider]
    end

    subgraph "AWS ap-northeast-1"
        subgraph "エッジ層（CDN）"
            CloudFront[CloudFront<br/>静的コンテンツ配信]
            S3Web[S3 Bucket<br/>Web静的ホスティング<br/>React build]
        end

        subgraph "認証層"
            Cognito[Cognito User Pools<br/>Google OAuth<br/>JWT発行]
        end

        subgraph "API層"
            APIGW[API Gateway HTTP API<br/>Cognito Authorizer<br/>14 REST endpoints]
            HonoLambda[Lambda: Hono API<br/>TypeScript<br/>タスク管理 REST API]
        end

        subgraph "エージェント層"
            TaskExtractorLambda[Lambda: TaskExtractor<br/>エージェント①<br/>メッセージ→タスク抽出]
            SaboriProposerLambda[Lambda: SaboriProposer<br/>エージェント②<br/>サボり提案生成]
            Bedrock[Amazon Bedrock<br/>Claude Sonnet<br/>AgentCore SDK]
        end

        subgraph "Webhook層"
            WebhookLambda[Lambda: Webhook Handler<br/>Slack Events API<br/>Vercel Chat SDK]
            EventBridge[EventBridge<br/>イベントルーティング<br/>定期実行スケジューラ]
        end

        subgraph "データ層"
            DynamoDB[(DynamoDB On-Demand<br/>7テーブル)]
            SecretsManager[Secrets Manager<br/>OAuth tokens<br/>API keys]
        end

        subgraph "モニタリング層"
            CloudWatch[CloudWatch<br/>Logs + Alarms<br/>メトリクス]
        end
    end

    %% エッジ層の接続
    CloudFront --> S3Web
    
    %% クライアント→認証
    S3Web -->|Google Login| GoogleIdP
    GoogleIdP -->|Authorization Code| Cognito
    
    %% クライアント→API
    S3Web -->|REST API<br/>JWT Bearer| APIGW
    APIGW -->|Cognito Authorizer| Cognito
    APIGW --> HonoLambda
    
    %% API→エージェント
    HonoLambda -->|タスク承認時| SaboriProposerLambda
    HonoLambda -->|外部API呼び出し| SecretsManager
    SaboriProposerLambda -->|InvokeAgent| Bedrock
    
    %% Webhook→エージェント
    Slack -->|Events API<br/>Webhook| WebhookLambda
    WebhookLambda -->|PutEvents| EventBridge
    EventBridge -->|Lambda起動| TaskExtractorLambda
    TaskExtractorLambda -->|InvokeAgent| Bedrock
    
    %% エージェント→外部API
    SaboriProposerLambda -->|Context収集| Slack
    SaboriProposerLambda -->|Context収集| Gmail
    SaboriProposerLambda -->|Context収集| Calendar
    
    %% データアクセス
    HonoLambda --> DynamoDB
    TaskExtractorLambda --> DynamoDB
    SaboriProposerLambda --> DynamoDB
    WebhookLambda --> DynamoDB
    
    %% 定期実行
    EventBridge -->|スケジューラ| SaboriProposerLambda
    
    %% モニタリング
    HonoLambda --> CloudWatch
    TaskExtractorLambda --> CloudWatch
    SaboriProposerLambda --> CloudWatch
    WebhookLambda --> CloudWatch
    APIGW --> CloudWatch

    %% スタイル
    classDef frontend fill:#4FC3F7,stroke:#0288D1,stroke-width:2px,color:#000
    classDef auth fill:#FFB74D,stroke:#F57C00,stroke-width:2px,color:#000
    classDef api fill:#81C784,stroke:#388E3C,stroke-width:2px,color:#000
    classDef agent fill:#BA68C8,stroke:#7B1FA2,stroke-width:2px,color:#fff
    classDef webhook fill:#9575CD,stroke:#512DA8,stroke-width:2px,color:#fff
    classDef data fill:#E57373,stroke:#C62828,stroke-width:2px,color:#fff
    classDef monitoring fill:#FFD54F,stroke:#F9A825,stroke-width:2px,color:#000
    classDef external fill:#90A4AE,stroke:#455A64,stroke-width:2px,color:#000

    class CloudFront,S3Web frontend
    class Cognito auth
    class APIGW,HonoLambda api
    class TaskExtractorLambda,SaboriProposerLambda,Bedrock agent
    class WebhookLambda,EventBridge webhook
    class DynamoDB,SecretsManager data
    class CloudWatch monitoring
    class Slack,Gmail,Calendar,GoogleIdP external
```

---

## 2. AWS CDKスタック構成

このアーキテクチャは6つのCDKスタックで構成されます：

| スタック名 | 主要リソース | 依存関係 |
|-----------|------------|---------|
| **CognitoStack** | Cognito User Pools / Google IdP / JWT設定 | なし |
| **DataStack** | DynamoDB 7テーブル / Secrets Manager | なし |
| **ApiStack** | API Gateway HTTP API / Hono Lambda / Cognito Authorizer | CognitoStack, DataStack |
| **AgentStack** | TaskExtractor Lambda / SaboriProposer Lambda / Bedrock統合 | DataStack |
| **WebhookStack** | Webhook Lambda / EventBridge Rules / EventBridge Scheduler | DataStack, AgentStack |
| **FrontendStack** | CloudFront Distribution / S3 Bucket | ApiStack |

**スタックデプロイ順序**:
```
1. CognitoStack ─┐
2. DataStack ────┼─> 3. ApiStack ────┐
                 │                    ├─> 6. FrontendStack
                 ├─> 4. AgentStack ─┤
                 └─> 5. WebhookStack ┘
```

---

## 3. DynamoDBテーブル構成

| テーブル名 | パーティションキー | ソートキー | GSI | TTL |
|-----------|------------------|----------|-----|-----|
| **Users** | userId (String) | - | - | - |
| **ServiceConnections** | userId (String) | service (String) | - | - |
| **TaskCandidates** | candidateId (String) | - | GSI-UserCreatedAt | 30日 |
| **Tasks** | taskId (String) | - | - | - |
| **Proposals** | proposalId (String) | - | - | - |
| **HonneData** | honneId (String) | - | - | - |
| **Personas** | personaId (String) | - | - | - |

---

## 4. セキュリティ境界

```
┌─────────────────────────────────────────────────────┐
│ 外部（インターネット）                                │
│ - Slack / Gmail / Calendar（OAuth 2.0）              │
│ - Google Identity Provider（OpenID Connect）          │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │ CloudFront（CDN）      │
         │ - HTTPS必須            │
         │ - Origin Access Identity│
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │ Cognito User Pools     │
         │ - JWT Bearer Token発行 │
         │ - Google OAuth         │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │ API Gateway            │
         │ - Cognito Authorizer   │
         │ - CORS設定             │
         └───────────┬───────────┘
                     │
┌────────────────────┴────────────────────────────────┐
│ Lambda実行環境（プライベート）                        │
│ - VPC不要（サーバーレス）                             │
│ - IAMロール最小権限                                   │
│ - 環境変数（暗号化）                                  │
│ - Secrets Manager統合                                │
└─────────────────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │ DynamoDB / Secrets Mgr │
         │ - 暗号化保存（KMS）     │
         │ - VPCエンドポイント不要 │
         └───────────────────────┘
```

---

## 5. データフロー（3つの主要シナリオ）

### 5.1 タスク自動抽出フロー

```
Slack → Webhook Lambda → EventBridge → TaskExtractor Lambda → Bedrock
  ↓
TaskCandidates Table（DynamoDB）
  ↓
フロントエンド（ポーリング）
```

### 5.2 サボり提案生成フロー

```
フロントエンド → API Gateway → Hono Lambda → SaboriProposer Lambda
  ↓
Secrets Manager（OAuth tokens取得）
  ↓
外部API並列呼び出し（Slack / Gmail / Calendar）
  ↓
Bedrock（サボり判定推論）
  ↓
Proposals Table（DynamoDB）
  ↓
SSEストリーム → フロントエンド
```

### 5.3 定期再評価フロー

```
EventBridge Scheduler（毎時実行）
  ↓
SaboriProposer Lambda
  ↓
DynamoDB Query（nextCheckAt <= now）
  ↓
外部API + Bedrock 推論
  ↓
Proposals Table更新
```

---

## 6. コスト見積り（NFR-06: 月額$50以内）

| サービス | 想定使用量 | 月額コスト（USD） |
|---------|-----------|-----------------|
| **Lambda** | 10,000 invocations × 1GB × 5秒 | $1.00 |
| **API Gateway** | 10,000 requests | $0.04 |
| **DynamoDB** | On-Demand / 1GB / 100K RCU + WCU | $5.00 |
| **Bedrock** | 100 invocations × 8K tokens × Claude Sonnet | $20.00 |
| **Cognito** | 100 MAU（無料枠） | $0.00 |
| **CloudFront** | 10GB転送 | $1.00 |
| **S3** | 5GB保存 + 1,000 GET | $0.20 |
| **Secrets Manager** | 3シークレット | $1.20 |
| **CloudWatch** | ログ5GB | $2.50 |
| **合計** | | **$30.94** |

**備考**:
- Free Tier適用で初月は**$10以下**に抑制可能
- Bedrock呼び出しが最大コスト（トークン制限8,000で管理）
- スケールアップ時はDynamoDB Provisioned Capacityへ移行

---

## 7. モニタリング・アラーム設計

| メトリクス | 閾値 | アラーム内容 |
|-----------|------|------------|
| **Lambda実行時間** | >10秒 | NFR-01違反（タスク抽出） |
| **Lambda実行時間** | >20秒 | NFR-02違反（提案生成） |
| **Lambda同時実行数** | >100 | スロットリング警告 |
| **DynamoDB読み込み** | >80% キャパシティ | スケールアップ検討 |
| **Bedrock Token使用量** | >8,000 tokens/request | NFR-06違反（コスト超過リスク） |
| **API Gateway 5xx** | >1% | バックエンドエラー調査 |
| **Cognito認証失敗** | >10回/時間 | セキュリティインシデント疑い |

---

## 8. デプロイパイプライン

```
開発環境（ローカル）
  ↓ cdk deploy --profile dev
開発環境（AWS）
  ↓ テスト通過
  ↓ cdk deploy --profile staging
ステージング環境（AWS）
  ↓ 受入テスト通過
  ↓ cdk deploy --profile prod
本番環境（AWS）
```

**CI/CD（将来拡張）**:
- GitHub Actions → cdk synth → cdk deploy
- Slack通知（デプロイ成功/失敗）

---

## 9. 拡張性・スケーラビリティ

| 拡張ポイント | 現状（MVP） | スケールアップ時 |
|------------|-----------|----------------|
| **同時ユーザー数** | 100 MAU | 10,000 MAU |
| **DynamoDB** | On-Demand | Provisioned Capacity（オートスケーリング） |
| **Lambda同時実行** | デフォルト | Reserved Concurrency設定 |
| **CloudFront** | 単一ディストリビューション | 複数オリジン（API + Web分離） |
| **Bedrock** | Claude Sonnet | モデル切り替え可能（Haiku / Sonnet / Opus） |

---

## 10. 参考リンク

- [application-design.md](./application-design.md) - コンポーネント詳細設計
- [unit-of-work.md](../units/unit-of-work.md) - Unit分解とCDKスタック実装順序
- [requirements.md](../requirements/requirements.md) - NFR-01〜NFR-11（パフォーマンス・セキュリティ・コスト要件）
- [03-aws-architecture-policy.md](../../../aidlc-inputs/03-aws-architecture-policy.md) - AWSアーキテクチャ方針

---

**作成者**: AI-DLC Specialist（aidlc-specialist mode）
**最終更新**: 2026-05-09T17:00:00Z
