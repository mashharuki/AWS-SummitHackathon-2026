# RFC 8391 アルゴリズム詳解

WOTS+、L-tree、Merkle木の内部動作。実装デバッグや教育目的で参照する。

---

## セキュリティ前提（重要）

XMSSのセキュリティ仮定は他のPQC方式より「弱い仮定で成立する」点が強みである。

| 必要な仮定 | 説明 |
|----------|------|
| **Fの疑似ランダム性** | ハッシュ関数Fが疑似ランダム関数であること |
| **Hの多対象第二原像耐性** | 2^n個のターゲットに対して第二原像を求めることが困難 |
| **H_msgの多対象衝突耐性** | 複数ターゲットへの衝突を求めることが困難 |

**衝突耐性は不要**。これはSHA-256が将来的に衝突耐性を失っても、一方向性が保たれる限りXMSSは安全であることを意味する。

---

## 1. WOTS+ (Winternitz One-Time Signature Plus)

### パラメータ
```
n   = セキュリティパラメータ（バイト数）。SHA2_256の場合n=32
w   = Winternitzパラメータ（4 or 16）
len = len₁ + len₂
  len₁ = ⌈8n/log₂(w)⌉   (メッセージブロック数)
  len₂ = ⌊log₂(len₁·(w-1))/log₂(w)⌋ + 1  (チェックサムブロック数)
  例: n=32, w=16 → len₁=64, len₂=3, len=67
```

### chain関数（Algorithm 2）

```
chain(X, i, s, ADRS):
  入力: X (nバイト入力), i (開始インデックス), s (ステップ数), ADRS (アドレス)
  出力: nバイト (s回チェーンを適用した結果)

  if s == 0: return X
  tmp = chain(X, i, s-1, ADRS)
  ADRS.setHashAddress(i+s-1)
  KEY = PRF(SEED, ADRS)
  ADRS.setKeyAndMask(1)
  BM = PRF(SEED, ADRS)
  return F(KEY, tmp XOR BM)
```

ポイント: 各反復で**異なるマスク(BM)**を使用することで、単純なMerkle木より強いセキュリティを実現。

### WOTS+署名生成（Algorithm 5）

```
WOTS_sign(M, SK_seed, ADRS):
  1. msg = base_w(M, w, len₁) || checksum  (len個のw進数の配列)
  2. for i = 0 to len-1:
       ADRS.setChainAddress(i)
       sig[i] = chain(SK[i], 0, msg[i], ADRS)
  3. return sig
```

### WOTS+公開鍵復元（検証時）

```
WOTS_pkFromSig(sig, M, ADRS):
  msg = base_w(M, w, len₁) || checksum
  for i = 0 to len-1:
    ADRS.setChainAddress(i)
    tmp[i] = chain(sig[i], msg[i], w-1-msg[i], ADRS)
  return L_tree(tmp, ADRS)  # len個の要素をL-treeで圧縮
```

---

## 2. L-tree

WOTS+の公開鍵（len個のnバイト値）を1つのnバイト値に圧縮する不均衡二分木。

**なぜL-treeが必要か?**
Merkle木は全ての葉を同一サイズのnバイト値として扱う。しかしWOTS+公開鍵はlen個の値で構成されるため、そのまま葉にできない。L-treeがWOTS+公開鍵をMerkle木の葉（nバイト）に変換する。

```
L_tree(pk, ADRS):
  while len > 1:
    for i = 0 to ⌊len/2⌋-1:
      ADRS.setTreeHeight(現在の高さ)
      ADRS.setTreeIndex(i)
      pk[i] = RAND_HASH(pk[2i], pk[2i+1], ADRS)
    if len mod 2 == 1:
      pk[⌊len/2⌋] = pk[len-1]  # 奇数個の場合そのまま繰り上げ
    len = ⌈len/2⌉
    高さ++
  return pk[0]
```

---

## 3. RAND_HASH（Algorithm 7）

標準化されたハッシュ計算。アドレスに基づいてPRFで鍵とマスクを生成してからハッシュ。

```
RAND_HASH(LEFT, RIGHT, ADRS):
  ADRS.setKeyAndMask(0)
  KEY  = PRF(SEED, ADRS)
  ADRS.setKeyAndMask(1)
  BM_0 = PRF(SEED, ADRS)
  ADRS.setKeyAndMask(2)
  BM_1 = PRF(SEED, ADRS)
  return H(KEY, (LEFT XOR BM_0) || (RIGHT XOR BM_1))
```

---

## 4. TreeHash（Algorithm 9）

Merkle木を構築するスタックベースアルゴリズム。

```
TreeHash(SK, s, t, ADRS):
  # s: 開始リーフインデックス, t: ターゲットノード高さ
  # 2^t個の葉からツリーを構築してルートに向かう高さtのノードを返す

  Stack = []
  for i = 0 to 2^t - 1:
    ADRS.setType(OTS_HASH_ADDRESS)
    ADRS.setOTSAddress(s+i)
    pk = WOTS_genPK(SK_seed, ADRS)  # WOTS+公開鍵生成
    ADRS.setType(L_TREE_ADDRESS)
    ADRS.setLTreeAddress(s+i)
    Node = L_tree(pk, ADRS)  # L-treeで圧縮
    ADRS.setType(HASH_TREE_ADDRESS)
    ADRS.setTreeHeight(0)
    ADRS.setTreeIndex(s+i)

    while Stack != [] and Stack.top.height == current_height:
      ADRS.setTreeIndex((ADRS.getTreeIndex()-1)/2)
      Node = RAND_HASH(Stack.pop().node, Node, ADRS)
      ADRS.increaseTreeHeight()

    Stack.push({node: Node, height: current_height})

  return Stack.pop().node
```

---

## 5. XMSS署名フロー（完全版）

```
XMSS_sign(M, SK):
  # SK = (idx, SK_seed, SK_PRF, PK.root, PK.SEED)

  # 1. 使い捨て乱数 r を生成
  ADRS = new ADRS
  ADRS.setType(PBLK_ADDRESS)
  ADRS.setOTSAddress(idx)
  r = PRF(SK_PRF, toByte(idx, 32))  # ランダム化

  # 2. メッセージをハッシュ
  M' = H_msg(r || PK.root || toByte(idx, 32), M)

  # 3. WOTS+署名
  ADRS.setType(OTS_HASH_ADDRESS)
  ADRS.setOTSAddress(idx)
  ots_signature = WOTS_sign(M', SK_seed, ADRS)

  # 4. 認証パス計算（Authentication Path）
  auth = []
  for j = 0 to h-1:
    k = ⌊idx/2^j⌋ XOR 1  # 兄弟ノードのインデックス
    auth[j] = TreeHash(SK, k·2^j, j, ADRS)

  # 5. 秘密鍵のidxをインクリメント（⚠️ 必ず永続化）
  SK.idx = idx + 1

  return Sig = (idx, r, ots_signature, auth)
```

---

## 6. XMSS検証フロー

```
XMSS_verify(M, Sig, PK):
  # Sig = (idx, r, ots_sig, auth)
  # PK = (OID, root, SEED)

  # 1. メッセージのハッシュ再計算
  M' = H_msg(r || PK.root || toByte(idx, 32), M)

  # 2. WOTS+公開鍵の復元
  ADRS.setOTSAddress(idx)
  pk_ots = WOTS_pkFromSig(ots_sig, M', ADRS)

  # 3. L-treeでMerkleリーフに変換
  ADRS.setLTreeAddress(idx)
  node = L_tree(pk_ots, ADRS)

  # 4. 認証パスでルートを再計算
  for j = 0 to h-1:
    k = ⌊idx/2^j⌋
    if k mod 2 == 0:
      node = RAND_HASH(node, auth[j], ADRS)
    else:
      node = RAND_HASH(auth[j], node, ADRS)

  # 5. 計算したルートと公開鍵のルートを比較
  return node == PK.root
```

---

## 7. アドレス（ADRS）構造

XMSSはすべてのハッシュ呼び出しに32バイトのアドレス構造を使用。
これにより異なる場所の同じ入力が異なるハッシュ出力を生成することを保証（ドメイン分離）。

```
OTS Hash Address (type=0):
  layer address (4B) | tree address (8B) | type=0 (4B) |
  OTS address (4B) | chain address (4B) | hash address (4B) | key and mask (4B)

L-tree Address (type=1):
  layer address (4B) | tree address (8B) | type=1 (4B) |
  L-tree address (4B) | tree height (4B) | tree index (4B) | key and mask (4B)

Hash Tree Address (type=2):
  layer address (4B) | tree address (8B) | type=2 (4B) |
  padding (4B) | tree height (4B) | tree index (4B) | key and mask (4B)
```

---

## 8. PRFベースの疑似乱数鍵導出

秘密鍵`SK_seed`から全WOTS+秘密鍵を導出できる。実装で重要な最適化：

```
# WOTS+秘密鍵i番目の要素j番目
SK[i][j] = PRF(SK_seed, ADRS_i_j)
```

この性質により、**SK_seedだけ保存すれば全WOTS+鍵を復元可能**。
ただしidxは別途保存が必須（復元できない）。

---

## 9. go-xmss との RFC 8391 アルゴリズム対応

```go
// go-xmss のパラメータ定数はRFC 8391のOIDに対応
xmss.SHA2_10_256  // OID 0x00000001: n=32, w=16, h=10
xmss.SHA2_16_256  // OID 0x00000002: n=32, w=16, h=16
xmss.SHA2_20_256  // OID 0x00000003: n=32, w=16, h=20

// SignBytes() = 4 + n + (len + h) * n
// SHA2_16_256: 4 + 32 + (67 + 16) * 32 = 2692 バイト
fmt.Println(xmss.SHA2_16_256.SignBytes()) // → 2692
```

---

## 参考: RFC 8391 テストベクタ所在

RFC 8391 Appendix B にKAT（Known Answer Tests）テストベクタが定義されている。
実装検証時は必ずこれを使ってKATテストを実行すること。

- `XMSS-SHA2_10_256` のテストベクタはAppendix B.1
- `XMSS-SHA2_16_256` のテストベクタはAppendix B.2
- `XMSS-SHA2_20_256` のテストベクタはAppendix B.3
- `XMSSMT-SHA2_20/2_256` のテストベクタはAppendix C.1

RFC全文: https://datatracker.ietf.org/doc/html/rfc8391
