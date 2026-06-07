# XMSS ステート管理詳細ガイド

XMSSの実装で最も重要かつ難しいのが「ステート管理」。
インデックスを1回でも重複使用すると秘密鍵が解読可能になる。

---

## なぜステート管理が重要か

XMSS秘密鍵は以下の状態を持つ：

```
SK = (SK_seed, SK_PRF, root, SEED, idx)
                                  ^^^
                            ここが署名ごとに増加
```

idx（インデックス）は「次に使うWOTS+鍵ペアの番号」。
同じidxを2回使うと：
1. 2つの異なるメッセージに同じWOTS+鍵で署名したことになる
2. 攻撃者はWOTS+の連鎖の重複部分から秘密鍵を逆算できる
3. **結果: 秘密鍵が完全に解読される**

---

## ステート管理パターン

### パターン1: ファイルシステム + ロック（シンプル・単一ノード）

**適用場面:**
- 単一サーバー
- 低スループット（< 10 TPS）
- クラウド移行前の初期実装

**実装:**
```python
import fcntl
import struct
import os

class FileBasedXmssState:
    def __init__(self, sk_path: str, idx_path: str):
        self.sk_path = sk_path
        self.idx_path = idx_path
        self.lock_fd = None
    
    def acquire_lock(self):
        self.lock_fd = open(self.idx_path + '.lock', 'w')
        fcntl.flock(self.lock_fd, fcntl.LOCK_EX)
    
    def release_lock(self):
        fcntl.flock(self.lock_fd, fcntl.LOCK_UN)
        self.lock_fd.close()
    
    def sign_with_state(self, message: bytes) -> bytes:
        self.acquire_lock()
        try:
            # 1. 現在のidxを読み込む
            with open(self.idx_path, 'rb') as f:
                idx = struct.unpack('>I', f.read(4))[0]
            
            # 2. 鍵枯渇チェック
            if idx >= (1 << self.tree_height):
                raise Exception("Key exhausted!")
            
            # 3. 秘密鍵を読み込んで署名
            sk = self._load_sk()
            signature = xmss_sign(sk, message, idx)
            
            # 4. 新しいidxを書き込む（fsyncで永続化保証）
            with open(self.idx_path + '.tmp', 'wb') as f:
                f.write(struct.pack('>I', idx + 1))
                f.flush()
                os.fsync(f.fileno())
            os.replace(self.idx_path + '.tmp', self.idx_path)  # アトミックな置換
            
            # 5. 秘密鍵も更新保存
            self._save_sk(sk)
            
            return signature
        finally:
            self.release_lock()
```

**重要な点:**
- `os.replace`（アトミックなrename）でidxファイルを更新
- `os.fsync`でディスクへの書き込みを保証
- tmp経由での書き込みでtear writeを防止

---

### パターン2: DynamoDB 条件付き書き込み（AWS標準）

**適用場面:**
- AWSマネージド環境
- 中スループット（< 1000 TPS）
- Lambda + DynamoDB構成

**DynamoDBテーブル設計:**
```json
{
  "TableName": "xmss-key-state",
  "KeySchema": [
    { "AttributeName": "key_id", "KeyType": "HASH" }
  ],
  "AttributeDefinitions": [
    { "AttributeName": "key_id", "AttributeType": "S" }
  ],
  "BillingMode": "PAY_PER_REQUEST",
  "PointInTimeRecoverySpecification": { "PointInTimeRecoveryEnabled": true }
}
```

**アイテム構造:**
```json
{
  "key_id": "signing-key-prod-001",
  "current_idx": 42,
  "max_idx": 1024,
  "algorithm": "XMSS-SHA2_10_256",
  "created_at": "2025-01-01T00:00:00Z",
  "last_signed_at": "2025-06-07T10:30:00Z",
  "warning_threshold": 921,
  "critical_threshold": 1014
}
```

**実装（Python）:**
```python
import boto3
from botocore.exceptions import ClientError
import time

class DynamoDbXmssState:
    def __init__(self, table_name: str, key_id: str, max_retries: int = 3):
        self.dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
        self.table = self.dynamodb.Table(table_name)
        self.key_id = key_id
        self.max_retries = max_retries
    
    def reserve_next_idx(self) -> int | None:
        """原子的にidxを取得してインクリメント。失敗時はNoneを返す。"""
        for attempt in range(self.max_retries):
            try:
                response = self.table.update_item(
                    Key={'key_id': self.key_id},
                    UpdateExpression='SET current_idx = current_idx + :inc, last_signed_at = :now',
                    ConditionExpression='current_idx < max_idx',
                    ExpressionAttributeValues={
                        ':inc': 1,
                        ':now': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                    },
                    ReturnValues='UPDATED_OLD'
                )
                idx = int(response['Attributes']['current_idx'])
                self._check_thresholds(idx)
                return idx
            
            except ClientError as e:
                error_code = e.response['Error']['Code']
                if error_code == 'ConditionalCheckFailedException':
                    # 鍵枯渇
                    raise KeyExhaustedException(f"Key {self.key_id} is exhausted")
                elif error_code == 'ProvisionedThroughputExceededException':
                    # スロットリング → バックオフリトライ
                    time.sleep(0.1 * (2 ** attempt))
                    continue
                else:
                    raise
        
        return None  # リトライ上限
    
    def _check_thresholds(self, idx: int):
        """閾値チェックとCloudWatchアラーム発火"""
        import boto3
        cloudwatch = boto3.client('cloudwatch')
        
        response = self.table.get_item(Key={'key_id': self.key_id})
        item = response['Item']
        
        if idx >= item['critical_threshold']:
            cloudwatch.put_metric_data(
                Namespace='XMSS/KeyState',
                MetricData=[{
                    'MetricName': 'KeyExhaustionRisk',
                    'Dimensions': [{'Name': 'KeyId', 'Value': self.key_id}],
                    'Value': 2,  # Critical = 2
                    'Unit': 'None'
                }]
            )
        elif idx >= item['warning_threshold']:
            cloudwatch.put_metric_data(
                Namespace='XMSS/KeyState',
                MetricData=[{
                    'MetricName': 'KeyExhaustionRisk',
                    'Dimensions': [{'Name': 'KeyId', 'Value': self.key_id}],
                    'Value': 1,  # Warning = 1
                    'Unit': 'None'
                }]
            )


class KeyExhaustedException(Exception):
    pass
```

---

### パターン3: AWS CloudHSM内状態管理（最高セキュリティ）

**適用場面:**
- PKIルートCA
- 金融・政府機関
- FIPS 140-2 Level 3 準拠が必要

**考慮事項:**
- AWS CloudHSMはXMSSをネイティブサポートしていない（2025年現在）
- カスタムCKMメカニズムの実装が必要（高難度）
- 代替: CloudHSMでAES鍵を管理し、XMSSの秘密鍵をCloudHSMで暗号化して保護

```python
# CloudHSMでXMSS秘密鍵を保護する例
import pkcs11

def setup_hsm_protected_key(hsm_pin: str, sk_bytes: bytes) -> str:
    """XMSS秘密鍵をCloudHSM内のAES鍵で暗号化して保存"""
    lib = pkcs11.lib('/opt/cloudhsm/lib/libcloudhsm_pkcs11.so')
    token = lib.get_token(token_label='my-token')
    
    with token.open(user_pin=hsm_pin) as session:
        # HSM内でAES-256鍵を生成
        aes_key = session.generate_key(
            pkcs11.KeyType.AES, 256,
            store=True, label='xmss-wrapping-key'
        )
        
        # XMSS秘密鍵をAES-GCMで暗号化
        iv, ciphertext, tag = aes_key.encrypt(
            sk_bytes,
            mechanism=pkcs11.Mechanism.AES_GCM
        )
        
    return f"{iv.hex()}:{ciphertext.hex()}:{tag.hex()}"
```

---

## バックアップとリカバリ

### 危険なバックアップシナリオ

```
❌ 危険: idx=500の状態でバックアップを取り、後でリストアした場合
   - バックアップ時点: idx=500
   - リストア後: idx=500 (巻き戻り！)
   - リストア後に500番以降で署名した場合 → インデックス重複
```

### 安全なバックアップ戦略

```python
def safe_backup_strategy():
    """
    XMSSバックアップの正しいアプローチ:
    
    1. SK_seedとSK_PRF は鍵生成時に1回だけバックアップ
       （これらは変更されないので安全）
    
    2. idxは別途DynamoDBで管理（バックアップ不要・源泉はDB）
    
    3. 万が一のリカバリ時は idxをDBから取得し、
       さらに安全マージン（+100など）を加算してから使用
    """
    pass

class XmssKeyMaterial:
    """バックアップすべき不変の鍵材料"""
    sk_seed: bytes   # 変更なし → バックアップ可
    sk_prf: bytes    # 変更なし → バックアップ可
    root: bytes      # 変更なし → バックアップ可
    seed: bytes      # 変更なし → バックアップ可
    # idx は含めない！DynamoDBが正規のソース

class XmssKeyState:
    """DynamoDBで管理する可変状態"""
    key_id: str
    current_idx: int  # これだけDynamoDBで管理
    max_idx: int
```

---

## 分散環境でのステート管理

### 問題: 複数Lambda同時実行

```
Lambda #1: idx=100 を読み込む
Lambda #2: idx=100 を読み込む（競合！）
Lambda #1: idx=100 で署名 ← 正常
Lambda #2: idx=100 で署名 ← 同じidxで2回署名！セキュリティ崩壊
```

### 解決策: DynamoDB条件付き書き込み（楽観的ロック）

```python
# Lambda #1 と Lambda #2 が同時に動いても安全
# update_itemのConditionExpressionが競合を検出する

Lambda #1: UPDATE WHERE idx=100 → 成功（idx=101に更新）
Lambda #2: UPDATE WHERE idx=100 → 失敗！（すでに101になっているため）
Lambda #2: リトライ → idx=101 で署名（正常）
```

### スループット限界と対策

DynamoDBの条件付き書き込みでの限界：
- 書き込みユニット: 1 WCU = 1KB/s
- 高スループット向け: DAX（DynamoDB Accelerator）またはシャーディング

```python
# 高スループット向け: 複数の鍵プールを使用
class XmssKeyPool:
    """複数のXMSSキーを並列利用してスループット向上"""
    def __init__(self, key_ids: list[str]):
        self.key_ids = key_ids
        self.current_pool_idx = 0
    
    def get_next_key(self) -> str:
        """ラウンドロビンでキーを選択"""
        key = self.key_ids[self.current_pool_idx % len(self.key_ids)]
        self.current_pool_idx += 1
        return key
```

---

## 監視とアラート設定

### CloudWatchダッシュボード

```python
# CDK でCloudWatchダッシュボードを設定
import aws_cdk.aws_cloudwatch as cloudwatch

dashboard = cloudwatch.Dashboard(self, 'XmssMonitoring',
    dashboard_name='XMSS-Key-State'
)

# 鍵使用率ウィジェット
key_usage_widget = cloudwatch.GraphWidget(
    title='Key Index Usage',
    left=[
        cloudwatch.Metric(
            namespace='XMSS/KeyState',
            metric_name='CurrentIdx',
            dimensions_map={'KeyId': 'signing-key-prod-001'},
            period=cdk.Duration.minutes(5),
            statistic='Maximum'
        )
    ]
)
```

### アラーム設定

```python
# 鍵枯渇警告アラーム
warning_alarm = cloudwatch.Alarm(self, 'XmssKeyWarning',
    metric=cloudwatch.Metric(
        namespace='XMSS/KeyState',
        metric_name='KeyExhaustionRisk',
        dimensions_map={'KeyId': 'signing-key-prod-001'}
    ),
    threshold=1,  # Warning レベル
    evaluation_periods=1,
    alarm_description='XMSS key is 90% exhausted - schedule key rotation',
    actions_enabled=True
)
warning_alarm.add_alarm_action(
    cloudwatch_actions.SnsAction(sns_topic)
)
```
