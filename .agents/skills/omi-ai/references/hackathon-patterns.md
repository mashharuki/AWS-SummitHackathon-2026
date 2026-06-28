# ハッカソン向けデモパターン集

## パターン A: SABOROU Memory型 — 人物ごとの会話履歴管理

### ユースケース
久しぶりに会った人を Omi が識別し、過去の会話履歴を通知する。

### アーキテクチャ

```
Omi デバイス
    │ (BLE)
    ▼
Omi スマホアプリ
    │ (Webhook POST)
    ▼
API Gateway (HTTPS)
    │
    ▼
Lambda (FastAPI/Mangum)
    │
    ├─── Bedrock (話者分析・感情分析・要約)
    │
    ├─── DynamoDB (会話履歴 per 話者)
    │
    └─── SNS → Mobile Push (スマホ通知)
```

### 実装コード (Lambda + Bedrock + DynamoDB)

```python
import boto3
import json
from datetime import datetime

bedrock = boto3.client('bedrock-runtime', region_name='ap-northeast-1')
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
sns = boto3.client('sns', region_name='ap-northeast-1')

CONVERSATIONS_TABLE = dynamodb.Table('saborou-conversations')
PERSONS_TABLE = dynamodb.Table('saborou-persons')


async def process_memory_with_bedrock(uid: str, memory: dict):
    """Bedrock で会話を分析して人物・感情を識別"""
    
    transcript = "\n".join([
        f"{seg['speaker']}: {seg['text']}"
        for seg in memory.get("transcript_segments", [])
    ])
    
    # Bedrock で分析
    prompt = f"""以下の会話を分析してください:

{transcript}

JSON形式で回答:
{{
  "persons": [
    {{
      "speaker_id": "SPEAKER_00",
      "name": "識別された名前 (不明ならnull)",
      "emotion": "dominant_emotion",
      "key_topics": ["トピック1", "トピック2"],
      "memorable_points": "この人について覚えておくべき重要なこと"
    }}
  ],
  "overall_sentiment": "positive/neutral/negative",
  "one_liner_suggestion": "次回この人に会ったときに言える一言"
}}"""
    
    response = bedrock.invoke_model(
        modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}]
        })
    )
    
    analysis = json.loads(json.loads(response['body'].read())['content'][0]['text'])
    
    # DynamoDB に保存
    for person in analysis.get("persons", []):
        CONVERSATIONS_TABLE.put_item(Item={
            "uid": uid,
            "conversation_id": memory["id"],
            "speaker_id": person["speaker_id"],
            "created_at": memory["created_at"],
            "person_name": person.get("name"),
            "emotion": person.get("emotion"),
            "key_topics": person.get("key_topics", []),
            "memorable_points": person.get("memorable_points", ""),
            "one_liner": analysis.get("one_liner_suggestion", ""),
            "title": memory.get("structured", {}).get("title", ""),
            "ttl": int(datetime.now().timestamp()) + 86400 * 365  # 1年
        })
    
    return analysis


async def search_past_conversations(uid: str, current_transcript: str) -> dict:
    """現在の会話から過去の記憶を検索"""
    
    # Bedrock で現在の会話から人物を識別
    prompt = f"""この会話から話者の情報を抽出:
{current_transcript}

JSON: {{"mentioned_names": [], "context_clues": []}}"""
    
    # DynamoDB から類似会話を検索 (実際は Vector Search 推奨)
    response = CONVERSATIONS_TABLE.scan(
        FilterExpression="uid = :uid",
        ExpressionAttributeValues={":uid": uid},
        Limit=10
    )
    
    return {
        "past_conversations": response.get("Items", []),
        "suggestion": "あの時の話、覚えていますよ！"
    }


async def send_notification(uid: str, message: str, endpoint_arn: str):
    """スマホにプッシュ通知を送る"""
    sns.publish(
        TargetArn=endpoint_arn,
        Message=json.dumps({
            "default": message,
            "APNS": json.dumps({"aps": {"alert": message, "sound": "default"}}),
            "GCM": json.dumps({"notification": {"title": "SABOROU", "body": message}})
        }),
        MessageStructure='json'
    )
```

---

## パターン B: リアルタイムアシスタント — キーワードトリガー型

### ユースケース
「調べて」「メモして」と言うと即座にアクションが実行される。

```python
TRIGGER_ACTIONS = {
    "調べて": search_web,
    "メモして": create_note,
    "スラックに送って": post_to_slack,
    "タスクを追加": add_task,
    "誰だっけ": search_person_memory,  # SABOROU 特有
}

async def process_realtime_async(uid: str, session_id: str, segments: list):
    combined_text = " ".join(seg["text"] for seg in segments[-5:])  # 直近5セグメント
    
    for trigger, action in TRIGGER_ACTIONS.items():
        if trigger in combined_text:
            # トリガー後のコンテキストを抽出
            idx = combined_text.index(trigger)
            context = combined_text[idx + len(trigger):].strip()
            await action(uid, context)
            return
```

---

## パターン C: MCP + Bedrock AgentCore Gateway 統合

### ユースケース
SABOROU の API を MCP サーバーとして公開し、Bedrock Agent から呼び出す。

```yaml
# openapi-spec.yaml (AgentCore Gateway 用)
openapi: 3.0.0
info:
  title: SABOROU Memory API
  version: 1.0.0
paths:
  /memories/search:
    post:
      summary: Search past conversation memories
      operationId: searchMemories
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                query:
                  type: string
                  description: Search query (person name, topic, etc.)
                uid:
                  type: string
                limit:
                  type: integer
                  default: 5
      responses:
        '200':
          description: Matching memories
  /memories/notify:
    post:
      summary: Send memory notification to user
      operationId: notifyMemory
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                uid:
                  type: string
                message:
                  type: string
                  description: The one-liner to suggest
```

---

## AWS CDK インフラ (ハッカソン最小構成)

```typescript
// lib/omi-integration-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

export class OmiIntegrationStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    // DynamoDB テーブル
    const conversationsTable = new dynamodb.Table(this, 'Conversations', {
      partitionKey: { name: 'uid', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'conversation_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda 関数
    const webhookHandler = new lambda.Function(this, 'WebhookHandler', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset('src/webhook'),
      handler: 'main.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONVERSATIONS_TABLE: conversationsTable.tableName,
        BEDROCK_REGION: 'ap-northeast-1',
      },
    });

    // Bedrock 権限
    webhookHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));

    // DynamoDB 権限
    conversationsTable.grantReadWriteData(webhookHandler);

    // API Gateway
    const api = new apigw.RestApi(this, 'OmiApi', {
      restApiName: 'SABOROU Memory API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
      },
    });

    const webhook = api.root.addResource('webhook');
    
    webhook.addResource('memory').addMethod(
      'POST',
      new apigw.LambdaIntegration(webhookHandler)
    );
    
    webhook.addResource('realtime').addMethod(
      'POST',
      new apigw.LambdaIntegration(webhookHandler)
    );

    new cdk.CfnOutput(this, 'WebhookUrl', {
      value: `${api.url}webhook/memory`,
      description: 'Omi に登録する Webhook URL',
    });
  }
}
```

---

## デモスクリプト (15分プレゼン用)

### 準備チェックリスト

```
□ Omi デバイス充電済み (100%)
□ Webhook サーバーが起動中 (AWS デプロイ済み)
□ Omi アプリにアプリがインストール済み
□ テストデータが DynamoDB に入っている
□ デモ用の "田中さん" の過去会話データを事前登録
□ バックアップ: 動画録画 + スクリーンショット
```

### デモフロー (5分デモ)

```
0:00 「SABOROUを使ってみます」
     → Omi デバイスを首にかけながら話す

0:30 「久しぶり！田中さん！最近どうですか？」
     → Omi がリアルタイムで文字起こし中 (画面で可視化)

1:30 バックエンドの処理を画面で見せる:
     → Amazon Transcribe が分節を解析
     → Bedrock AgentCore が話者識別・感情分析
     → DynamoDB から "田中さん" の過去記録を検索

2:30 スマホに通知が届く
     「田中さん: 2026/02/14 渋谷で会った
      ・子供が生まれたばかり (喜び)
      ・AWS プロジェクトに悩んでいた
      提案: "おめでとうございます！お子さんは歩き始めましたか？"」

3:30 「これがSABOROUです。使えば使うほど記憶力はダメになる。
     でも誰からも愛される人間になれます。」

4:00 技術スタックの説明 (アーキテクチャ図を見せながら)

5:00 Q&A
```

---

## トラブルシューティング (デモ当日)

| 問題 | 対処 |
|------|------|
| Webhook が届かない | ngrok を再起動、URL を Omi アプリで更新 |
| 認識精度が低い | 静かな場所に移動、マイクに近づく |
| Lambda タイムアウト | 非同期処理に変更 (BackgroundTasks) |
| DynamoDB 読み込み遅い | GSI 追加 or ElastiCache で高速化 |
| デモ全体が失敗 | 動画バックアップを再生しながら説明 |
