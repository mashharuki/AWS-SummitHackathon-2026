# XMSS × AWS 統合ガイド

AWSサービスを使ったXMSS署名システムの構築パターン。

---

## AWS サービス選定

| サービス | 役割 | 理由 |
|---------|------|------|
| **Lambda** | 署名処理 | スケーラブル・コスト効率・サーバーレス |
| **DynamoDB** | idx状態管理 | 条件付き書き込みで原子的更新・高可用性 |
| **Secrets Manager** | 秘密鍵暗号化保存 | 自動ローテーション・KMS統合・監査ログ |
| **API Gateway** | 署名APIエンドポイント | 認証・スロットリング・CloudWatch統合 |
| **CloudWatch** | 監視・アラート | 鍵使用率・エラー率の可視化 |
| **S3** | 公開鍵・署名アーカイブ | 長期保存・バージョニング |
| **CloudTrail** | 署名操作の監査ログ | 誰が・いつ・何に署名したか追跡 |
| **CloudHSM** | 高セキュリティ環境での鍵保護 | FIPS 140-2 Level 3 準拠が必要な場合 |

---

## 完全な署名システム実装

### Lambda関数（Python）

```python
import boto3
import json
import base64
import hashlib
import struct
import time
import logging
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
secrets = boto3.client('secretsmanager', region_name='ap-northeast-1')
cloudwatch = boto3.client('cloudwatch', region_name='ap-northeast-1')

def handler(event, context):
    """
    XMSS署名エンドポイント
    
    Input:
      key_id: str - 使用する鍵のID
      message: str - base64エンコードされた署名対象メッセージ
      
    Output:
      signature: str - base64エンコードされた署名
      key_id: str - 使用された鍵ID
      idx_used: int - 使用されたインデックス
      algorithm: str - 使用されたアルゴリズム
    """
    try:
        key_id = event['key_id']
        message = base64.b64decode(event['message'])
        
        # 1. 秘密鍵マテリアルを取得
        sk_material = get_key_material(key_id)
        
        # 2. インデックスを原子的に予約
        idx = reserve_signing_idx(key_id)
        
        # 3. 署名実行
        signature = perform_xmss_sign(sk_material, message, idx)
        
        # 4. 監査ログ
        log_signing_event(key_id, idx, message, context.aws_request_id)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'signature': base64.b64encode(signature).decode(),
                'key_id': key_id,
                'idx_used': idx,
                'algorithm': sk_material['algorithm']
            })
        }
    
    except KeyExhaustedException:
        logger.error(f"Key {key_id} is exhausted")
        return {'statusCode': 503, 'body': json.dumps({'error': 'Key exhausted'})}
    except Exception as e:
        logger.error(f"Signing failed: {e}")
        return {'statusCode': 500, 'body': json.dumps({'error': 'Internal error'})}


def get_key_material(key_id: str) -> dict:
    """Secrets ManagerからXMSS鍵マテリアルを取得"""
    try:
        response = secrets.get_secret_value(
            SecretId=f'xmss/keys/{key_id}'
        )
        return json.loads(response['SecretString'])
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            raise ValueError(f"Key {key_id} not found")
        raise


def reserve_signing_idx(key_id: str) -> int:
    """DynamoDBで原子的にidxを予約"""
    table = dynamodb.Table('xmss-key-state')
    
    for attempt in range(3):
        try:
            response = table.update_item(
                Key={'key_id': key_id},
                UpdateExpression='SET current_idx = current_idx + :inc, '
                                 'last_signed_at = :now',
                ConditionExpression='current_idx < max_idx',
                ExpressionAttributeValues={
                    ':inc': 1,
                    ':now': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                },
                ReturnValues='UPDATED_OLD'
            )
            idx = int(response['Attributes']['current_idx'])
            
            # 閾値チェック
            max_idx = int(response['Attributes'].get('max_idx', 1024))
            usage_pct = (idx + 1) / max_idx * 100
            cloudwatch.put_metric_data(
                Namespace='XMSS/KeyState',
                MetricData=[{
                    'MetricName': 'KeyUsagePercent',
                    'Dimensions': [{'Name': 'KeyId', 'Value': key_id}],
                    'Value': usage_pct,
                    'Unit': 'Percent'
                }]
            )
            
            return idx
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                raise KeyExhaustedException(f"Key {key_id} exhausted")
            elif attempt < 2:
                time.sleep(0.05 * (2 ** attempt))
                continue
            raise
    
    raise RuntimeError("Failed to reserve idx after retries")


def log_signing_event(key_id: str, idx: int, message: bytes, request_id: str):
    """CloudWatchにJSON構造化ログを出力（CloudTrailで追跡可能）"""
    logger.info(json.dumps({
        'event': 'xmss_sign',
        'key_id': key_id,
        'idx_used': idx,
        'message_hash': hashlib.sha256(message).hexdigest(),
        'request_id': request_id,
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }))


class KeyExhaustedException(Exception):
    pass
```

---

## AWS CDK インフラストラクチャ定義

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';

export class XmssSigningSystemStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id, { env: { region: 'ap-northeast-1' } });

    // ─── DynamoDB: 鍵状態テーブル ───────────────────────
    const keyStateTable = new dynamodb.Table(this, 'XmssKeyState', {
      tableName: 'xmss-key-state',
      partitionKey: { name: 'key_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,  // テーブル誤削除防止
    });

    // ─── Lambda: 署名関数 ────────────────────────────────
    const signingFn = new lambda.Function(this, 'XmssSigningFunction', {
      functionName: 'xmss-signing',
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset('lambda/xmss-signing'),
      handler: 'handler.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        KEY_STATE_TABLE: keyStateTable.tableName,
        AWS_ACCOUNT_ID: this.account,
      },
      logRetention: cdk.aws_logs.RetentionDays.ONE_YEAR,
    });

    // 最小権限IAM
    keyStateTable.grantReadWriteData(signingFn);
    signingFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [`arn:aws:secretsmanager:ap-northeast-1:${this.account}:secret:xmss/keys/*`],
    }));
    signingFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: { 'StringEquals': { 'cloudwatch:namespace': 'XMSS/KeyState' } }
    }));

    // ─── API Gateway: 署名エンドポイント ─────────────────
    const api = new apigateway.RestApi(this, 'XmssSigningApi', {
      restApiName: 'xmss-signing-api',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
      },
    });

    const signResource = api.root.addResource('sign');
    signResource.addMethod('POST', 
      new apigateway.LambdaIntegration(signingFn),
      {
        apiKeyRequired: true,  // APIキー必須
      }
    );

    // ─── CloudWatch アラーム ──────────────────────────────
    const alertTopic = new sns.Topic(this, 'XmssAlerts');

    new cloudwatch.Alarm(this, 'KeyUsageWarning', {
      metric: new cloudwatch.Metric({
        namespace: 'XMSS/KeyState',
        metricName: 'KeyUsagePercent',
        dimensionsMap: { KeyId: 'signing-key-prod-001' },
        period: cdk.Duration.minutes(5),
        statistic: 'Maximum',
      }),
      threshold: 90,
      evaluationPeriods: 1,
      alarmDescription: 'XMSS key usage > 90% - schedule key rotation',
    }).addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));

    new cloudwatch.Alarm(this, 'SigningErrorRate', {
      metric: signingFn.metricErrors({
        period: cdk.Duration.minutes(1),
      }),
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: 'XMSS signing error rate too high',
    }).addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
  }
}
```

---

## Secrets Managerの鍵フォーマット

```json
// シークレット名: xmss/keys/{key_id}
{
  "algorithm": "XMSS-SHA2_10_256",
  "sk_seed_b64": "BASE64_ENCODED_SK_SEED_32_BYTES",
  "sk_prf_b64": "BASE64_ENCODED_SK_PRF_32_BYTES",
  "root_b64": "BASE64_ENCODED_ROOT_32_BYTES",
  "pub_seed_b64": "BASE64_ENCODED_PUB_SEED_32_BYTES",
  "pk_b64": "BASE64_ENCODED_PUBLIC_KEY_68_BYTES",
  "created_at": "2025-01-01T00:00:00Z",
  "expires_at": "2030-01-01T00:00:00Z",
  "tree_height": 10,
  "max_signatures": 1024
}
```

**注意事項:**
- `sk_seed`, `sk_prf` は鍵生成時に一度だけ保存（不変）
- `current_idx` は Secrets Manager **ではなく** DynamoDB で管理
- Secrets Managerの自動ローテーションは使用しない（XMSS鍵は手動ローテーション）

---

## 鍵ローテーション手順

```python
def rotate_xmss_key(old_key_id: str, new_algorithm: str = "XMSS-SHA2_10_256"):
    """
    XMSS鍵のローテーション手順:
    1. 新しい鍵ペアを生成
    2. 新しい鍵をSecrets Managerに登録
    3. DynamoDBに新しい鍵のstate初期化
    4. 公開鍵を署名検証システムに配布
    5. 旧鍵を「廃止予定」状態に移行
    6. 旧鍵の使い残しをゼロにしてから削除
    """
    import secrets as python_secrets
    import json
    
    # 新鍵生成（xmss-referenceを使用）
    sk_seed = python_secrets.token_bytes(32)
    new_key_id = f"signing-key-{int(time.time())}"
    pk, sk_material = generate_xmss_keypair(new_algorithm, sk_seed)
    
    # Secrets Managerに新鍵を登録
    secrets_client = boto3.client('secretsmanager')
    secrets_client.create_secret(
        Name=f'xmss/keys/{new_key_id}',
        SecretString=json.dumps({
            'algorithm': new_algorithm,
            'sk_seed_b64': base64.b64encode(sk_material['sk_seed']).decode(),
            'pk_b64': base64.b64encode(pk).decode(),
            'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        })
    )
    
    # DynamoDBに状態初期化
    table = dynamodb.Table('xmss-key-state')
    table.put_item(Item={
        'key_id': new_key_id,
        'current_idx': 0,
        'max_idx': 1024,
        'algorithm': new_algorithm,
        'status': 'active',
        'warning_threshold': 921,
        'critical_threshold': 1014,
    })
    
    print(f"新しい鍵 {new_key_id} が作成されました")
    print(f"公開鍵をPKIに登録してください: {base64.b64encode(pk).decode()}")
    return new_key_id
```

---

## セキュリティベストプラクティス

### IAM最小権限ポリシー例

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "XmssSigningDynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-1:*:table/xmss-key-state",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": ["signing-key-prod-*"]
        }
      }
    },
    {
      "Sid": "XmssSecretsAccess",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:*:secret:xmss/keys/*",
      "Condition": {
        "StringEquals": {
          "secretsmanager:VersionStage": "AWSCURRENT"
        }
      }
    }
  ]
}
```

### VPCエンドポイント設定（Lambda→DynamoDB通信をインターネット経由にしない）

```typescript
// CDK: DynamoDB VPCエンドポイント
const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { isDefault: false });
vpc.addGatewayEndpoint('DynamoDbEndpoint', {
  service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
});
vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
  service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
});
```
