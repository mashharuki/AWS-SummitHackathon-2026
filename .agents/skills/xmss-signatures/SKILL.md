---
name: xmss-signatures
description: |
  XMSS（eXtended Merkle Signature Scheme）耐量子性署名アルゴリズムを使ったプロダクトの設計・実装・テスト・AWS統合を包括的に支援するスキル。

  **必ずこのスキルを使うべきシーン（1%でも当てはまれば即起動）：**
  - 「XMSSを使いたい」「耐量子署名を実装したい」「ポスト量子暗号署名が必要」と言われたとき
  - 「量子コンピュータに耐性のある署名が欲しい」「PQC署名」「ハッシュベース署名」と言われたとき
  - XMSS / XMSS-MT / LMS / SPHINCS+ / CRYSTALS-Dilithium の選択・比較・実装を求められたとき
  - RFC 8391（XMSS仕様）の実装・解釈・検証
  - 長期的なデータ保護に量子耐性署名が必要な場面（10年以上の保存データ、法的文書、PKIルートCA等）
  - Winternitz OTS / Merkle木 / ステートフル署名の設計・実装・デバッグ
  - 鍵インデックス管理・ステート管理（SigningStateの原子的更新）
  - XMSS署名のセキュリティ審査・実装レビュー
  - AWSインフラ上でXMSS署名を使ったシステムを構築するとき
  - 「量子」「post-quantum」「PQC」「耐量子」「ハッシュベース暗号」というキーワードが出るとき
  - 「XMSS」「XMSS-MT」「Winternitz」「Merkle署名」というキーワードが出るとき
  - 秘密鍵の使い回し防止・鍵状態管理が重要な署名システムを設計するとき
---

# XMSS署名 開発支援スキル

XMSS署名プロダクトを要件定義からAWSデプロイまで一気通貫で支援する。
このスキルを起動したら、耐量子暗号の専門家として完全にコミットして作業する。

## XMSSプロダクト開発の全体フロー

```
[要件定義] → [パラメータ設計] → [ステート管理設計] → [実装] → [テスト] → [セキュリティ審査] → [AWSデプロイ]
                                        ↓ 最重要
                              [鍵インデックス原子的更新設計]
                              （ここが失敗するとセキュリティ完全崩壊）
```

---

## フェーズ1: 要件定義とパラメータ選択

### まず確認すること

```
1. 必要な署名回数は？（ライフタイム全体で）
   例：「証明書発行システム → 年間1万枚 × 10年 = 10万回必要」
       「IoTデバイスファームウェア更新 → 1デバイスに100回以下」
       「PKIルートCA → できるだけ少なく（年数回）でいい」

2. 署名のユースケースは？
   - コード署名（ファームウェア / ソフトウェア）
   - PKI証明書署名（CA）
   - ドキュメント署名（法的文書・契約書）
   - メッセージ認証（API署名・JWT代替）
   - ブロックチェーン / DLT（注意: XMSS-MTが必要な場合多い）

3. セキュリティレベルは？
   - 128ビット量子セキュリティ → n=32（SHA-256ベース）
   - 256ビット量子セキュリティ → n=64（SHA-512ベース）
   - NIST PQC標準準拠が必要か？

4. 署名・検証のパフォーマンス要件は？
   - 署名生成：リアルタイム（< 100ms）/ バッチ処理（数秒OK）
   - 署名サイズ：帯域・ストレージに制約があるか
   - 公開鍵サイズ：PKIシステムに組み込む場合の制約

5. ステート管理の環境は？
   - 単一ノード（シンプル）/ 分散システム（複雑）
   - HSM利用可否（AWS CloudHSM / AWS KMS）
   - ステートの永続化先（DB / ファイル / HSM内）
```

### パラメータセット選択ガイド

詳細は `references/parameter-sets.md` を参照。概要：

| パラメータセット | ハッシュ | ツリー高h | 署名可能回数 | 署名サイズ | 推奨用途 |
|----------------|---------|---------|------------|----------|---------|
| XMSS-SHA2_10_256 | SHA-256 | 10 | 1,024 | ~2.5 KB | PKIルートCA・高セキュリティCA |
| XMSS-SHA2_16_256 | SHA-256 | 16 | 65,536 | ~2.6 KB | 中規模CA・コード署名 |
| XMSS-SHA2_20_256 | SHA-256 | 20 | 1,048,576 | ~2.7 KB | 大量署名システム |
| XMSS-SHA2_10_512 | SHA-512 | 10 | 1,024 | ~4.9 KB | 最高セキュリティ要件 |
| XMSSMT-SHA2_20/2_256 | SHA-256 | 20 (2層) | 1,048,576 | ~4.9 KB | 高速鍵生成・大規模システム |
| XMSSMT-SHA2_60/3_256 | SHA-256 | 60 (3層) | 2^60 | ~5.6 KB | 超大規模・長期運用 |

**選択の基準：**
- 署名回数が少ない（< 1024回）→ `XMSS-SHA2_10_256`（鍵生成が速い）
- 署名回数が多い（> 1万回）→ `XMSS-SHA2_20_256` または XMSS-MT
- 鍵生成を速くしたい → XMSS-MT（各サブツリーが小さい）
- 署名を速くしたい → h小さいもの（署名パス短縮）

---

## フェーズ2: アーキテクチャ設計（ステート管理が最重要）

### ⚠️ XMSS最大の注意点: ステートフル署名スキーム

**XMSSは各鍵ペア（リーフ）を厳密に1回しか使えない。インデックスを2回使うとセキュリティが完全に破綻する。**

```
秘密鍵状態 = (SK_seed, SK_PRF, root, SEED, idx)
                                              ↑
                              署名ごとにこのインデックスが+1される
                              同じidxで2回署名した場合 → 秘密鍵解読可能
```

### ステート管理アーキテクチャパターン

**パターン1: シングルノード + ファイルロック（シンプル）**
```
適用: 単一サーバー、低スループット（< 10 TPS）
実装:
  1. 署名前にファイルロック取得
  2. 現在のidxを読み込む
  3. 署名実行（idx使用）
  4. idx+1を書き込み（fsyncで永続化）
  5. ファイルロック解放
リスク: サーバー障害時の鍵状態の整合性
```

**パターン2: DynamoDB原子的カウンター（AWS推奨）**
```
適用: AWSマネージド、中スループット（< 1000 TPS）
実装:
  1. DynamoDBにidx保存（条件付き書き込み）
  2. UpdateItemのConditionExpression: "idx = :current"
  3. 更新成功時のみ署名実行
  4. 競合時は自動リトライ
リスク: DynamoDBダウン時の署名不可（可用性とセキュリティのトレードオフ）
詳細: references/aws-integration.md
```

**パターン3: HSM内状態管理（最高セキュリティ）**
```
適用: PKIルートCA・金融システム・政府機関
実装: AWS CloudHSMカスタムファームウェアまたは外部HSM
リスク: コスト高・実装複雑
```

### AWS統合アーキテクチャ図

```
[署名リクエスト]
      ↓
[API Gateway] → [Lambda: XMSS署名関数]
                        ↓
              [DynamoDB: キー状態管理]  ← idx原子的インクリメント
                        ↓
              [Secrets Manager: SK保存]  ← 暗号化鍵材料
                        ↓
              [S3: 署名済みドキュメント保存]
                        ↓
              [CloudWatch: 監査ログ]
```

詳細アーキテクチャは `references/aws-integration.md` を参照。

---

## フェーズ3: 実装ガイド

### 言語別実装アプローチ

#### C言語（xmss-referenceライブラリ使用）

```c
// インストール
// git clone https://github.com/XMSS/xmss-reference
// make

#include "xmss.h"
#include "params.h"

// パラメータセット初期化
xmss_params params;
uint32_t oid;
xmss_str_to_oid(&oid, "XMSS-SHA2_10_256");
xmss_parse_oid(&params, oid);

// 鍵生成
unsigned char pk[XMSS_OID_LEN + params.pk_bytes];
unsigned char sk[XMSS_OID_LEN + params.sk_bytes];
xmss_keypair(pk, sk, oid);

// 署名（⚠️ skが更新される = ステート変更）
unsigned char *sm = malloc(params.sig_bytes + mlen);
unsigned long long smlen;
xmss_sign(sk, sm, &smlen, m, mlen);
// sk内のidxが+1されているので必ず永続化する！

// 検証
unsigned char *mout = malloc(smlen);
unsigned long long mlen_out;
int result = xmss_sign_open(mout, &mlen_out, sm, smlen, pk);
// result == 0 → 検証成功
```

#### Python（pyxmssまたはxmss-pythonラッパー）

```python
# pip install xmss  (ラッパーライブラリ)
from xmss import XMSS

# 鍵生成
xmss = XMSS.new("XMSS-SHA2_10_256")
pk, sk = xmss.generate_keypair()

# 署名（⚠️ skは即座に永続化すること）
signature = xmss.sign(message, sk)
sk = xmss.get_updated_sk()  # 更新された秘密鍵を必ず取得

# 検証
is_valid = xmss.verify(message, signature, pk)
```

#### Java（BouncyCastle使用）

```java
// build.gradle: implementation 'org.bouncycastle:bcprov-jdk18on:1.78'
import org.bouncycastle.pqc.crypto.xmss.*;

// パラメータ設定
XMSSParameters params = new XMSSParameters(10, new SHA256Digest());

// 鍵生成
XMSSKeyPairGenerator keyGen = new XMSSKeyPairGenerator();
keyGen.init(new XMSSKeyGenerationParameters(params, new SecureRandom()));
AsymmetricCipherKeyPair keyPair = keyGen.generateKeyPair();
XMSSPrivateKeyParameters privateKey = (XMSSPrivateKeyParameters) keyPair.getPrivate();
XMSSPublicKeyParameters publicKey = (XMSSPublicKeyParameters) keyPair.getPublic();

// 署名
XMSSSigner signer = new XMSSSigner();
signer.init(true, privateKey);
byte[] signature = signer.generateSignature(message);

// ⚠️ 署名後に更新された秘密鍵を取得・保存
XMSSPrivateKeyParameters updatedPrivKey = signer.getUpdatedPrivateKey();

// 検証
XMSSSigner verifier = new XMSSSigner();
verifier.init(false, publicKey);
boolean valid = verifier.verifySignature(message, signature);
```

#### Go（go-xmss ライブラリ使用）

```go
// go get github.com/danielhavir/go-xmss
package main

import (
    "fmt"
    xmss "github.com/danielhavir/go-xmss"
)

func main() {
    // パラメータ選択（SHA2_10_256 / SHA2_16_256 / SHA2_20_256）
    params := xmss.SHA2_16_256

    // 鍵生成
    prv, pub := xmss.GenerateXMSSKeypair(params)

    msg := []byte("sign this message")

    // 署名（⚠️ prvは署名のたびに内部状態が更新される）
    sig := prv.Sign(params, msg)

    // ⚠️ 署名直後に prv を永続化すること（idxが更新済み）
    persistSecretKey(prv)

    // 検証（verified messageバッファはparams.SignBytes()+len(msg)サイズ）
    m := make([]byte, params.SignBytes()+len(msg))
    if xmss.Verify(params, m, *sig, *pub) {
        fmt.Println("✓ 署名検証成功")
    }
}

// 署名サイズ確認
sigBytes := params.SignBytes()
fmt.Printf("署名サイズ: %d バイト\n", sigBytes)
// SHA2_16_256 → 2692 バイト
```

**go-xmss の特徴:**
- 外部依存ゼロ（Pure Go実装）
- 公式C実装（xmss-reference）と互換性あり
- `PrivateXMSS.Sign()` が `*SignatureXMSS` を返す
- `Verify()` の第2引数は出力バッファ（署名+メッセージサイズ）に注意
- 対応パラメータ: `SHA2_10_256` / `SHA2_16_256` / `SHA2_20_256` のみ（SHAKE系は非対応）
- 実用注意: ステート管理はアプリケーション層で実装する必要がある

#### Rust（xmss-rsクレート使用）

```rust
// Cargo.toml: xmss-rs = "0.1"
use xmss_rs::{XmssParams, xmss_keypair, xmss_sign, xmss_sign_open};

// パラメータ
let params = XmssParams::xmss_sha2_10_256();

// 鍵生成
let (mut sk, pk) = xmss_keypair(&params);

// 署名（skはmutableで自動更新）
let signature = xmss_sign(&params, &mut sk, &message);

// ⚠️ 必ずskを永続化
persist_secret_key(&sk)?;

// 検証
let is_valid = xmss_sign_open(&params, &signature, &pk, &message);
```

### 実装時の必須チェックリスト

```
鍵管理:
□ 秘密鍵はAES-256-GCMまたはAWS KMSで暗号化して保存
□ 鍵インデックス(idx)の更新はfsync/トランザクション保証
□ 鍵生成直後にバックアップ（ただしidxは別管理）
□ 公開鍵はroot + SEEDのセット保存

署名フロー:
□ 署名前に残り使用可能回数を確認（idx < 2^h）
□ 署名後に必ずsk（更新済み）を永続化してから応答
□ 永続化失敗時は署名結果を返さない（それ以降の安全性のため）
□ 鍵枯渇時のアラート（残り < 10%でWarning, < 1%でCritical）

エラー処理:
□ 鍵枯渇時の署名拒否と新鍵への移行フロー
□ 状態不整合検出時の安全なフォールバック
□ 重複署名試行の検出とアラート
```

---

## フェーズ4: テスト戦略

### テストカテゴリ

#### 1. KAT (Known Answer Tests) - 正確性検証

RFC 8391のテストベクタを使用して実装の正確性を検証する。

```python
# KATテスト例（RFC 8391 Appendix B）
def test_kat_xmss_sha2_10_256():
    # テストベクタ
    kat_sk_seed = bytes.fromhex("...")  # RFC 8391 Appendix B参照
    kat_pk = bytes.fromhex("...")
    kat_signature = bytes.fromhex("...")
    
    # 鍵生成の再現性チェック
    pk, sk = generate_keypair_from_seed(kat_sk_seed)
    assert pk == kat_pk
    
    # 署名の再現性チェック（同じseedから同じ署名が生成されること）
    sig = sign(sk, b"test message")
    assert sig == kat_signature
    
    # 検証成功チェック
    assert verify(pk, b"test message", sig) == True
```

#### 2. セキュリティプロパティテスト

```python
# ⚠️ 最重要: 同じインデックスで2回署名しないことを保証するテスト
def test_index_monotonically_increases():
    """署名後にidxが必ず増加することを確認"""
    sk = load_secret_key()
    idx_before = get_idx(sk)
    sign(sk, b"message 1")
    idx_after = get_idx(sk)
    assert idx_after == idx_before + 1

def test_no_index_reuse_on_crash():
    """クラッシュ後にidxが巻き戻らないことを確認"""
    # プロセスクラッシュをシミュレート
    sk = load_secret_key()
    idx_before = get_idx(sk)
    simulate_crash_during_signing()
    sk = load_secret_key()  # ファイルから再読み込み
    idx_after = get_idx(sk)
    assert idx_after >= idx_before  # 巻き戻りなし

def test_invalid_signature_rejected():
    """改ざんされた署名が必ず拒否されること"""
    sig = sign(sk, b"original")
    tampered_sig = bytearray(sig)
    tampered_sig[50] ^= 0xFF  # 1バイト改ざん
    assert verify(pk, b"original", bytes(tampered_sig)) == False

def test_wrong_message_rejected():
    """異なるメッセージへの署名が拒否されること"""
    sig = sign(sk, b"message A")
    assert verify(pk, b"message B", sig) == False
```

#### 3. パフォーマンステスト

```python
import time

def benchmark_xmss_operations():
    """パフォーマンス計測"""
    results = {}
    
    # 鍵生成
    start = time.perf_counter()
    pk, sk = xmss_keypair("XMSS-SHA2_10_256")
    results["keygen_ms"] = (time.perf_counter() - start) * 1000
    
    # 署名
    msg = b"benchmark message"
    start = time.perf_counter()
    for _ in range(100):
        sig = xmss_sign(sk, msg)
        sk = get_updated_sk()
    results["sign_avg_ms"] = (time.perf_counter() - start) * 10  # per sign
    
    # 検証
    start = time.perf_counter()
    for _ in range(100):
        xmss_verify(pk, msg, sig)
    results["verify_avg_ms"] = (time.perf_counter() - start) * 10
    
    print(f"鍵生成: {results['keygen_ms']:.1f}ms")
    print(f"署名(平均): {results['sign_avg_ms']:.1f}ms")
    print(f"検証(平均): {results['verify_avg_ms']:.1f}ms")
    
    # 一般的な目安値（XMSS-SHA2_10_256, 現代CPU）
    # 鍵生成: 100-500ms
    # 署名: 5-50ms
    # 検証: 3-20ms
```

#### 4. ステート管理テスト（DynamoDB）

```python
import boto3
from unittest.mock import patch

def test_atomic_idx_update():
    """DynamoDBの条件付き書き込みが機能することを確認"""
    dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
    table = dynamodb.Table('xmss-key-state')
    
    # 現在のidx取得
    response = table.get_item(Key={'key_id': 'signing-key-1'})
    current_idx = response['Item']['idx']
    
    # 原子的更新（競合検出付き）
    try:
        table.update_item(
            Key={'key_id': 'signing-key-1'},
            UpdateExpression='SET idx = :new_idx',
            ConditionExpression='idx = :current_idx',
            ExpressionAttributeValues={
                ':new_idx': current_idx + 1,
                ':current_idx': current_idx
            }
        )
        print(f"✓ idx更新成功: {current_idx} → {current_idx + 1}")
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        print("! 競合検出: 別プロセスがidxを更新済み → リトライ必要")

def test_key_exhaustion_alert():
    """鍵枯渇前のアラートが正しく発火することを確認"""
    total_keys = 1024  # XMSS-SHA2_10_256
    warning_threshold = int(total_keys * 0.9)  # 90%使用でWarning
    
    idx = warning_threshold + 1
    remaining = total_keys - idx
    assert remaining < total_keys * 0.1
    # CloudWatchアラームが発火することをテスト
```

---

## フェーズ5: セキュリティ審査

### 実装チェックリスト

#### 鍵管理セキュリティ
```
□ 秘密鍵はメモリ上でゼロクリアされている（使用後即座に）
□ 秘密鍵のログ出力・スタックトレース混入がない
□ 公開鍵のみで検証できる（秘密鍵不要の検証パス）
□ 鍵マテリアルのエクスポート機能が適切に制限されている
□ 鍵生成にはCSPRNGのみ使用している（time()などのシード禁止）
```

#### ステート管理セキュリティ
```
□ インデックス更新は原子的（read-modify-writeのアトミシティ保証）
□ 同一インデックスの署名が物理的に不可能な実装になっている
□ バックアップからのリストア時にインデックスが巻き戻らない
□ 鍵枯渇時に署名を安全に拒否する
□ 分散環境では単一の権威ある状態ソースがある
```

#### 実装レベルセキュリティ
```
□ タイミング攻撃対策（定数時間比較を使用）
□ バッファオーバーフロー対策（C実装の場合）
□ サイドチャネル攻撃への考慮（キャッシュタイミング等）
□ 入力バリデーション（署名サイズ・公開鍵サイズチェック）
```

### よくある脆弱性パターン

**危険パターン1: 署名前の状態保存漏れ**
```python
# ❌ 危険: 署名後に秘密鍵を保存していない
def sign_document(doc):
    sig = xmss_sign(global_sk, doc)
    return sig  # skが更新されていない！クラッシュ後にidxが巻き戻る

# ✅ 安全: 署名と状態保存を不可分にする
def sign_document(doc):
    sig = xmss_sign(global_sk, doc)
    persist_secret_key(global_sk)  # 先にskを永続化
    return sig  # 永続化完了後に署名を返す
```

**危険パターン2: 複数プロセス間でのsk共有**
```python
# ❌ 危険: 複数Lambdaインスタンスが同じskファイルを参照
# → 並列実行で同じidxを使用する可能性がある

# ✅ 安全: DynamoDBの条件付き書き込みで排他制御
```

**危険パターン3: テスト用固定シードの本番使用**
```python
# ❌ 危険
sk_seed = b'\x00' * 32  # テスト用固定シード

# ✅ 安全
sk_seed = secrets.token_bytes(32)  # 毎回ランダム生成
```

---

## フェーズ6: AWSデプロイ

詳細は `references/aws-integration.md` を参照。

### 推奨アーキテクチャ（Lambda + DynamoDB）

```python
# Lambda関数: XMSS署名エンドポイント
import boto3
import json
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
secrets_client = boto3.client('secretsmanager')

def handler(event, context):
    key_id = event['key_id']
    message = event['message'].encode()
    
    # 1. 秘密鍵をSecrets Managerから取得
    secret = secrets_client.get_secret_value(SecretId=f'xmss/{key_id}/sk')
    sk = decode_secret_key(secret['SecretString'])
    
    # 2. DynamoDBで原子的にidxを予約
    table = dynamodb.Table('xmss-key-state')
    current_idx = reserve_next_idx(table, key_id)
    
    if current_idx is None:
        return {'error': 'Key exhausted or conflict'}
    
    # 3. 署名実行
    signature = xmss_sign_with_idx(sk, message, current_idx)
    
    # 4. 更新されたskをSecrets Managerに保存
    update_secret_key(key_id, sk)
    
    # 5. CloudWatchに監査ログ
    log_signing_event(key_id, current_idx)
    
    return {
        'signature': signature.hex(),
        'key_id': key_id,
        'idx_used': current_idx
    }

def reserve_next_idx(table, key_id):
    """原子的にidxを取得・インクリメント"""
    try:
        response = table.update_item(
            Key={'key_id': key_id},
            UpdateExpression='SET current_idx = current_idx + :inc',
            ConditionExpression='current_idx < max_idx',
            ExpressionAttributeValues={':inc': 1},
            ReturnValues='UPDATED_OLD'
        )
        return response['Attributes']['current_idx']
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None  # 鍵枯渇
        raise
```

### CDK Infrastructure as Code

```typescript
// AWS CDK でXMSSインフラを定義
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class XmssSigningStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    // XMSS鍵状態管理テーブル
    const keyStateTable = new dynamodb.Table(this, 'XmssKeyState', {
      tableName: 'xmss-key-state',
      partitionKey: { name: 'key_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,  // 重要: 鍵状態の復旧に必要
    });

    // 署名Lambda
    const signingFn = new lambda.Function(this, 'XmssSigningFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'xmss_signing.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        KEY_STATE_TABLE: keyStateTable.tableName,
        AWS_REGION_NAME: 'ap-northeast-1',
      },
    });

    // 最小権限IAM
    keyStateTable.grantReadWriteData(signingFn);
  }
}
```

---

## クイックリファレンス

### XMSS vs 他のPQC署名方式

| 方式 | 量子耐性根拠 | 署名サイズ | ステートフル | 標準文書 | X.509対応 | 推奨用途 |
|-----|-----------|----------|------------|---------|----------|---------|
| **XMSS** | ハッシュのみ（最強） | 2-5KB | ✓ (必須) | RFC 8391 | RFC 9802 (OID: 1.3.6.1.5.5.7.6.34) | PKI CA・長期文書 |
| **XMSS-MT** | ハッシュのみ（最強） | 3-8KB | ✓ (必須) | RFC 8391 | RFC 9802 (OID: 1.3.6.1.5.5.7.6.35) | 大量署名システム |
| **SPHINCS+** | ハッシュのみ（最強） | 8-50KB | ✗ | NIST FIPS 205 | - | ステートレス優先 |
| **CRYSTALS-Dilithium** | 格子ベース | 2.4KB | ✗ | NIST FIPS 204 | - | 汎用PQC署名 |
| **Falcon** | 格子ベース | 0.7KB | ✗ | NIST FIPS 206 | - | サイズ制約がある場合 |

**XMSSを選ぶ理由：**
1. セキュリティ仮定が最もシンプル（Fの疑似ランダム性のみ。衝突耐性不要）
2. 量子コンピュータ耐性が数学的に最も強固
3. 長期的なセキュリティ（50年以上の保証に最適）
4. X.509 PKIへの統合が RFC 9802 で標準化済み（OID確定）
5. PoSブロックチェーン検証者など「スロット毎に1回署名」ユースケースに最適

**XMSSを避けるべき場面：**
1. ステート管理が困難な分散環境 → SPHINCS+ または Dilithium
2. 署名回数が予測不可能 → SPHINCS+（ステートレス）
3. 署名サイズに厳しい制約 → Falcon

### X.509 PKI統合（RFC 9802）

XMSSをX.509証明書で使用する際の重要事項：

```
OID割り当て（RFC 9802）:
  XMSS   → 1.3.6.1.5.5.7.6.34
  XMSSMT → 1.3.6.1.5.5.7.6.35

SubjectPublicKeyInfo:
  algorithm: 上記OID（parametersフィールドは省略必須）
  subjectPublicKey: RFC 8391形式のOCTET STRING

KeyUsage拡張:
  CA証明書:        digitalSignature | nonRepudiation | keyCertSign | cRLSign
  エンドエンティティ: digitalSignature | nonRepudiation | cRLSign

推奨ユースケース（RFC 9802）:
  ✓ ファームウェア署名・ソフトウェア署名
  ✓ CA証明書（特にルートCA）
  ✗ エンドエンティティ証明書への一般使用は非推奨（ステート管理の複雑さから）
```

詳細は `references/x509-pki-integration.md` を参照。

### 用語集

| 用語 | 説明 |
|-----|-----|
| WOTS+ | Winternitz One-Time Signature Plus。1つのリーフが1メッセージに署名 |
| L-tree | WOTS+公開鍵を圧縮する木構造。第二原像耐性のみ必要 |
| Merkle tree | 複数のWOTS+鍵を1つの公開鍵(root)に集約する木 |
| Authentication path | 署名時に含まれる兄弟ノードのパス（検証に必要） |
| idx | 署名インデックス。次に使用するリーフの番号 |
| SK_PRF | 擬似乱数関数の秘密鍵。乱数r生成に使用 |
| SEED | 公開シード。WOTS+鍵生成とハッシュ処理に使用 |
| h | ツリーの高さ。2^h回署名可能 |
| n | セキュリティパラメータ（バイト）。n=32が128ビット量子安全 |
| w | Winternitzパラメータ（4または16）。署名サイズとのトレードオフ |

---

## 参考資料

| ファイル | 内容 |
|--------|-----|
| `references/parameter-sets.md` | 全OIDパラメータ表・go-xmss定数名・サイズ計算式 |
| `references/state-management.md` | ステート管理3パターン詳細（ファイル/DynamoDB/CloudHSM） |
| `references/aws-integration.md` | Lambda/CDK/Secrets Manager完全実装 |
| `references/rfc8391-algorithms.md` | WOTS+ chain関数・L-tree・TreeHash アルゴリズム詳解 |
| `references/x509-pki-integration.md` | RFC 9802 OID・X.509証明書フォーマット・PKI統合ガイド |

**外部仕様:**
- RFC 8391（XMSS標準）: https://datatracker.ietf.org/doc/html/rfc8391
- RFC 9802（X.509 PKI統合）: https://www.rfc-editor.org/rfc/rfc9802.html
- go-xmss（Go実装）: https://github.com/danielhavir/go-xmss | https://pkg.go.dev/github.com/danielhavir/go-xmss
- xmss-reference（公式C実装）: https://github.com/XMSS/xmss-reference
