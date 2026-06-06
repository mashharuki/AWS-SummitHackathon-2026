# 再帰型ZKP（Recursive ZKP）設計・実装リファレンス

## 目次
1. [再帰型ZKPの基礎概念](#1-再帰型zkpの基礎概念)
2. [手法別比較と選択指針](#2-手法別比較と選択指針)
3. [Plonky2 実装ガイド](#3-plonky2-実装ガイド)
4. [Halo2 再帰設計](#4-halo2-再帰設計)
5. [Nova / Folding スキーム](#5-nova--folding-スキーム)
6. [zkVM（RISC Zero / SP1）](#6-zkvm-risc-zero--sp1)
7. [証明集約（Proof Aggregation）](#7-証明集約proof-aggregation)
8. [設計パターンとアーキテクチャ](#8-設計パターンとアーキテクチャ)
9. [テスト戦略](#9-テスト戦略)

---

## 1. 再帰型ZKPの基礎概念

### なぜ再帰型証明が必要か

通常のZKP（単一証明）の限界：
- 証明できる計算量に上限がある（回路サイズ = メモリ使用量）
- 大量処理（1万件のトランザクション等）は現実的な時間内に証明できない
- 複数の独立した証明を一括で検証できない

再帰型ZKPが解決すること：
```
[単一証明の世界]
tx1 → proof1 (on-chain verify)
tx2 → proof2 (on-chain verify)
tx3 → proof3 (on-chain verify)
コスト: O(n) 回の on-chain verification

[再帰型証明の世界]
tx1,tx2,...,txN → proof_N (on-chain verify 1回)
コスト: O(1) 回の on-chain verification ← これがzkRollupの本質
```

### 核心概念: IVC（Incrementally Verifiable Computation）

```
IVCの定義:
- 状態 z_0 から始まり、各ステップで z_{i+1} = F(z_i, w_i) を計算
- N ステップ後の状態 z_N を、N ステップの計算を正しく行ったことの証明と共に出力
- 証明サイズは N に依存しない（O(1)！）

F: ステップ関数（例: トランザクション適用、VMの1命令実行）
z: 公開状態（例: Merkle root、プログラムカウンタ）
w: witness（例: トランザクションデータ、命令の入力）
```

### 3つのアプローチ

```
1. Native Recursion（Plonky2/Halo2）
   → 証明検証を回路の中に組み込む
   → 同じプルーフシステムで自己言及的に再帰
   → 最も効率的だが実装が複雑

2. Folding Scheme（Nova/HyperNova）
   → 証明を「折り畳む」（複数の証明を1つにまとめる数学的操作）
   → 各ステップは accumulator を更新するだけ（軽量）
   → 最後だけ SNARK に変換して小さい証明を出力

3. Proof Aggregation（Groth16再帰）
   → 既存の証明を別の回路で検証する
   → 実装が比較的シンプル、エコシステムが豊富
   → Groth16のTrusted Setupが必要
```

---

## 2. 手法別比較と選択指針

| 手法 | 1ステップのコスト | 最終証明サイズ | Setup | 実装難易度 | 推奨シーン |
|------|----------------|--------------|-------|---------|----------|
| Plonky2 再帰 | ~0.2秒(GPU) | 小(数KB) | 不要 | ★★★★☆ | 高速zkRollup |
| Halo2 再帰(IPA) | ~0.5秒 | 中 | 不要 | ★★★★☆ | zkSync Era |
| Nova folding | ~50ms | 大(Relaxed R1CS) | 不要 | ★★★☆☆ | IVC全般 |
| Nova + Groth16 | ~50ms+2秒 | 最小(~200B) | 必要 | ★★★☆☆ | オンチェーン最安 |
| Groth16 再帰 | ~2秒 | 最小(~200B) | 必要 | ★★☆☆☆ | 証明集約 |
| RISC Zero | ~30秒(CPU) | 中 | 不要 | ★★☆☆☆ | 任意プログラム |
| SP1 (Succinct) | ~10秒(GPU) | 中 | 不要 | ★★☆☆☆ | 任意プログラム |

---

## 3. Plonky2 実装ガイド

### 環境セットアップ

```toml
# Cargo.toml
[dependencies]
plonky2 = { git = "https://github.com/0xPolygonZero/plonky2", rev = "main" }
anyhow = "1.0"
log = "0.4"

[profile.release]
opt-level = 3
lto = true
```

### 基本的な回路の構築

```rust
use plonky2::{
    field::goldilocks_field::GoldilocksField,
    iop::{
        target::Target,
        witness::{PartialWitness, WitnessWrite},
    },
    plonk::{
        circuit_builder::CircuitBuilder,
        circuit_data::{CircuitConfig, CircuitData},
        config::PoseidonGoldilocksConfig,
        proof::ProofWithPublicInputs,
    },
};

type F = GoldilocksField;
type C = PoseidonGoldilocksConfig;
const D: usize = 2;

struct FibonacciCircuit {
    targets: FibTargets,
    data: CircuitData<F, C, D>,
}

struct FibTargets {
    a: Target,
    b: Target,
    result: Target,
}

impl FibonacciCircuit {
    fn new() -> Self {
        let config = CircuitConfig::standard_recursion_config();
        let mut builder = CircuitBuilder::<F, D>::new(config);

        let a = builder.add_virtual_target();
        let b = builder.add_virtual_target();

        // フィボナッチの1ステップ: result = a + b
        let result = builder.add(a, b);

        // public inputs として登録
        builder.register_public_input(a);
        builder.register_public_input(b);
        builder.register_public_input(result);

        let data = builder.build::<C>();
        Self { targets: FibTargets { a, b, result }, data }
    }

    fn prove(&self, a_val: u64, b_val: u64) -> ProofWithPublicInputs<F, C, D> {
        let mut pw = PartialWitness::new();
        pw.set_target(self.targets.a, F::from_canonical_u64(a_val));
        pw.set_target(self.targets.b, F::from_canonical_u64(b_val));
        // result は回路が自動計算するので set_target 不要
        self.data.prove(pw).expect("証明生成失敗")
    }
}
```

### 再帰回路の構築（コアパターン）

```rust
struct RecursiveCircuit {
    data: CircuitData<F, C, D>,
    proof_target: ProofWithPublicInputsTarget<D>,
    verifier_data_target: VerifierCircuitTarget,
}

impl RecursiveCircuit {
    fn new(inner_data: &CircuitData<F, C, D>) -> Self {
        let config = CircuitConfig::standard_recursion_config();
        let mut builder = CircuitBuilder::<F, D>::new(config);

        // ① 内部証明のターゲットを追加
        let proof_target = builder.add_virtual_proof_with_pis(&inner_data.common);

        // ② ベリファイア回路を埋め込む
        let verifier_data_target = builder.add_virtual_verifier_data(
            inner_data.common.config.fri_config.cap_height,
        );

        // ③ 内部証明の検証を回路の制約として追加
        builder.verify_proof::<C>(
            &proof_target,
            &verifier_data_target,
            &inner_data.common,
        );

        // ④ 内部証明の public inputs を外部に伝播
        let inner_pis = &proof_target.public_inputs;
        for &pi in inner_pis {
            builder.register_public_input(pi);
        }

        let data = builder.build::<C>();
        Self { data, proof_target, verifier_data_target }
    }

    fn prove(
        &self,
        inner_proof: ProofWithPublicInputs<F, C, D>,
        inner_vd: &VerifierOnlyCircuitData<C, D>,
    ) -> ProofWithPublicInputs<F, C, D> {
        let mut pw = PartialWitness::new();

        // 内部証明をwitnessにセット
        pw.set_proof_with_pis_target(&self.proof_target, &inner_proof);
        pw.set_verifier_data_target(&self.verifier_data_target, inner_vd);

        self.data.prove(pw).expect("再帰証明生成失敗")
    }
}
```

### N 段階の再帰証明生成

```rust
async fn generate_n_step_recursive_proof(
    steps: Vec<(u64, u64)>,  // (a, b) のリスト
) -> ProofWithPublicInputs<F, C, D> {
    // ベース回路
    let base = FibonacciCircuit::new();

    // 再帰回路（ベース検証用）
    let recursive = RecursiveCircuit::new(&base.data);

    // ステップ1: ベース証明を生成
    let mut current_proof = base.prove(steps[0].0, steps[0].1);
    let mut current_vd = &base.data.verifier_only;

    // ステップ2以降: 再帰的に証明を積み上げ
    for (a, b) in steps.iter().skip(1) {
        // 前の証明を検証しつつ、新しいステップを証明
        let new_proof = recursive.prove(current_proof, current_vd);
        current_proof = new_proof;
        current_vd = &recursive.data.verifier_only;

        println!("ステップ {} 完了、証明サイズ: {} bytes",
            steps.iter().position(|(x, y)| x == a && y == b).unwrap(),
            bincode::serialize(&current_proof).unwrap().len()
        );
    }

    current_proof
}

// 検証（最終証明1つをオンチェーンで検証）
fn verify_recursive_proof(
    recursive: &RecursiveCircuit,
    proof: &ProofWithPublicInputs<F, C, D>,
) -> bool {
    recursive.data.verify(proof.clone()).is_ok()
}
```

### パフォーマンスチューニング

```rust
// GPU / 並列化の設定
use plonky2::plonk::circuit_data::CircuitConfig;

// 標準的な再帰設定（CPU）
let config = CircuitConfig::standard_recursion_config();

// 高速設定（より多くのFRI folding、より小さい証明）
let fast_config = CircuitConfig {
    num_wires: 135,
    num_routed_wires: 80,
    num_constants: 2,
    use_base_arithmetic_gate: true,
    security_bits: 100,
    num_challenges: 2,
    zero_knowledge: false,
    max_quotient_degree_factor: 8,
    fri_config: FriConfig {
        rate_bits: 3,
        cap_height: 4,
        proof_of_work_bits: 16,
        reduction_strategy: FriReductionStrategy::ConstantArityBits(4, 5),
        num_query_rounds: 28,
    },
};

// マルチスレッド証明（rayon使用）
use rayon::prelude::*;

let proofs: Vec<_> = steps.par_iter()
    .map(|(a, b)| base_circuit.prove(*a, *b))
    .collect();
```

---

## 4. Halo2 再帰設計

### Accumulator を使った Halo2 再帰

```rust
use halo2_proofs::{
    circuit::{Layouter, SimpleFloorPlanner, Value},
    plonk::{Circuit, ConstraintSystem, Error},
    poly::{commitment::Params, ipa::commitment::IPACommitmentScheme},
};
use halo2_wrong_ecc::AssignedPoint;

// Halo2の再帰はAccumulator（accumulation scheme）で実現
// 内部証明のverification keyを回路内に埋め込む

struct RecursiveHalo2Config {
    // 内部証明の検証に必要な設定
    inner_vk: VerifyingKey<Affine>,
    // Accumulator の設定
    accumulator_config: AccumulatorConfig,
}

// halo2-snark-verifier ライブラリを使った再帰
// https://github.com/privacy-scaling-explorations/snark-verifier

use snark_verifier::{
    loader::halo2::Halo2Loader,
    pcs::kzg::{Gwc19, KzgAs},
    system::halo2::{transcript::evm::EvmTranscript, Config},
    verifier::SnarkVerifier,
};

// Inner snark の検証を Halo2 回路に埋め込む
fn embed_verifier_in_circuit<C: Circuit<Fr>>(
    inner_snark: Snark,
    outer_builder: &mut CircuitBuilder<Fr>,
) -> Result<Vec<AssignedValue<Fr>>, Error> {
    let loader = Halo2Loader::new(outer_builder.main(0));

    // snark-verifierでinner snarkを検証する回路を生成
    let output = snark_verifier::verify_snark_in_circuit(
        &loader,
        inner_snark,
    )?;

    Ok(output)
}
```

---

## 5. Nova / Folding スキーム

### Nova の数学的直感

```
通常のSNARK:
N個のステップ → N個の証明 → N回の検証

Nova (Folding):
ステップ1: (証明1, accum0) → accum1  [軽量: ベクトル加算程度]
ステップ2: (証明2, accum1) → accum2  [軽量]
...
ステップN: (証明N, accum_{N-1}) → accumN  [軽量]
最後: accumN → SNARK証明  [1回だけ重い]

→ ステップごとのオーバーヘッド: 楕円曲線スカラー倍 数回 (< 50ms)
→ 証明サイズ: O(1)（N に依存しない）
```

### Nova 実装（microsoft/Nova）

```rust
// Cargo.toml
// nova-snark = { git = "https://github.com/microsoft/Nova" }

use nova_snark::{
    traits::{
        circuit::TrivialCircuit,
        snark::RelaxedR1CSSNARKTrait,
        Group,
    },
    CompressedSNARK, PublicParams, RecursiveSNARK,
};

// Nova は2つの曲線を使う（Pasta cycle: Pallas + Vesta）
type G1 = pasta_curves::pallas::Point;
type G2 = pasta_curves::vesta::Point;

// ステップ回路を定義（StepCircuitトレイトを実装）
#[derive(Clone)]
struct HashChainStep {
    preimage: Option<Vec<u8>>,  // 秘密の入力
}

impl<F: PrimeField> StepCircuit<F> for HashChainStep {
    fn arity(&self) -> usize { 1 }  // 状態は1次元（直前のハッシュ値）

    fn synthesize<CS: ConstraintSystem<F>>(
        &self,
        cs: &mut CS,
        z: &[AllocatedNum<F>],  // 現在の状態（直前ハッシュ）
    ) -> Result<Vec<AllocatedNum<F>>, SynthesisError> {
        // Poseidon(z[0], preimage) を計算
        let preimage = AllocatedNum::alloc(cs.namespace(|| "preimage"), || {
            // preimage から F への変換
            self.preimage.as_ref()
                .map(|p| F::from_repr(p.as_slice().try_into().unwrap()).unwrap())
                .ok_or(SynthesisError::AssignmentMissing)
        })?;

        // Poseidon ハッシュ（Nova では Poseidon が推奨）
        let hash = PoseidonChip::hash(
            cs.namespace(|| "hash"),
            &[z[0].clone(), preimage],
        )?;

        Ok(vec![hash])
    }
}

// N ステップの IVC 証明生成
fn prove_hash_chain(chain: &[Vec<u8>]) -> CompressedSNARK<G1, G2, ...> {
    // Public parameters（Trusted Setup 不要）
    let pp = PublicParams::<G1, G2, C1, C2>::setup(
        &HashChainStep { preimage: None },  // 構造だけ渡す
        &TrivialCircuit::default(),         // G2側は trivial
    );

    let z0_primary = vec![<G1 as Group>::Scalar::ZERO];
    let z0_secondary = vec![<G2 as Group>::Scalar::ZERO];

    // IVC 証明の生成
    let mut rs = RecursiveSNARK::<G1, G2, C1, C2>::new(
        &pp,
        &HashChainStep { preimage: Some(chain[0].clone()) },
        &TrivialCircuit::default(),
        &z0_primary,
        &z0_secondary,
    ).unwrap();

    for preimage in chain.iter().skip(1) {
        rs.prove_step(
            &pp,
            &HashChainStep { preimage: Some(preimage.clone()) },
            &TrivialCircuit::default(),
        ).unwrap();
    }

    // Compressed SNARK に変換（小さい証明として出力）
    let (pk, vk) = CompressedSNARK::<G1, G2, C1, C2, S1, S2>::setup(&pp).unwrap();
    CompressedSNARK::prove(&pp, &pk, &rs).unwrap()
}
```

### SuperNova（複数の異なるステップ関数）

```rust
// SuperNova: Nova を拡張して複数の関数 F1, F2, ... をサポート
// zkVM の命令セットを実装するのに最適

// 各命令を別のステップ関数として定義
enum Instruction {
    Add(u64, u64),
    Mul(u64, u64),
    Hash(Vec<u8>),
    // ...
}

// SuperNova では各命令が別の StepCircuit
// プログラムカウンタ（状態の一部）が次の命令を選択

use nova_snark::supernova::{NonUniformCircuit, StepCircuit};

struct VMExecution {
    instruction: Option<Instruction>,
}

impl NonUniformCircuit<G1, G2> for VMExecution {
    fn num_circuits(&self) -> usize { 3 }  // 命令の種類数

    fn primary_circuit(&self, circuit_index: usize) -> C1 {
        match circuit_index {
            0 => AddCircuit::new(self.instruction.clone()),
            1 => MulCircuit::new(self.instruction.clone()),
            2 => HashCircuit::new(self.instruction.clone()),
            _ => panic!("Unknown circuit")
        }
    }
}
```

---

## 6. zkVM（RISC Zero / SP1）

### RISC Zero: 任意の Rust プログラムを ZKP で証明

```bash
# セットアップ
curl -L https://risczero.com/install | bash
rzup install

# プロジェクト作成
cargo risczero new my_project --guest-name my_guest
cd my_project
```

```rust
// methods/guest/src/main.rs（zkVM内で実行されるプログラム）
#![no_main]
risc0_zkvm::guest::entry!(main);

use risc0_zkvm::guest::env;

fn main() {
    // Private input の読み込み
    let private_data: Vec<u64> = env::read();

    // 任意の複雑な計算（通常のRustコードとして記述）
    let result = complex_computation(&private_data);

    // Public output としてコミット
    env::commit(&result);
    // 重要: commit した値だけが証明の public inputs になる
    // private_data は外部に漏れない
}

fn complex_computation(data: &[u64]) -> u64 {
    // ここには任意のRustコードを書ける
    // ソートでも、暗号計算でも、ML推論でも
    data.iter().sum::<u64>().pow(2)
}
```

```rust
// src/main.rs（ホスト側: 証明生成）
use risc0_zkvm::{default_prover, ExecutorEnv, Receipt};

fn generate_proof(private_data: Vec<u64>) -> Receipt {
    let env = ExecutorEnv::builder()
        .write(&private_data)  // private input の送信
        .unwrap()
        .build()
        .unwrap();

    // ELF バイナリ（ゲストコードのコンパイル結果）
    let prover = default_prover();
    let receipt = prover
        .prove(env, MY_GUEST_ELF)  // MY_GUEST_ELF は自動生成される定数
        .unwrap()
        .receipt;

    receipt
}

fn verify_proof(receipt: &Receipt) -> u64 {
    // 証明の検証
    receipt.verify(MY_GUEST_ID).expect("証明が無効");

    // Public outputs の取得
    receipt.journal.decode::<u64>().unwrap()
}
```

### SP1（Succinct Labs）: より高速で Ethereum フレンドリー

```bash
# セットアップ
curl -L https://sp1.succinct.xyz | bash
sp1up
```

```rust
// program/src/main.rs（zkVM内のプログラム）
#![no_main]
sp1_zkvm::entrypoint!(main);

pub fn main() {
    // Private inputs
    let n: u32 = sp1_zkvm::io::read::<u32>();
    let secret_key: [u8; 32] = sp1_zkvm::io::read::<[u8; 32]>();

    // 複雑な計算（例: BLS署名検証）
    let public_key = derive_public_key(&secret_key);
    let signature = sign(secret_key, n);

    // Public outputs: 秘密鍵は漏らさずに署名が正しいことを証明
    sp1_zkvm::io::commit(&public_key);
    sp1_zkvm::io::commit(&signature);
    sp1_zkvm::io::commit(&n);
}
```

```rust
// script/src/main.rs（ホスト側）
use sp1_sdk::{ProverClient, SP1ProofWithPublicValues, SP1Stdin};

const ELF: &[u8] = include_bytes!("../program/elf/program");

async fn main() {
    let client = ProverClient::new();
    let (pk, vk) = client.setup(ELF);

    let mut stdin = SP1Stdin::new();
    stdin.write(&42u32);
    stdin.write(&[0u8; 32]);  // 秘密鍵（証明から漏れない）

    // Plonky3 バックエンドで高速証明
    let proof = client.prove(&pk, stdin).run().unwrap();

    // Solidity Verifier 用の EVM 証明を生成
    let proof_evm = client.prove(&pk, stdin).evm().run().unwrap();

    client.verify(&proof, &vk).unwrap();
    println!("SP1証明成功！");

    // Solidity 検証コントラクトへの送信
    println!("EVM calldata: {:?}", proof_evm.bytes());
}
```

---

## 7. 証明集約（Proof Aggregation）

### Groth16 証明の集約

多数のユーザーが個別に生成した Groth16 証明を、1回のオンチェーン検証でまとめて処理する。

```rust
// bellman を使ったGroth16証明の集約
// または snarkjs の groth16.fullProve + aggregate

// JavaScript での集約（@groth16-aggregation）
import { aggregate } from "@groth16-aggregation";

const proofs = await Promise.all(
    userInputs.map(input => groth16.fullProve(input, wasmFile, zkeyFile))
);

// N個の証明を1つに集約
const aggregatedProof = await aggregate(
    proofs.map(p => p.proof),
    proofs.map(p => p.publicSignals),
    aggregationKey  // 集約用のkey
);

// オンチェーンで1回だけ検証
await contract.verifyAggregated(
    aggregatedProof,
    allPublicSignals.flat()
);
```

### zkRollup における証明集約アーキテクチャ

```
[ユーザーたち]
 tx1, tx2, ..., tx64 → [Sequencer]
                              ↓
                    [バッチ証明生成 (Plonky2)]
                     tx1..32 → proof_A (0.5秒)
                     tx33..64 → proof_B (0.5秒)
                              ↓
                    [集約 (再帰的証明)]
                    proof_A + proof_B → proof_AB (0.3秒)
                              ↓
                    [L1 オンチェーン検証]
                    1回の verifyProof (~250K gas)
```

---

## 8. 設計パターンとアーキテクチャ

### パターン1: リーフ + 再帰ツリー（Plonky2推奨）

```
深さ4の再帰ツリーで 2^4 = 16個の証明を1つに集約:

Layer 0 (Leaf):  P1  P2  P3  P4  P5  P6  P7  P8  P9 P10 P11 P12 P13 P14 P15 P16
Layer 1 (Rec):    R1      R2      R3      R4      R5      R6      R7      R8
Layer 2 (Rec):        RR1             RR2             RR3             RR4
Layer 3 (Root):                   Root
                                    ↓
                            (1回 on-chain verify)
```

```rust
fn build_recursive_tree(
    base_proofs: Vec<ProofWithPublicInputs<F, C, D>>,
    base_data: &CircuitData<F, C, D>,
) -> ProofWithPublicInputs<F, C, D> {
    let recursive = RecursiveCircuit::new_pair(base_data);

    let mut current_layer = base_proofs;

    while current_layer.len() > 1 {
        // 並列で再帰証明を生成（rayon）
        let next_layer: Vec<_> = current_layer
            .par_chunks(2)
            .map(|pair| {
                recursive.prove_pair(&pair[0], &pair[1])
            })
            .collect();
        current_layer = next_layer;
    }

    current_layer.into_iter().next().unwrap()
}
```

### パターン2: ストリーミング IVC（Nova推奨）

```
リアルタイムで新しい証明を「折り畳む」:

Event 1 → accum_1
Event 2 → accum_2
...
Event N → accum_N → CompressedSNARK（最後だけオンチェーン）

ユースケース:
- リアルタイムゲームの公正性証明
- ストリーミングデータのリアルタイム集計
- 継続的な機械学習モデルの更新証明
```

### パターン3: zkVM パイプライン（RISC Zero / SP1推奨）

```
任意のプログラム実行を証明するパイプライン:

プログラム(Rust) → コンパイル → RISC-V ELF
                                    ↓
                          zkVM 実行 + 証明生成
                                    ↓
                          Receipt (証明 + public outputs)
                                    ↓
                          オンチェーン or オフチェーン検証

適用例:
- 機械学習推論結果の証明（モデルを秘匿）
- オラクルデータの正確性証明
- ゲームロジックの公正性証明（完全な状態遷移を証明）
```

---

## 9. テスト戦略

### Plonky2 回路のテスト

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::Result;

    #[test]
    fn test_base_circuit() -> Result<()> {
        let base = FibonacciCircuit::new();
        let proof = base.prove(1, 1);

        // 証明の検証
        base.data.verify(proof.clone())?;

        // Public inputs の確認
        let pis = &proof.public_inputs;
        assert_eq!(pis[0], F::from_canonical_u64(1));  // a
        assert_eq!(pis[1], F::from_canonical_u64(1));  // b
        assert_eq!(pis[2], F::from_canonical_u64(2));  // result = a + b

        Ok(())
    }

    #[test]
    fn test_recursive_circuit() -> Result<()> {
        let base = FibonacciCircuit::new();
        let recursive = RecursiveCircuit::new(&base.data);

        // ベース証明
        let base_proof = base.prove(1, 1);

        // 再帰証明（ベース証明を検証する証明）
        let rec_proof = recursive.prove(base_proof, &base.data.verifier_only);

        // 再帰証明の検証
        recursive.data.verify(rec_proof.clone())?;
        println!("再帰証明サイズ: {} bytes",
            bincode::serialize(&rec_proof)?.len());

        Ok(())
    }

    #[test]
    fn test_n_step_recursion() -> Result<()> {
        let steps = vec![(1u64, 1), (1, 2), (2, 3), (3, 5), (5, 8)];

        let final_proof = generate_n_step_recursive_proof(steps)?;

        // N段の再帰後でも証明サイズが一定であることを確認
        let size = bincode::serialize(&final_proof)?.len();
        println!("{}段の再帰証明サイズ: {} bytes", 5, size);
        assert!(size < 1_000_000);  // 1MB未満

        Ok(())
    }

    #[test]
    fn test_proof_generation_time() -> Result<()> {
        use std::time::Instant;

        let base = FibonacciCircuit::new();
        let recursive = RecursiveCircuit::new(&base.data);

        // ベース証明の時間計測
        let t = Instant::now();
        let base_proof = base.prove(42, 69);
        println!("ベース証明生成: {:?}", t.elapsed());

        // 再帰証明の時間計測
        let t = Instant::now();
        let _rec_proof = recursive.prove(base_proof, &base.data.verifier_only);
        println!("再帰証明生成: {:?}", t.elapsed());

        // CPU で数秒以内であることを確認
        assert!(t.elapsed().as_secs() < 30);

        Ok(())
    }
}
```

### SP1 / RISC Zero のテスト

```rust
#[cfg(test)]
mod tests {
    use sp1_sdk::{ProverClient, SP1Stdin};
    const ELF: &[u8] = include_bytes!("../program/elf/program");

    #[test]
    fn test_execution_only() {
        // 証明なしで実行だけテスト（高速）
        let client = ProverClient::new();
        let mut stdin = SP1Stdin::new();
        stdin.write(&42u32);

        // execute は証明を生成しないので高速
        let (output, _) = client.execute(ELF, stdin).run().unwrap();
        let result: u64 = output.decode().unwrap();
        assert_eq!(result, fibonacci(42));
    }

    #[test]
    fn test_proof_verification() {
        // 実際に証明を生成して検証（重いのでCI環境では条件付きで実行）
        if std::env::var("RUN_HEAVY_TESTS").is_err() {
            return;
        }

        let client = ProverClient::new();
        let (pk, vk) = client.setup(ELF);
        let mut stdin = SP1Stdin::new();
        stdin.write(&10u32);

        let proof = client.prove(&pk, stdin).run().unwrap();
        client.verify(&proof, &vk).expect("証明検証失敗");
    }
}
```
