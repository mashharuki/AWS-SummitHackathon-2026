# Circom開発実践ガイド

## 目次
1. [Circom言語の基礎](#1-circom言語の基礎)
2. [circomlibの主要コンポーネント](#2-circomlibの主要コンポーネント)
3. [実装パターン集](#3-実装パターン集)
4. [JavaScript/TypeScript統合](#4-javascripttypescript統合)
5. [Hardhat統合](#5-hardhat統合)
6. [パフォーマンス最適化](#6-パフォーマンス最適化)

---

## 1. Circom言語の基礎

### シグナルの種類と使い分け

```circom
pragma circom 2.1.6;

template Basics() {
    // 外部入力シグナル（proverが提供）
    signal input private_data;   // プライベート（witness）
    signal input public_value;   // パブリック（main宣言で指定）

    // 内部シグナル（中間値）
    signal intermediate;

    // 出力シグナル（パブリック）
    signal output result;

    // ❌ 危険: 代入のみ、制約なし（悪意あるproverが任意値を代入可能）
    intermediate <-- private_data * private_data;
    intermediate === private_data * private_data;  // 別途制約が必要

    // ✅ 安全: 代入と制約を同時に設定
    result <== private_data + public_value;

    // 変数（コンパイル時に解決、制約に影響しない）
    var computed = 42;
}

// publicInputsで公開するシグナルを指定
component main {public [public_value]} = Basics();
```

### 制約生成のルール

```circom
// ✅ 有効な制約（二次式まで）
a === b * c;        // 乗算（1制約）
a <== b + c;        // 加算（制約なし、R1CSでは自由）
a <== b * c + d;    // 乗算+加算

// ❌ 無効（三次以上は直接書けない）
// a === b * c * d;  → コンパイルエラー

// ✅ 正しいやり方: 中間変数を使う
signal tmp;
tmp <== b * c;
a <== tmp * d;

// 変数（var）は制約を生成しない
var k = 5;  // これは単なるコンパイル時定数
```

### if文とforループ

```circom
template ConditionalExample(n) {
    signal input sel;   // 0 or 1
    signal input a;
    signal input b;
    signal output out;

    // if文（変数に対してのみ使用可能）
    // ❌ シグナルに対してif文は使えない
    // if (sel) { out <== a; } else { out <== b; }  // エラー

    // ✅ 条件選択はMuxコンポーネントを使う
    component mux = Mux1();
    mux.c[0] <== a;
    mux.c[1] <== b;
    mux.s <== sel;
    out <== mux.out;
}

template ArraySum(n) {
    signal input arr[n];
    signal output sum;

    // forループ（コンパイル時展開）
    signal running[n+1];
    running[0] <== 0;
    for (var i = 0; i < n; i++) {
        running[i+1] <== running[i] + arr[i];
    }
    sum <== running[n];
}
```

---

## 2. circomlibの主要コンポーネント

```bash
npm install circomlib
```

### 比較・判定

```circom
include "circomlib/circuits/comparators.circom";

// n: ビット数（比較する数値の最大ビット幅）
// IsZero: in が 0 なら out = 1、それ以外は out = 0
component isZero = IsZero();
isZero.in <== a;

// IsEqual: in[0] == in[1] なら out = 1
component eq = IsEqual();
eq.in[0] <== a;
eq.in[1] <== b;

// LessEqThan: in[0] <= in[1] なら out = 1
component lte = LessEqThan(32);  // 32bit数値の比較
lte.in[0] <== value;
lte.in[1] <== threshold;

// GreaterThan / LessThan / GreaterEqThan も同様
```

### ビット変換

```circom
include "circomlib/circuits/bitify.circom";

// Num2Bits: 数値をnビットに分解
component n2b = Num2Bits(32);
n2b.in <== value;
// n2b.out[0] = LSB, n2b.out[31] = MSB

// Bits2Num: ビット列を数値に変換
component b2n = Bits2Num(32);
for (var i = 0; i < 32; i++) {
    b2n.in[i] <== bits[i];
}
signal result;
result <== b2n.out;
```

### ハッシュ関数

```circom
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mimcsponge.circom";

// Poseidon（推奨: ZKP効率最高）
component poseidon = Poseidon(2);
poseidon.inputs[0] <== left;
poseidon.inputs[1] <== right;
signal hash;
hash <== poseidon.out;

// MiMC（Poseidon代替）
component mimc = MiMCSponge(2, 220, 1);
mimc.ins[0] <== left;
mimc.ins[1] <== right;
mimc.k <== 0;
signal mimc_hash;
mimc_hash <== mimc.outs[0];
```

### Merkle Tree証明

```circom
include "circomlib/circuits/merkleProof.circom";
include "circomlib/circuits/poseidon.circom";

template MembershipProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];   // 0=left, 1=right
    signal input root;

    component tree = MerkleProof(levels);
    tree.leaf <== leaf;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // 計算されたルートが期待値と一致するか
    root === tree.root;
}

component main {public [root]} = MembershipProof(20);
```

### デジタル署名（EdDSA）

```circom
include "circomlib/circuits/eddsa.circom";

template VerifySignature() {
    signal input Ax;    // 公開鍵 x
    signal input Ay;    // 公開鍵 y
    signal input S;     // 署名 S
    signal input R8x;   // 署名 R x
    signal input R8y;   // 署名 R y
    signal input M;     // メッセージ

    component eddsa = EdDSAMiMCVerifier();
    eddsa.enabled <== 1;
    eddsa.Ax <== Ax;
    eddsa.Ay <== Ay;
    eddsa.S <== S;
    eddsa.R8x <== R8x;
    eddsa.R8y <== R8y;
    eddsa.M <== M;
}
```

---

## 3. 実装パターン集

### パターン1: 年齢証明（Age Verification）

```circom
pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

// 証明: 「生年月日を秘匿したまま、現在年齢が18歳以上であることを証明」
template AgeVerification() {
    // Private inputs（プロバーのみが知る）
    signal input birthYear;       // 生年
    signal input birthMonth;      // 生月
    signal input birthDay;        // 生日
    signal input identitySecret;  // IDのシークレット（Merkle leafとして使用）

    // Public inputs（検証者も知る）
    signal input currentYear;     // 現在年
    signal input currentMonth;    // 現在月
    signal input minimumAge;      // 最低年齢（通常18）
    signal input identityRoot;    // 許可されたIDのMerkle root

    // Output
    signal output valid;

    // 1. 年齢計算（簡略版）
    component ageCheck = GreaterEqThan(8);
    ageCheck.in[0] <== currentYear - birthYear;
    ageCheck.in[1] <== minimumAge;

    // 2. IDコミットメントの検証（実際にはMerkle proofが必要）
    component idHash = Poseidon(1);
    idHash.inputs[0] <== identitySecret;

    valid <== ageCheck.out;
}

component main {public [currentYear, currentMonth, minimumAge, identityRoot]}
    = AgeVerification();
```

### パターン2: 残高範囲証明（Balance Range Proof）

```circom
pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

// 証明: 「実際の残高を秘匿したまま、閾値以上の残高があることを証明」
template BalanceRangeProof(n) {
    signal input balance;       // 秘匿: 実際の残高
    signal input balanceSalt;   // 秘匿: コミットメントのsalt
    signal input threshold;     // 公開: 最低残高

    signal output balanceCommitment;  // 公開: 残高のコミットメント
    signal output isAboveThreshold;  // 公開: 閾値以上か

    // バランスが正の数であることを確認（ビット分解）
    component positive = Num2Bits(n);
    positive.in <== balance;

    // 残高コミットメントの生成（balance を公開せずに検証可能に）
    component commit = Poseidon(2);
    commit.inputs[0] <== balance;
    commit.inputs[1] <== balanceSalt;
    balanceCommitment <== commit.out;

    // 閾値チェック
    component gte = GreaterEqThan(n);
    gte.in[0] <== balance;
    gte.in[1] <== threshold;
    isAboveThreshold <== gte.out;
}

component main {public [threshold]} = BalanceRangeProof(64);
```

### パターン3: Semaphore パターン（匿名グループメンバーシップ）

```circom
pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/merkleProof.circom";

// Semaphoreの簡略版
// 証明: 「IDを秘匿したまま、グループのメンバーであることを証明し、シグナルを送る」
template Semaphore(levels) {
    // Private
    signal input identityTrapdoor;
    signal input identityNullifier;
    signal input treePathIndices[levels];
    signal input treePathElements[levels];

    // Public
    signal input signalHash;
    signal input externalNullifier;
    signal input merkleRoot;

    // Output
    signal output nullifierHash;

    // 1. Identity コミットメントの計算
    component secret = Poseidon(2);
    secret.inputs[0] <== identityTrapdoor;
    secret.inputs[1] <== identityNullifier;

    component commitment = Poseidon(1);
    commitment.inputs[0] <== secret.out;

    // 2. Merkle membership proof
    component tree = MerkleProof(levels);
    tree.leaf <== commitment.out;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== treePathElements[i];
        tree.pathIndices[i] <== treePathIndices[i];
    }
    merkleRoot === tree.root;

    // 3. Nullifier hash（二重使用防止）
    component nullHash = Poseidon(2);
    nullHash.inputs[0] <== externalNullifier;
    nullHash.inputs[1] <== identityNullifier;
    nullifierHash <== nullHash.out;

    // 4. signalHash を回路に「固定」（改ざん防止）
    signal signalHashSquared;
    signalHashSquared <== signalHash * signalHash;
}

component main {public [signalHash, externalNullifier, merkleRoot]}
    = Semaphore(20);
```

---

## 4. JavaScript/TypeScript統合

### 証明生成・検証（snarkJS）

```typescript
import * as snarkjs from "snarkjs";
import { buildPoseidon } from "circomlibjs";

interface ProofData {
    proof: snarkjs.Groth16Proof;
    publicSignals: string[];
}

class ZKProver {
    private wasmFile: string;
    private zkeyFile: string;

    constructor(wasmFile: string, zkeyFile: string) {
        this.wasmFile = wasmFile;
        this.zkeyFile = zkeyFile;
    }

    async generateProof(input: Record<string, bigint>): Promise<ProofData> {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            this.wasmFile,
            this.zkeyFile
        );
        return { proof, publicSignals };
    }

    async verify(
        verificationKey: object,
        proof: snarkjs.Groth16Proof,
        publicSignals: string[]
    ): Promise<boolean> {
        return await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
    }

    // Solidity Calldata形式に変換
    async exportSolidityCallData(
        proof: snarkjs.Groth16Proof,
        publicSignals: string[]
    ): Promise<string> {
        return await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    }
}

// 使用例
async function proveAgeVerification() {
    const prover = new ZKProver(
        "./build/age_verification_js/age_verification.wasm",
        "./build/age_verification_final.zkey"
    );

    const input = {
        birthYear: 1990n,
        birthMonth: 6n,
        birthDay: 15n,
        identitySecret: BigInt("0x1234..."),
        currentYear: 2024n,
        currentMonth: 6n,
        minimumAge: 18n,
        identityRoot: BigInt("0x5678...")
    };

    const { proof, publicSignals } = await prover.generateProof(input);
    console.log("Proof:", proof);
    console.log("Public signals:", publicSignals);

    // Solidity calldata
    const calldata = await prover.exportSolidityCallData(proof, publicSignals);
    console.log("Calldata:", calldata);
}
```

### Merkle Tree ユーティリティ

```typescript
import { buildPoseidon, buildMimc7 } from "circomlibjs";

class PoseidonMerkleTree {
    private poseidon: any;
    private levels: number;
    private leaves: bigint[];
    private zeros: bigint[];
    private nodes: Map<string, bigint>;

    async init(levels: number) {
        this.poseidon = await buildPoseidon();
        this.levels = levels;
        this.leaves = [];
        this.zeros = this.computeZeros();
        this.nodes = new Map();
    }

    private computeZeros(): bigint[] {
        const zeros = [0n];
        for (let i = 1; i <= this.levels; i++) {
            zeros.push(this.hash(zeros[i-1], zeros[i-1]));
        }
        return zeros;
    }

    private hash(left: bigint, right: bigint): bigint {
        return this.poseidon.F.toObject(this.poseidon([left, right]));
    }

    insert(leaf: bigint): number {
        const index = this.leaves.length;
        this.leaves.push(leaf);
        this.updatePath(index, leaf);
        return index;
    }

    getRoot(): bigint {
        return this.nodes.get(`${this.levels}_0`) ?? this.zeros[this.levels];
    }

    getProof(index: number): {
        pathElements: bigint[];
        pathIndices: number[];
        root: bigint;
    } {
        const pathElements: bigint[] = [];
        const pathIndices: number[] = [];

        let currentIndex = index;
        for (let level = 0; level < this.levels; level++) {
            const isLeft = currentIndex % 2 === 0;
            const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
            const sibling = this.nodes.get(`${level}_${siblingIndex}`)
                ?? this.zeros[level];

            pathElements.push(sibling);
            pathIndices.push(isLeft ? 0 : 1);
            currentIndex = Math.floor(currentIndex / 2);
        }

        return { pathElements, pathIndices, root: this.getRoot() };
    }

    private updatePath(index: number, value: bigint) {
        let currentIndex = index;
        let currentValue = value;

        for (let level = 0; level < this.levels; level++) {
            this.nodes.set(`${level}_${currentIndex}`, currentValue);
            const isLeft = currentIndex % 2 === 0;
            const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
            const sibling = this.nodes.get(`${level}_${siblingIndex}`)
                ?? this.zeros[level];

            currentValue = isLeft
                ? this.hash(currentValue, sibling)
                : this.hash(sibling, currentValue);
            currentIndex = Math.floor(currentIndex / 2);
        }
        this.nodes.set(`${this.levels}_0`, currentValue);
    }
}
```

---

## 5. Hardhat統合

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-circom";

const config: HardhatUserConfig = {
    solidity: "0.8.24",
    networks: {
        hardhat: {},
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL!,
            accounts: [process.env.PRIVATE_KEY!]
        }
    },
    circom: {
        inputBasePath: "./circuits",
        ptau: "hermez-rawFinal.ptau",
        circuits: [
            {
                name: "age_verification",
                protocol: "groth16",  // または "plonk"
                circuit: "age_verification.circom",
                input: "inputs/age_verification_input.json"
            }
        ]
    }
};

export default config;
```

```typescript
// test/ZKApp.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { groth16 } from "snarkjs";
import * as fs from "fs";

describe("ZKApp", () => {
    let zkApp: any;
    const verificationKey = JSON.parse(
        fs.readFileSync("./build/age_verification_verification_key.json", "utf8")
    );

    beforeEach(async () => {
        const ZKApp = await ethers.getContractFactory("ZKApp");
        zkApp = await ZKApp.deploy();
    });

    it("正しい証明を受け入れる", async () => {
        const input = {
            birthYear: 1990,
            currentYear: 2024,
            minimumAge: 18
        };

        const { proof, publicSignals } = await groth16.fullProve(
            input,
            "./build/age_verification_js/age_verification.wasm",
            "./build/age_verification_final.zkey"
        );

        const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
        const args = JSON.parse("[" + calldata + "]");

        await expect(zkApp.submitProof(...args)).to.not.be.reverted;
    });
});
```

---

## 6. パフォーマンス最適化

### 制約数の削減

```circom
// ❌ 非効率: n回の乗算制約
// a^n を求めるのに n-1 回の乗算
signal result[n];
result[0] <== a;
for (var i = 1; i < n; i++) {
    result[i] <== result[i-1] * a;
}

// ✅ 効率的: 繰り返し二乗法（制約数 log(n)）
template Power(n) {
    signal input base;
    signal output result;
    // log2(n) ステップで計算
}
```

### 証明生成の高速化

```bash
# rapidsnark（サーバーサイド、Groth16専用、snarkjsの約10倍高速）
git clone https://github.com/iden3/rapidsnark
cd rapidsnark && npm install && ./build.sh

./proverServer 8080
# または直接実行:
./prover circuit_final.zkey witness.wtns proof.json public.json

# WASM vs native の選択:
# - ブラウザ/Node: snarkjs (WASM)
# - サーバー: rapidsnark (native C++) → 大規模証明向け
```

### 制約削減のベストプラクティス

| 操作 | 非効率 | 効率的 |
|------|-------|-------|
| ハッシュ | SHA256 (25K+ 制約) | Poseidon (~300制約) |
| 比較 | カスタム実装 | circomlibのLessEqThan |
| 条件分岐 | if/else（不可）| Mux1/Mux2コンポーネント |
| ビット演算 | カスタム | Num2Bits + bitwise ops |
| 範囲チェック | 複数の比較 | RangeCheck(n) |
