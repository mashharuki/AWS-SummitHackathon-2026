# RFC 9802: XMSS × X.509 PKI 統合ガイド

RFC 9802「Use of the HSS and XMSS Hash-Based Signature Algorithms in Internet X.509 Public Key Infrastructure」の実装ガイド。

---

## OID定義（最重要）

```
id-alg-xmss   OBJECT IDENTIFIER ::= { 1.3.6.1.5.5.7.6.34 }
id-alg-xmssmt OBJECT IDENTIFIER ::= { 1.3.6.1.5.5.7.6.35 }
id-alg-hss    OBJECT IDENTIFIER ::= { 1.2.840.113549.1.9.16.3.17 }
```

これらのOIDは証明書の`SubjectPublicKeyInfo.algorithm.algorithm`フィールドに設定する。

---

## SubjectPublicKeyInfo 構造

```asn1
SubjectPublicKeyInfo ::= SEQUENCE {
  algorithm    AlgorithmIdentifier,
  subjectPublicKey  BIT STRING
}

AlgorithmIdentifier ::= SEQUENCE {
  algorithm  OBJECT IDENTIFIER,  -- 上記OIDのいずれか
  parameters ANY DEFINED BY algorithm OPTIONAL
  -- ⚠️ XMSSの場合、parametersは省略必須（存在してはならない）
}
```

**Go実装例（encoding/asn1使用）:**
```go
import (
    "encoding/asn1"
    "crypto/x509/pkix"
    xmss "github.com/danielhavir/go-xmss"
)

var oidXMSS = asn1.ObjectIdentifier{1, 3, 6, 1, 5, 5, 7, 6, 34}
var oidXMSSMT = asn1.ObjectIdentifier{1, 3, 6, 1, 5, 5, 7, 6, 35}

type XMSSPublicKeyInfo struct {
    Algorithm pkix.AlgorithmIdentifier
    PublicKey asn1.BitString
}

func encodeXMSSPublicKey(pub *xmss.PublicXMSS) ([]byte, error) {
    spki := XMSSPublicKeyInfo{
        Algorithm: pkix.AlgorithmIdentifier{
            Algorithm: oidXMSS,
            // Parameters は省略（RFC 9802準拠）
        },
        PublicKey: asn1.BitString{
            Bytes:     []byte(*pub),
            BitLength: len(*pub) * 8,
        },
    }
    return asn1.Marshal(spki)
}
```

---

## X.509証明書への組み込み

### CSR（Certificate Signing Request）生成

```go
package main

import (
    "crypto/rand"
    "crypto/x509"
    "crypto/x509/pkix"
    "encoding/asn1"
    "encoding/pem"
    "math/big"
    "time"

    xmss "github.com/danielhavir/go-xmss"
)

func generateXMSSCertificate(params *xmss.Params) ([]byte, error) {
    // 鍵生成
    prv, pub := xmss.GenerateXMSSKeypair(params)

    // 証明書テンプレート
    template := &x509.Certificate{
        SerialNumber: big.NewInt(1),
        Subject: pkix.Name{
            Organization:  []string{"Example Corp"},
            Country:       []string{"JP"},
            Province:      []string{"Tokyo"},
            CommonName:    "XMSS Root CA",
        },
        NotBefore:             time.Now(),
        NotAfter:              time.Now().Add(10 * 365 * 24 * time.Hour), // 10年
        IsCA:                  true,
        BasicConstraintsValid: true,
        KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
    }

    // ⚠️ 注意: Go標準の crypto/x509 はXMSSを直接サポートしていない
    // カスタム署名者を実装する必要がある
    certDER, err := x509.CreateCertificateWithSigner(
        rand.Reader,
        template,
        template,  // 自己署名
        pub,
        &XMSSSigner{prv: prv, params: params},
    )
    if err != nil {
        return nil, err
    }

    // ⚠️ 署名後に秘密鍵(prv)を必ず永続化
    persistPrivateKey(prv)

    return pem.EncodeToMemory(&pem.Block{
        Type:  "CERTIFICATE",
        Bytes: certDER,
    }), nil
}

// カスタム署名者（XMSSはcrypto.Signerインターフェース非標準）
type XMSSSigner struct {
    prv    *xmss.PrivateXMSS
    params *xmss.Params
}

func (s *XMSSSigner) Sign(rand io.Reader, digest []byte, opts crypto.SignerOpts) ([]byte, error) {
    sig := s.prv.Sign(s.params, digest)
    // ⚠️ 署名後にprvを永続化（ここが重要）
    return []byte(*sig), nil
}

func (s *XMSSSigner) Public() crypto.PublicKey {
    _, pub := xmss.GenerateXMSSKeypair(s.params)
    return pub
}
```

---

## BouncyCastle（Java）でのX.509統合

BouncyCastleはXMSSの X.509統合を公式サポートしている。

```java
import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.X509v3CertificateBuilder;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.pqc.crypto.xmss.*;
import org.bouncycastle.pqc.jcajce.provider.BouncyCastlePQCProvider;

// PQCプロバイダーを登録
Security.addProvider(new BouncyCastlePQCProvider());

// XMSS鍵ペア生成
KeyPairGenerator kpg = KeyPairGenerator.getInstance("XMSS", "BCPQC");
kpg.initialize(new XMSSParameterSpec(10, "SHA256"), new SecureRandom());
KeyPair keyPair = kpg.generateKeyPair();

// X.509証明書ビルダー
X500Name issuerDN = new X500Name("CN=XMSS Root CA, O=Example Corp, C=JP");
X500Name subjectDN = issuerDN;  // 自己署名

X509v3CertificateBuilder certBuilder = new JcaX509v3CertificateBuilder(
    issuerDN,
    BigInteger.ONE,
    new Date(),
    new Date(System.currentTimeMillis() + 10L * 365 * 24 * 60 * 60 * 1000),
    subjectDN,
    keyPair.getPublic()
);

// 基本制約拡張（CA証明書）
certBuilder.addExtension(Extension.basicConstraints, true, new BasicConstraints(true));
certBuilder.addExtension(Extension.keyUsage, true,
    new KeyUsage(KeyUsage.keyCertSign | KeyUsage.cRLSign | KeyUsage.digitalSignature));

// XMSS署名者（⚠️ 署名後に秘密鍵を取得・保存）
ContentSigner signer = new JcaContentSignerBuilder("XMSS-SHA256")
    .setProvider("BCPQC")
    .build(keyPair.getPrivate());

X509CertificateHolder cert = certBuilder.build(signer);

// ⚠️ 署名後の秘密鍵状態を取得して保存（BCが内部で更新している）
XMSSPrivateKeyParameters updatedKey = ((XMSSPrivateKeyParameters) keyPair.getPrivate())
    .extractKeyShard(1);  // 次のインデックスを確保
```

---

## KeyUsage 拡張の設定方針

RFC 9802 で規定されたKeyUsageビットの使用ガイドライン：

| ユースケース | digitalSig | nonRepudiation | keyCertSign | cRLSign |
|-----------|:---------:|:--------------:|:-----------:|:-------:|
| ルートCA | ✓ | - | ✓ | ✓ |
| 中間CA | ✓ | - | ✓ | ✓ |
| コード署名CA | ✓ | - | ✓ | ✓ |
| タイムスタンプCA | ✓ | - | ✓ | ✓ |
| エンドエンティティ（非推奨） | ✓ | ✓ | - | - |

**注意**: RFC 9802 はエンドエンティティ証明書でのXMSS使用を「非推奨」としている。
理由: エンドエンティティ（TLSサーバー、メールクライアント等）はハンドシェイクや
通信の都度署名するためステート管理が非常に複雑になるから。

---

## CRL（証明書失効リスト）署名

```java
// XMSS署名によるCRL生成（BouncyCastle）
X509v2CRLBuilder crlBuilder = new JcaX509v2CRLBuilder(issuerDN, new Date());
crlBuilder.setNextUpdate(new Date(System.currentTimeMillis() + 7 * 24 * 60 * 60 * 1000));

// 失効証明書を追加
crlBuilder.addCRLEntry(BigInteger.valueOf(123), new Date(), CRLReason.keyCompromise);

ContentSigner crlSigner = new JcaContentSignerBuilder("XMSS-SHA256")
    .setProvider("BCPQC")
    .build(caPrivateKey);

X509CRLHolder crl = crlBuilder.build(crlSigner);
// ⚠️ 毎回CRLに署名するたびにidxが増加する → CRL更新頻度を計画に含める
```

---

## 実装上の落とし穴

### 落とし穴1: Go標準ライブラリはXMSSを未サポート

```go
// ❌ これは動作しない（2025年現在）
cert, err := x509.CreateCertificate(rand.Reader, template, parent, xmssPub, xmssSigner)
// → "unsupported public key type: *xmss.PublicXMSS"

// ✅ BouncyCastle(Java)またはカスタム実装が必要
```

### 落とし穴2: OIDを間違える

```
❌ id-alg-hss (1.2.840.113549.1.9.16.3.17) はXMSSではなくHSS/LMS用
✓ id-alg-xmss (1.3.6.1.5.5.7.6.34) がXMSS用
✓ id-alg-xmssmt (1.3.6.1.5.5.7.6.35) がXMSS-MT用
```

### 落とし穴3: AlgorithmIdentifierのparametersを省略しない

```
❌ parameters フィールドにNULLを入れる（一部の古い実装）
✓ parametersフィールド自体を省略する（RFC 9802 MUST省略）
```

### 落とし穴4: CRL・OCSP署名の頻度を考慮しないパラメータ選択

```
証明書のライフタイム: 10年 → 500枚/年 × 10年 = 5,000回
CRL更新: 週1回 × 52週 × 10年 = 520回
OCSP: 多い場合は毎日 × 365 × 10 = 3,650回

合計: ~9,170回 → XMSS-SHA2_16_256（65,536回対応）を選ぶ
      シングルノードCA なら XMSS-SHA2_10_256（1,024回）では不足の可能性
```

---

## 参考仕様

- RFC 9802: https://www.rfc-editor.org/rfc/rfc9802.html
- RFC 8391（XMSS基本仕様）: https://datatracker.ietf.org/doc/html/rfc8391
- RFC 8554（HSS/LMS仕様）: https://datatracker.ietf.org/doc/html/rfc8554
- BouncyCastle XMSS実装: `org.bouncycastle.pqc.crypto.xmss`
