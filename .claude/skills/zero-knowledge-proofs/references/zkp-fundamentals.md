# ZKP基礎理論・プロトコル比較リファレンス

## 目次
1. [ゼロ知識証明の3要件](#1-ゼロ知識証明の3要件)
2. [主要プロトコルの詳細比較](#2-主要プロトコルの詳細比較)
3. [算術回路とR1CSの基礎](#3-算術回路とr1csの基礎)
4. [Trusted Setup の仕組みとリスク](#4-trusted-setupの仕組みとリスク)
5. [フィールド演算の基礎](#5-フィールド演算の基礎)
6. [再帰型証明（Recursive SNARKs）](#6-再帰型証明recursive-snarks)

---

## 1. ゼロ知識証明の3要件

| 要件 | 意味 | 実装上の意味 |
|------|------|------------|
| **完全性 (Completeness)** | 正しい入力なら必ず証明を生成できる | 回路が正しく設計されていれば証明成功 |
| **健全性 (Soundness)** | 偽の入力で有効な証明は生成できない | under-constrainedがあると破られる |
| **ゼロ知識性 (Zero-Knowledge)** | 証明から秘密情報は漏れない | witnessが公開されない設計 |

---

## 2. 主要プロトコルの詳細比較

### Groth16（最もよく使われる）

**仕組み**: Linear PCP + 楕円曲線ペアリング
**証明サイズ**: 約192バイト（最小）
**Trusted Setup**: 回路ごとに必要（Powers of Tau + Circuit-specific）
**検証コスト**: 固定（Ethereum上で約250K gas）

```
特徴:
✅ 最小の証明サイズ → オンチェーン検証コストが最安
✅ 高速な証明生成
✅ circom + snarkJS の豊富なエコシステム
❌ 回路変更のたびにTrusted Setupが必要
❌ 量子コンピュータに脆弱（楕円曲線暗号）
```

**使用例**: Tornado Cash, Semaphore, Dark Forest

### PLONK / FFLONK

**仕組み**: Universal SNARK、KZG Polynomial Commitment
**証明サイズ**: 約500バイト
**Trusted Setup**: ユニバーサル（回路に依存しない）
**検証コスト**: Groth16より若干高い

```
特徴:
✅ 一度のTrusted Setupを全回路で再利用
✅ 更新可能なsetup（新参加者が追加可能）
✅ カスタムゲートで効率的な特殊演算
❌ Groth16より証明サイズが大きい
```

**FFLONK**: PLONKの改良版。証明サイズをさらに削減。
circomでは `snarkjs plonk` または `snarkjs fflonk` で使用。

### Halo2

**仕組み**: IPA（Inner Product Argument）+ PLONKish arithmetization
**証明サイズ**: 数KB
**Trusted Setup**: 不要（透明性あり）
**特徴**: カスタムゲート・ルックアップテーブルが強力

```rust
// Halo2回路の基本構造（Rust）
use halo2_proofs::{
    circuit::{Layouter, SimpleFloorPlanner},
    plonk::{Circuit, ConstraintSystem, Error},
    poly::Rotation,
};

struct MyCircuit {
    a: Option<Fp>,
    b: Option<Fp>,
}

impl Circuit<Fp> for MyCircuit {
    type Config = MyConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn configure(meta: &mut ConstraintSystem<Fp>) -> Self::Config {
        let a = meta.advice_column();
        let b = meta.advice_column();
        let c = meta.advice_column();

        meta.enable_equality(a);
        meta.enable_equality(b);
        meta.enable_equality(c);

        let s = meta.selector();

        // カスタムゲート: a * b = c
        meta.create_gate("mul", |meta| {
            let s = meta.query_selector(s);
            let a = meta.query_advice(a, Rotation::cur());
            let b = meta.query_advice(b, Rotation::cur());
            let c = meta.query_advice(c, Rotation::cur());
            vec![s * (a * b - c)]
        });

        MyConfig { a, b, c, s }
    }
}
```

**使用例**: zkSync Era, Zcash Orchard

### Plonky2（Polygon）

**仕組み**: PLONK + FRI（Fast Reed-Solomon IOP）
**特徴**: 非常に高速な証明生成、再帰証明に特化
**Trusted Setup**: 不要

```rust
use plonky2::field::goldilocks_field::GoldilocksField;
use plonky2::plonk::circuit_builder::CircuitBuilder;
use plonky2::plonk::config::PoseidonGoldilocksConfig;

type F = GoldilocksField;
type C = PoseidonGoldilocksConfig;
const D: usize = 2;

let mut builder = CircuitBuilder::<F, D>::new(CircuitConfig::standard_recursion_config());
let x = builder.add_virtual_target();
let x_squared = builder.mul(x, x);
builder.register_public_input(x_squared);

let data = builder.build::<C>();
```

### STARKs

**仕組み**: FRI + Hash関数（SHA256/Keccak/Poseidon）
**証明サイズ**: 大（100KB〜1MB）
**Trusted Setup**: 不要
**量子耐性**: あり（ハッシュ関数のみ使用）

---

## 3. 算術回路とR1CSの基礎

### R1CS（Rank-1 Constraint System）

Groth16/PLONKの基盤となる制約表現形式。
全ての制約は以下の形式：

```
(L ⋅ w) * (R ⋅ w) = (O ⋅ w)
```

L, R, O: 係数行列、w: witness（証人）ベクトル

**Circomは自動的にR1CSを生成する**。制約数が多いほど：
- 証明生成が遅くなる
- メモリ使用量が増える
- Trusted Setupに必要なPTAUサイズが大きくなる

```bash
# 制約数の確認
snarkjs r1cs info circuit.r1cs
# → 制約数、公開入力数、非公開入力数が表示される
```

### PLONKish算術化

Halo2が採用する方式。R1CSより柔軟。
- **アドバイスカラム**: プライベートデータ（witness）
- **インスタンスカラム**: パブリックデータ
- **セレクターカラム**: どのゲートを使うかの制御
- **カスタムゲート**: 特殊演算を効率化
- **ルックアップテーブル**: XOR等のビット演算を効率化

---

## 4. Trusted Setup の仕組みとリスク

### Powers of Tau（Phase 1）

```
全てのSNARKs回路で共有できる普遍的なparameters。
Hermez Ceremony（最大2^28）をそのまま使用可能。

信頼モデル: n人の参加者のうち「少なくとも1人が正直」なら安全
```

**実績あるPowers of Tau**:
- Hermez: 2^28（推奨、最大規模）
- Zcash Sapling: 2^21
- Semaphore: 2^23

### Phase 2（回路固有、Groth16のみ）

```bash
# 最低限の参加者数: 2名以上推奨（1名は危険）
snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey \
    --name="参加者1" -v -e="$(head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')"

snarkjs zkey contribute circuit_0001.zkey circuit_0002.zkey \
    --name="参加者2" -v

snarkjs zkey beacon circuit_0002.zkey circuit_final.zkey \
    "Ethereum block hash 0x..." 10 -n="Final beacon"

# 検証
snarkjs zkey verify circuit.r1cs hermez_final.ptau circuit_final.zkey
```

---

## 5. フィールド演算の基礎

### BN128フィールドのサイズ

```
フィールドサイズ p = 21888242871839275222246405745257275088548364400416034343698204186575808495617

全てのシグナルはこの値 mod p で計算される。
```

**重要な含意**:
- `n`ビットの数値は `n < 254` でないとオーバーフロー
- ビット分解は `num2bits(n)` コンポーネントを使用
- 負数は `p - |x|` として表現される

### Poseidon ハッシュ（ZKP向け）

SHA256はZK回路では非効率（多数の制約が必要）。
ZKP向けには **Poseidon** ハッシュを使用する。

```circom
pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";

template HashExample() {
    signal input a;
    signal input b;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== a;
    hasher.inputs[1] <== b;
    hash <== hasher.out;
}
```

**SHA256を使う場合**（Ethereumとの互換性が必要な場合のみ）:
```circom
include "circomlib/circuits/sha256/sha256.circom";
```

---

## 6. 再帰型証明（Recursive SNARKs）

ZKRollupで重要な技術。「証明の証明」を作ることで、
大量のトランザクションを1つの証明に集約できる。

```
Plonky2は再帰証明に特化しており、
1秒未満で再帰証明を生成できる（Polygon zkEVMで使用）

Nova (Microsoft Research):
- Incrementally Verifiable Computation (IVC)
- 折り畳み（Folding）スキームで効率的な再帰
- Rust実装: https://github.com/microsoft/Nova
```

### 再帰証明の使い所

```
ユースケース:
1. zkRollup: バッチトランザクションの検証
2. zkBridge: クロスチェーン証明
3. 長時間計算の検証: 複数のチャンクを並列証明して最後にまとめる
```
