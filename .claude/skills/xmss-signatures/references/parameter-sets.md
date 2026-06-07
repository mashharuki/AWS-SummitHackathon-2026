# XMSS パラメータセット詳細仕様

RFC 8391 で定義された全パラメータセットの詳細。

## XMSS シングルツリー パラメータセット

### SHA-256 ベース（n=32, 128ビット量子セキュリティ）

| OID | 名称 | h | w | 署名数 | 署名サイズ | 公開鍵 | 秘密鍵 | 鍵生成時間目安 |
|-----|------|---|---|-------|-----------|-------|-------|--------------|
| 0x00000001 | XMSS-SHA2_10_256 | 10 | 16 | 1,024 | 2,500 B | 68 B | ~1.3 KB | ~0.1秒 |
| 0x00000002 | XMSS-SHA2_16_256 | 16 | 16 | 65,536 | 2,692 B | 68 B | ~1.3 KB | ~6秒 |
| 0x00000003 | XMSS-SHA2_20_256 | 20 | 16 | 1,048,576 | 2,820 B | 68 B | ~1.3 KB | ~95秒 |

### SHA-512 ベース（n=64, 256ビット量子セキュリティ）

| OID | 名称 | h | w | 署名数 | 署名サイズ | 公開鍵 | 秘密鍵 |
|-----|------|---|---|-------|-----------|-------|-------|
| 0x00000004 | XMSS-SHA2_10_512 | 10 | 16 | 1,024 | 4,963 B | 132 B | ~2.5 KB |
| 0x00000005 | XMSS-SHA2_16_512 | 16 | 16 | 65,536 | 5,317 B | 132 B | ~2.5 KB |
| 0x00000006 | XMSS-SHA2_20_512 | 20 | 16 | 1,048,576 | 5,509 B | 132 B | ~2.5 KB |

### SHAKE-128 ベース（n=32）

| OID | 名称 | h | 署名数 | 署名サイズ |
|-----|------|---|-------|-----------|
| 0x00000007 | XMSS-SHAKE_10_256 | 10 | 1,024 | 2,500 B |
| 0x00000008 | XMSS-SHAKE_16_256 | 16 | 65,536 | 2,692 B |
| 0x00000009 | XMSS-SHAKE_20_256 | 20 | 1,048,576 | 2,820 B |

### SHAKE-256 ベース（n=64）

| OID | 名称 | h | 署名数 | 署名サイズ |
|-----|------|---|-------|-----------|
| 0x0000000a | XMSS-SHAKE_10_512 | 10 | 1,024 | 4,963 B |
| 0x0000000b | XMSS-SHAKE_16_512 | 16 | 65,536 | 5,317 B |
| 0x0000000c | XMSS-SHAKE_20_512 | 20 | 1,048,576 | 5,509 B |

---

## XMSS-MT マルチツリー パラメータセット

XMSS-MTは複数のサブツリーをレイヤー構造で組み合わせる。
特徴：
- **鍵生成が高速**（トップレイヤーのサブツリーのみ即座に構築）
- **署名サイズは大きい**（各レイヤーの認証パスを含む）
- **超大量署名**に対応（2^60など）

### SHA-256 ベース XMSS-MT

| OID | 名称 | h総計 | d層数 | 署名数 | 署名サイズ | 鍵生成速度 |
|-----|------|------|------|-------|-----------|----------|
| 0x00000001 | XMSSMT-SHA2_20/2_256 | 20 | 2 | 2^20 | 4,963 B | 高速 |
| 0x00000002 | XMSSMT-SHA2_20/4_256 | 20 | 4 | 2^20 | 9,251 B | 超高速 |
| 0x00000003 | XMSSMT-SHA2_40/2_256 | 40 | 2 | 2^40 | 5,605 B | 高速 |
| 0x00000004 | XMSSMT-SHA2_40/4_256 | 40 | 4 | 2^40 | 10,533 B | 超高速 |
| 0x00000005 | XMSSMT-SHA2_40/8_256 | 40 | 8 | 2^40 | 20,389 B | 最高速 |
| 0x00000006 | XMSSMT-SHA2_60/3_256 | 60 | 3 | 2^60 | 8,392 B | 高速 |
| 0x00000007 | XMSSMT-SHA2_60/6_256 | 60 | 6 | 2^60 | 15,731 B | 超高速 |
| 0x00000008 | XMSSMT-SHA2_60/12_256 | 60 | 12 | 2^60 | 30,409 B | 最高速 |

---

## パラメータ選択フローチャート

```
署名回数の上限は？
├── < 1,000回 → XMSS-SHA2_10_256 （小規模CA・デバイス）
├── 1,000 ～ 65,000回 → XMSS-SHA2_16_256 （中規模CA）
├── 65,000 ～ 100万回 → XMSS-SHA2_20_256 （大規模署名サービス）
└── 100万回以上 → XMSS-MT を検討
         └── 鍵生成速度が重要？
                  ├── Yes → XMSSMT-SHA2_20/4_256 (d=4)
                  └── No  → XMSSMT-SHA2_20/2_256 (d=2, 署名サイズ小)

セキュリティレベルは？
├── 128ビット量子セキュリティ → n=32 (SHA-256 / SHAKE-128)
└── 256ビット量子セキュリティ → n=64 (SHA-512 / SHAKE-256)

ハッシュ関数の好みは？
├── FIPS 140-2準拠が必要 → SHA-256 / SHA-512
└── NIST推奨の最新関数 → SHAKE-128 / SHAKE-256
```

---

## 署名サイズの計算式

XMSS署名のバイト数 = 4 + n + (len + h) × n

ここで：
- `n`: セキュリティパラメータ（32 or 64）
- `len`: WOTS+の連鎖数 = `ceil(8*n/log2(w)) + floor(log2(len1)/log2(w)) + 1`
  - w=16, n=32 の場合: len = 67
- `h`: ツリーの高さ

**計算例 (XMSS-SHA2_10_256: n=32, len=67, h=10):**
```
署名サイズ = 4 + 32 + (67 + 10) × 32 = 4 + 32 + 2464 = 2500 バイト
```

---

## go-xmss（Go）でのパラメータ定数

```go
// import xmss "github.com/danielhavir/go-xmss"
// 対応パラメータは SHA2 系の3種のみ（SHAKE系非対応）

xmss.SHA2_10_256   // h=10, 1,024回署名, SignBytes()=2500
xmss.SHA2_16_256   // h=16, 65,536回署名, SignBytes()=2692
xmss.SHA2_20_256   // h=20, 1,048,576回署名, SignBytes()=2820

// 署名サイズの確認
fmt.Println(xmss.SHA2_10_256.SignBytes()) // 2500
fmt.Println(xmss.SHA2_16_256.SignBytes()) // 2692
fmt.Println(xmss.SHA2_20_256.SignBytes()) // 2820
```

XMSS-MT / SHAKE系が必要な場合は xmss-reference（C）または BouncyCastle（Java）を使用。

---

## BouncyCastleでのパラメータ設定

```java
// Java BouncyCastle での各パラメータセット
XMSSParameters params10 = new XMSSParameters(10, new SHA256Digest());   // XMSS-SHA2_10_256
XMSSParameters params16 = new XMSSParameters(16, new SHA256Digest());   // XMSS-SHA2_16_256
XMSSParameters params20 = new XMSSParameters(20, new SHA256Digest());   // XMSS-SHA2_20_256
XMSSParameters params10_512 = new XMSSParameters(10, new SHA512Digest()); // XMSS-SHA2_10_512

// XMSS-MT
XMSSMTParameters mtParams = new XMSSMTParameters(20, 2, new SHA256Digest()); // XMSSMT-SHA2_20/2_256
```

## xmss-reference C実装でのOID指定

```c
// OIDを文字列から変換
uint32_t oid;
xmss_str_to_oid(&oid, "XMSS-SHA2_10_256");   // OID: 0x00000001
xmss_str_to_oid(&oid, "XMSS-SHA2_16_256");   // OID: 0x00000002
xmss_str_to_oid(&oid, "XMSS-SHA2_20_256");   // OID: 0x00000003
xmss_str_to_oid(&oid, "XMSSMT-SHA2_20/2_256"); // MT variant

// OIDからパラメータ解析
xmss_params params;
xmss_parse_oid(&params, oid);
printf("ツリー高: %d, 署名数: %llu\n", params.full_height, (1ULL << params.full_height));
```
