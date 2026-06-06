---
name: zero-knowledge-proofs
description: |
  ゼロ知識証明（ZKP）を使ったプロダクトの設計・回路実装・テスト・セキュリティ審査・オンチェーン統合を包括的に支援するスキル。

  **必ずこのスキルを使うべきシーン（1%でも当てはまれば即起動）：**
  - 「ゼロ知識証明を使いたい」「ZKPを実装したい」「zk-SNARKs/STARKsを使う」と言われたとき
  - Circom / snarkJS / Halo2 / Plonky2 / Noir / gnark / ZoKrates の実装・設計を求められたとき
  - zkRollup・zkEVM・Layer2スケーリングソリューションの設計・開発
  - プライバシー保護（匿名認証・秘匿トランザクション・プライベートVoting）
  - 回路（Circuit）の設計・実装・デバッグ・テスト
  - ZKP回路のセキュリティ審査・脆弱性発見（under-constrained / over-constrained）
  - Solidityの検証コントラクト（Verifier Contract）の生成・統合
  - Groth16 / PLONK / FFLONK / Halo2 の選択・比較・最適化
  - trusted setup セレモニーの設計・実行
  - ZKPプロダクトのアーキテクチャ設計・レビュー
  - **再帰型証明（Recursive ZKP / IVC）の設計・実装**
  - Plonky2 / Halo2 / Nova / SuperNova による再帰証明
  - zkEVM・zkVM（RISC Zero / SP1）の設計・活用
  - Folding scheme（Nova / HyperNova）の理論と実装
  - 「circom」「snarkjs」「proof」「witness」「R1CS」「constraint」というキーワードが出るとき
  - 「再帰」「recursive」「IVC」「folding」「zkVM」というキーワードが出るとき
---

# Zero-Knowledge Proofs (ZKP) Development Skill

ZKPプロダクトを設計から本番デプロイまで一気通貫で支援する。
このスキルを起動したら、ZKPの専門家として完全にコミットして作業する。

## ZKPプロダクト開発の全体フロー

```
[要件定義] → [証明スキーム選択] → [回路設計] → [実装] → [テスト] → [セキュリティ審査] → [オンチェーン統合]
                    ↓ 再帰証明が必要な場合
              [再帰スキーム選択] → [IVC/Folding設計] → [再帰回路実装] → [集約・検証]
```

---

## フェーズ1: 要件ヒアリングと証明スキーム選択

### まず確認すること

```
1. 何を「知らずに証明」したいか？
   例：「年齢18歳以上を証明（生年月日を秘匿）」
       「残高が閾値以上（金額非公開）」
       「特定のMerkle treeのメンバー（IDを秘匿）」

2. 対象ブロックチェーンは？
   - Ethereum mainnet → ガスコストを最優先で考慮
   - zkSync/Polygon/Starknet など Layer2 → 各チェーンのネイティブ証明形式を確認
   - オフチェーン検証のみ → コストを無視して精度・速度優先

3. Trusted Setup は許容できるか？
   - No → STARKs / Halo2 / Plonky2（透明性あり）
   - Yes → Groth16（最小証明サイズ）/ PLONK（ユニバーサル）

4. パフォーマンス要件は？
   - 証明生成時間（ユーザー端末で < 5秒？サーバーで < 1分？）
   - 証明サイズ（オンチェーン検証コスト）
   - 再帰証明が必要か（zkRollup等）

5. チームのスキルセットは？
   - JavaScript/TypeScript → Circom + snarkJS（最もエコシステムが豊富）
   - Rust → Halo2 / Plonky2 / Bellman
   - Go → gnark
   - 汎用ライクな構文 → Noir（Aztec）
```

### 証明スキーム選択ガイド

| スキーム | 証明サイズ | 証明速度 | Trusted Setup | 量子耐性 | 主な用途 |
|---------|-----------|---------|--------------|---------|---------|
| **Groth16** | 最小(~200B) | 速い | 必要（回路固定） | ✗ | Tornado Cash, Zcash |
| **PLONK** | 小(~500B) | 速い | 1回で再利用可 | ✗ | 汎用 zkDApp |
| **Halo2** | 中 | 速い | 不要 | ✗ | zkSync, Zcash Orchard |
| **Plonky2** | 中 | 非常に速い | 不要 | △(FRI) | Polygon zkEVM |
| **STARKs** | 大(~100KB) | 速い | 不要 | ◎ | StarkNet |
| **Bulletproofs** | 中 | 遅い | 不要 | ✗ | 範囲証明 |

**意思決定ツリー**：
```
Ethereumでオンチェーン検証必要？
├─ Yes, ガス最小化優先 → Groth16 (Circom)
├─ Yes, 柔軟性優先 → PLONK (Circom + FFLONK)
└─ No, スケーリング優先 → Plonky2 / Halo2

Trusted Setup が許容できない？
└─ → STARKs / Halo2 / Plonky2

Rust プロジェクト？
└─ → Halo2 または Plonky2

JS/TS プロジェクト？
└─ → Circom + snarkJS（推奨デフォルト）
```

詳細比較 → `references/zkp-fundamentals.md`

---

## フェーズ2: 回路設計

### Circom回路設計の黄金律

```circom
pragma circom 2.1.6;

// テンプレートは「再利用可能な回路部品」
template RangeCheck(n) {
    signal input in;        // public or private
    signal input max;       // 比較対象
    signal output out;      // 出力

    // ⚠️ <-- は代入のみ（制約なし）
    // === は制約の追加
    // <== は代入 + 制約（最も安全）

    component lt = LessEqThan(n);
    lt.in[0] <== in;
    lt.in[1] <== max;
    out <== lt.out;
}

// メインコンポーネント: publicInputsを明示
component main {public [max]} = RangeCheck(32);
```

### 回路設計チェックリスト（実装前に必ず確認）

```
□ 証明したい命題を「数学的制約式」として表現できるか
□ public input / private input（witness）を明確に分けているか
□ 各シグナルが適切に制約されているか（under-constrained チェック）
□ 使用するハッシュ関数はフィールド演算に適切か（Poseidon推奨）
□ Merkle treeが必要なら木の深さは？（circomlibのMerkle使用を検討）
□ ビット分解が必要な演算は正しく制約されているか
□ オーバーフロー（フィールドサイズ超過）のリスクはないか
```

詳細な実装パターン → `references/circom-development.md`

---

## フェーズ3: 実装とテスト

### 開発環境セットアップ

```bash
# Circom インストール（Rust製）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
git clone https://github.com/iden3/circom
cd circom && cargo build --release
sudo mv target/release/circom /usr/local/bin/

# snarkJS + 開発ツール
npm install -g snarkjs
npm install --save-dev circom_tester mocha chai

# Hardhat プロジェクト（Solidity統合）
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install hardhat-circom
```

### 証明生成フロー（Groth16）

```bash
# 1. コンパイル
circom circuit.circom --r1cs --wasm --sym --c

# 2. Powers of Tau（trusted setup Phase 1）
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau

# 3. Groth16 setup（trusted setup Phase 2）
snarkjs groth16 setup circuit.r1cs pot12_final.ptau circuit_0000.zkey
snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey

# 4. Witness生成
node circuit_js/generate_witness.js circuit_js/circuit.wasm input.json witness.wtns

# 5. 証明生成
snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json

# 6. 検証
snarkjs groth16 verify verification_key.json public.json proof.json

# 7. Solidity Verifier生成
snarkjs zkey export solidityverifier circuit_final.zkey verifier.sol
```

### テスト実装

```javascript
const { expect } = require("chai");
const { wasm: wasmTester } = require("circom_tester");

describe("RangeCheck Circuit", () => {
    let circuit;

    before(async () => {
        circuit = await wasmTester("circuits/range_check.circom");
    });

    it("正常なinputで証明が生成できる", async () => {
        const input = { in: 10, max: 100 };
        const witness = await circuit.calculateWitness(input);
        await circuit.checkConstraints(witness);
        // output = 1 (10 <= 100)
        expect(witness[1]).to.equal(1n);
    });

    it("範囲外のinputで証明に失敗する", async () => {
        const input = { in: 200, max: 100 };
        // 不正な証明は生成できないことを確認
        await expect(circuit.calculateWitness(input))
            .to.be.rejected;
    });

    it("制約数を確認（パフォーマンス指標）", async () => {
        // 制約数が期待値内か確認
        const r1cs = await circuit.loadR1cs();
        console.log(`制約数: ${r1cs.nConstraints}`);
        expect(r1cs.nConstraints).to.be.lessThan(10000);
    });
});
```

---

## フェーズ4: セキュリティ審査

ZKP回路の脆弱性は通常のスマートコントラクトとは異なる。
**必ず `references/security-audit.md` を読んでから審査を開始する。**

### 最重要脆弱性トップ5

| 脆弱性 | 危険度 | 概要 |
|--------|--------|------|
| Under-constrained Signal | 🔴 Critical | 制約なしのシグナルに任意値を代入可能 |
| assert の誤用 | 🔴 Critical | `assert`はR1CSに制約を追加しない |
| 代入演算子の混同 | 🔴 Critical | `<--`（代入のみ）と`<==`（制約付き）の混同 |
| 算術オーバーフロー | 🟠 High | フィールドサイズを超えた演算でのラップアラウンド |
| 安全でない回路再利用 | 🟠 High | Templateの誤用でunder-constrainedになる |

### 静的解析ツール

```bash
# Circomspect（Trail of Bits製）
cargo install circomspect
circomspect circuits/your_circuit.circom

# ZKAP（より高精度）
# https://github.com/chyanju/zkap

# Echidna-ZK（ファジング）
# https://github.com/crytic/echidna
```

詳細な審査チェックリスト → `references/security-audit.md`

---

## フェーズ5: オンチェーン統合

### Solidity Verifier のデプロイ

```javascript
// hardhat.config.js
require("hardhat-circom");

module.exports = {
    circom: {
        inputBasePath: "./circuits",
        ptau: "hermez-rawFinal.ptau",
        circuits: [
            {
                name: "your_circuit",
                protocol: "groth16",
                circuit: "your_circuit.circom",
                input: "input.json"
            }
        ]
    }
};
```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./verifier.sol";  // snarkjsが生成したVerifier

contract ZKApp is Groth16Verifier {
    event ProofVerified(address indexed prover, uint256[] publicInputs);

    function submitProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[1] memory publicSignals  // public inputsのみ公開
    ) external returns (bool) {
        require(verifyProof(a, b, c, publicSignals), "Invalid ZK proof");
        emit ProofVerified(msg.sender, publicSignals);
        return true;
    }
}
```

---

## フェーズ6: 再帰型証明（Recursive ZKP）

再帰型証明が必要かどうかを先に判断する。不要なら飛ばしてよい。

### 再帰型証明が必要なシーン

```
以下のいずれかに該当 → 再帰型証明を検討する

1. 大量の計算をまとめて1つの証明にしたい
   → zkRollup でバッチ100→1000→10000件にスケールしたい

2. 長時間実行される計算を証明したい
   → 数時間かかるプログラムの「正しく実行した」証明

3. 複数の証明を1つに集約したい（Proof Aggregation）
   → 複数ユーザーの証明をまとめてオンチェーンで1回検証

4. クロスチェーン証明
   → Chain Aの状態をChain Bで証明する（zkBridge）

5. zkEVM / zkVM
   → EVM実行の正しさをZKPで証明
```

### 再帰スキームの選択

| スキーム | 言語 | Trusted Setup | 特徴 | 推奨用途 |
|---------|------|--------------|------|---------|
| **Plonky2** | Rust | 不要(FRI) | 最高速（< 1秒で再帰） | Polygon zkEVM |
| **Halo2 (IPA)** | Rust | 不要 | 安定・実績豊富 | zkSync Era |
| **Nova** | Rust | 不要 | Folding scheme、軽量 | IVC全般 |
| **SuperNova** | Rust | 不要 | Novaの多命令版 | zkVM |
| **HyperNova** | Rust | 不要 | 最新・理論的に優れる | 研究・最先端 |
| **Groth16 再帰** | Circom | 必要 | 実績・エコあり | 証明集約(aggregation) |

**意思決定ツリー**:
```
速度最優先（< 1秒の再帰）？ → Plonky2
Trusted Setup 不要 + Ethereum互換？ → Halo2 または Plonky2
任意プログラムを証明したい（zkVM）？ → RISC Zero / SP1 (Succinct)
Circomエコシステムを使いたい？ → Groth16 再帰（snarkjs）
研究・最先端の手法？ → Nova / HyperNova
```

詳細な設計・実装パターン → `references/recursive-zkp.md`

### Plonky2 クイックスタート（最推奨）

```rust
// Cargo.toml
// plonky2 = "0.2"
// anyhow = "1.0"

use plonky2::{
    field::goldilocks_field::GoldilocksField,
    plonk::{
        circuit_builder::CircuitBuilder,
        circuit_data::CircuitConfig,
        config::PoseidonGoldilocksConfig,
        proof::ProofWithPublicInputs,
    },
    iop::witness::{PartialWitness, WitnessWrite},
};

type F = GoldilocksField;
type C = PoseidonGoldilocksConfig;
const D: usize = 2;

// ベース回路: 「x^2 = y を知っている」を証明
fn build_base_circuit() -> (CircuitData<F, C, D>, CircuitTargets) {
    let config = CircuitConfig::standard_recursion_config();
    let mut builder = CircuitBuilder::<F, D>::new(config);

    let x = builder.add_virtual_target();        // private input
    let y = builder.add_virtual_public_input();  // public output

    let x_sq = builder.mul(x, x);
    builder.connect(x_sq, y);  // 制約: x^2 == y

    let data = builder.build::<C>();
    (data, CircuitTargets { x, y })
}

// 再帰回路: ベース証明を検証する証明を生成
fn build_recursive_circuit(
    inner_data: &CircuitData<F, C, D>
) -> CircuitData<F, C, D> {
    let config = CircuitConfig::standard_recursion_config();
    let mut builder = CircuitBuilder::<F, D>::new(config);

    // 内部証明の検証器を回路内に埋め込む
    let verifier_data = builder.add_virtual_verifier_data(
        inner_data.common.config.fri_config.cap_height
    );
    let proof_with_pis = builder.add_virtual_proof_with_pis(&inner_data.common);

    // 証明が有効であることを制約として追加
    builder.verify_proof::<C>(
        &proof_with_pis,
        &verifier_data,
        &inner_data.common
    );

    builder.build::<C>()
}
```

### Nova Folding スキームのコンセプト

```rust
// Nova: Incrementally Verifiable Computation (IVC) の実装例
// https://github.com/microsoft/Nova

use nova_snark::{
    traits::{circuit::StepCircuit, Group},
    PublicParams, RecursiveSNARK,
};

// ステップ関数: z_{i+1} = f(z_i, w_i)
// z: 公開状態、w: ステップのwitness
#[derive(Clone)]
struct MyStepCircuit {
    step_input: Option<F>,  // w_i（各ステップの秘密入力）
}

impl StepCircuit<F> for MyStepCircuit {
    fn arity(&self) -> usize { 1 }  // 状態ベクトルの次元

    fn synthesize<CS: ConstraintSystem<F>>(
        &self,
        cs: &mut CS,
        z: &[AllocatedNum<F>]  // z_i
    ) -> Result<Vec<AllocatedNum<F>>, SynthesisError> {
        // z_{i+1} = z_i + w_i を計算する回路
        let w = AllocatedNum::alloc(cs.namespace(|| "w"), || {
            self.step_input.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let z_next = AllocatedNum::alloc(cs.namespace(|| "z_next"), || {
            Ok(*z[0].get_value().unwrap() + *w.get_value().unwrap())
        })?;
        cs.enforce(
            || "z_next = z + w",
            |lc| lc + z[0].get_variable() + w.get_variable(),
            |lc| lc + CS::one(),
            |lc| lc + z_next.get_variable(),
        );
        Ok(vec![z_next])
    }
}

// N ステップの IVC 証明生成
async fn generate_ivc_proof(steps: Vec<F>) -> RecursiveSNARK<G1, G2, C1, C2> {
    let pp = PublicParams::<G1, G2, C1, C2>::setup(&circuit, &circuit_secondary);
    let z0 = vec![F::ZERO];  // 初期状態

    let mut recursive_snark = RecursiveSNARK::new(&pp, &circuit, &circuit_secondary, z0);

    for (i, w) in steps.iter().enumerate() {
        recursive_snark.prove_step(&pp, &MyStepCircuit { step_input: Some(*w) });
        // 各ステップが O(1) の証明コスト（Novaの強み）
    }
    recursive_snark
}
```

### zkVM の活用（任意のRustプログラムをZKPで証明）

```bash
# RISC Zero: Rust プログラムをゼロ知識証明で実行
cargo install cargo-risczero
cargo risczero new my_zkvm_project

# SP1 (Succinct Labs): ELFバイナリから証明生成
cargo install cargo-prove
cargo prove new my_sp1_project
```

```rust
// SP1で「フィボナッチ数列の第N項を秘密のNから計算した」証明
// guest/src/main.rs（zkVM内で実行されるプログラム）
#![no_main]
sp1_zkvm::entrypoint!(main);

pub fn main() {
    let n: u32 = sp1_zkvm::io::read();  // private input（秘密のN）
    let result = fibonacci(n);
    sp1_zkvm::io::commit(&result);       // public output（検証可能な結果）
}

fn fibonacci(n: u32) -> u64 {
    let (mut a, mut b) = (0u64, 1u64);
    for _ in 0..n { (a, b) = (b, a + b); }
    a
}

// host/src/main.rs（証明生成）
use sp1_sdk::{ProverClient, SP1Stdin};

fn main() {
    let client = ProverClient::new();
    let mut stdin = SP1Stdin::new();
    stdin.write(&42u32);  // フィボナッチ第42項を秘密に証明

    let (pk, vk) = client.setup(include_bytes!("../elf/guest"));
    let proof = client.prove(&pk, stdin).run().unwrap();

    client.verify(&proof, &vk).unwrap();
    println!("証明成功: 第42項 = {}", proof.public_values.read::<u64>());
}
```

---

## フェーズ7: コードレビュー観点

ZKPコードレビュー時は以下を必ず確認する：

1. **回路の完全性**: 証明したい命題が全て制約に反映されているか
2. **Under-constrained チェック**: circomspectの静的解析を実行したか
3. **Trusted Setup**: PTAUファイルの信頼性・Contributionの数
4. **Witness生成の安全性**: witness計算ロジックに秘密情報漏洩がないか
5. **Verifier Contract**: 生成されたSolidityが改ざんされていないか
6. **フィールドサイズ**: 入力値がフィールドサイズ（BN128: 2^254）を超えないか
7. **Public/Private分離**: 公開すべきでない情報がpublic inputになっていないか
8. **テストカバレッジ**: 正常系・異常系・境界値・悪意のある入力

---

## サブエージェント活用

| サブエージェント | 起動タイミング |
|---|---|
| `agents/circuit-designer.md` | 回路設計・制約の数学的モデリング |
| `agents/security-auditor.md` | セキュリティ審査・脆弱性発見 |
| `agents/integrator.md` | オンチェーン統合・Solidityコントラクト |
| `references/recursive-zkp.md` | 再帰型証明・IVC・Folding・zkVM の詳細設計時 |

---

## ユースケース別クイックスタート

詳細な実装パターン → `references/use-cases.md`

| ユースケース | 主要技術 | 難易度 |
|------------|---------|--------|
| 年齢証明 (Age Verification) | Circom + MerkleTree | 入門 |
| 残高証明 (Balance Proof) | Circom + RangeCheck | 入門 |
| 秘匿投票 (Private Voting) | Circom + MACI | 中級 |
| zkRollup の基礎 | Circom + BatchTransfer | 上級 |
| zkLogin / 匿名認証 | Circom + Semaphore | 中級 |
| Private DeFi | Tornado Cash パターン | 上級 |
| **再帰的証明集約** | Plonky2 / Halo2 | 上級 |
| **IVC (長時間計算証明)** | Nova / SuperNova | 上級 |
| **任意プログラムのZK証明** | RISC Zero / SP1 (zkVM) | 中級〜上級 |
| **zkBridge (クロスチェーン)** | SP1 + Plonky2 | 上級 |
