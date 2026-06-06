# ZKPユースケース実装パターン集

## 目次
1. [zkRollupの基礎設計](#1-zkrollupの基礎設計)
2. [匿名認証 (Semaphore)](#2-匿名認証-semaphore)
3. [zkLogin / ソーシャルログイン](#3-zklogin--ソーシャルログイン)
4. [プライベートVoting (MACI)](#4-プライベートvoting-maci)
5. [秘匿DeFi](#5-秘匿defi)
6. [クロスチェーン証明 (zkBridge)](#6-クロスチェーン証明-zkbridge)

---

## 1. zkRollupの基礎設計

### アーキテクチャ概要

```
[User] → [L2 Operator]
              ↓
     [バッチトランザクション収集]
              ↓
     [State Transition回路] ← Circom/Halo2で実装
              ↓
     [ZK証明生成]（オフチェーン）
              ↓
     [L1コントラクト: 証明検証 + 状態更新]
```

### 基本的なStateTransition回路

```circom
pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/merkleProof.circom";
include "circomlib/circuits/eddsa.circom";

// シンプルなトークン転送のState Transition
template TransferBatch(batchSize, treeDepth) {
    // Public inputs
    signal input oldRoot;   // 処理前のMerkle Root
    signal input newRoot;   // 処理後のMerkle Root
    signal input batchHash; // バッチのハッシュ（改ざん防止）

    // Private inputs（各トランザクション）
    signal input senderBalance[batchSize];
    signal input receiverBalance[batchSize];
    signal input amount[batchSize];
    signal input senderIdx[batchSize];
    signal input receiverIdx[batchSize];
    signal input senderProof[batchSize][treeDepth];
    signal input senderProofIdx[batchSize][treeDepth];
    // ... signature inputs

    // 各トランザクションの検証
    for (var i = 0; i < batchSize; i++) {
        // 1. 残高が十分か
        component balanceCheck = GreaterEqThan(64);
        balanceCheck.in[0] <== senderBalance[i];
        balanceCheck.in[1] <== amount[i];
        balanceCheck.out === 1;

        // 2. 送信者のMerkle proof
        // 3. 残高更新
        // 4. 新しいMerkle root計算
    }

    // 最終的なrootが一致することを確認
}

component main {public [oldRoot, newRoot, batchHash]}
    = TransferBatch(32, 20);
```

### L1コントラクト

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TransferBatchVerifier.sol";

contract ZKRollup is TransferBatchVerifier {
    bytes32 public stateRoot;
    uint256 public batchNumber;

    event BatchSubmitted(uint256 indexed batchId, bytes32 newRoot);

    constructor(bytes32 genesisRoot) {
        stateRoot = genesisRoot;
    }

    function submitBatch(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[3] memory publicSignals  // [oldRoot, newRoot, batchHash]
    ) external {
        bytes32 oldRoot = bytes32(publicSignals[0]);
        bytes32 newRoot = bytes32(publicSignals[1]);

        require(oldRoot == stateRoot, "State root mismatch");
        require(verifyProof(a, b, c, publicSignals), "Invalid proof");

        stateRoot = newRoot;
        emit BatchSubmitted(batchNumber++, newRoot);
    }
}
```

---

## 2. 匿名認証 (Semaphore)

### Semaphore の仕組み

```
1. 各ユーザーがIDを生成: (trapdoor, nullifier) → commitment
2. 管理者がcommitmentをMerkle treeに登録
3. ユーザーがグループメンバーシップを証明:
   - commitment が tree に含まれることを証明（IDを秘匿）
   - nullifierHash を生成（二重投票防止）
```

### ライブラリの使い方

```bash
npm install @semaphore-protocol/core
npm install @semaphore-protocol/contracts
```

```typescript
import { Identity, Group, generateProof, verifyProof } from "@semaphore-protocol/core";

// 1. IDの生成（ユーザーサイド）
const identity = new Identity();  // ローカルに保存
// identity.trapdoor: 秘密
// identity.nullifier: 秘密
// identity.commitment: 公開（Merkle treeに登録）

// 2. グループにメンバーを追加
const group = new Group([
    identity.commitment,  // メンバー追加
    otherIdentity.commitment,
]);

// 3. 証明生成
const signal = BigInt(ethers.id("my_vote_option_A"));  // 送りたいシグナル
const externalNullifier = BigInt(ethers.id("poll_001"));  // 投票ID

const proof = await generateProof(
    identity,
    group,
    signal,
    externalNullifier
);

// 4. オンチェーン送信
const calldata = SemaphoreABI.encodeFunctionData("sendSignal", [
    externalNullifier,
    signal,
    proof.merkleTreeDepth,
    proof.merkleTreeRoot,
    proof.nullifier,
    proof.points,
]);
```

```solidity
// SemaphoreのSolidityコントラクト
import "@semaphore-protocol/contracts/Semaphore.sol";

contract AnonymousVoting {
    ISemaphore public semaphore;
    uint256 public groupId;
    mapping(uint256 => bool) public usedNullifiers;
    mapping(uint256 => uint256) public votes;  // option → count

    function vote(
        uint256 merkleTreeDepth,
        uint256 merkleTreeRoot,
        uint256 nullifier,
        uint256 voteOption,  // シグナル
        uint256[8] memory proof
    ) external {
        require(!usedNullifiers[nullifier], "Already voted");

        semaphore.verifyProof(
            groupId,
            merkleTreeDepth,
            merkleTreeRoot,
            voteOption,
            nullifier,
            proof
        );

        usedNullifiers[nullifier] = true;
        votes[voteOption]++;
    }
}
```

---

## 3. zkLogin / ソーシャルログイン

### Sui zkLogin / 類似実装の概要

```
OAuth2 → JWTを取得 → JWT内のsubを秘匿したまま、
「このメールアドレスのユーザーである」ことをZKPで証明
```

```circom
// JWT検証回路の概念（簡略版）
template ZKLogin() {
    // Private inputs
    signal input jwt_payload[N];    // JWTペイロード（base64decoded）
    signal input user_secret;       // ユーザーのシークレット
    signal input sub;               // user identifier (秘匿)

    // Public inputs
    signal input nonce;             // セッション固有値
    signal input iss;               // JWTのissuer（公開）
    signal input aud;               // Client ID（公開）
    signal input public_key;        // JWKSの公開鍵

    // 1. JWT署名の検証（RSA-SHA256 in ZK）
    // 2. ペイロードからsub・nonceを抽出
    // 3. sub + user_secret → commitment（公開アドレスを導出）
    // 4. nonceが期待値と一致することを確認
}
```

---

## 4. プライベートVoting (MACI)

### MACI (Minimum Anti-Collusion Infrastructure)

```
特徴:
- 投票内容を誰も（オペレーターも）見られない
- 結果の正確性はZKPで証明される
- 贈収賄/共謀を困難にする（投票を後から変更可能）

技術スタック:
- circom回路（vote counting, tallying）
- Semaphore（匿名性）
- TS SDK: @maci-protocol/core
```

```bash
npm install @maci-protocol/core @maci-protocol/contracts
```

---

## 5. 秘匿DeFi

### Tornado Cash パターン（教育目的）

```
基本的な考え方:
deposit: ETHを預けてcommitmentを記録 → nullifierを秘匿保持
withdraw: nullifierHashを公開してMerkle membershipを証明
         → 誰が引き出したか分からない（Mixerの仕組み）
```

```circom
// Tornado Cash 互換 Withdraw回路（簡略版）
template Withdraw(levels) {
    // Private inputs
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input relayer;
    signal input fee;
    signal input refund;

    // コミットメント計算（Pedersen hash使用）
    component commitmentHasher = CommitmentHasher();
    commitmentHasher.nullifier <== nullifier;
    commitmentHasher.secret <== secret;

    // Merkle proof
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitmentHasher.commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Nullifier hash検証（二重引き出し防止）
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHash === nullifierHasher.out;

    // recipient/relayer/fee を回路に固定（フロントランニング防止）
    signal recipientSquare;
    signal relayerSquare;
    recipientSquare <== recipient * recipient;
    relayerSquare <== relayer * relayer;
}
```

### Private Fungible Token（ERC20ベース）

```
技術: Zcash Sapling スタイル
- UTXO（未使用トランザクション出力）モデル
- 各UTXOはコミットメントとしてMerkle treeに格納
- 転送時: 古いUTXOを無効化（nullifier公開）+ 新しいUTXO作成
```

---

## 6. クロスチェーン証明 (zkBridge)

### 光ブロックヘッダー証明の概念

```
目標: Chain Aのブロックヘッダーが有効であることをChain BでZKPで証明
（ライトクライアントをZKで実現）

技術:
- Beacon Chain State Root → ZKP → L2/Other Chain
- Helios (Rust): ETH lightclientのZK実装
- Succinct Labs: SP1でbeacon chain証明
```

```typescript
// zkBridge 相互作用の例（Succinct Labs SP1）
import { ProofRequest } from "@succinctlabs/sp1-sdk";

// SP1でEthereum Beacon Chain proof を生成
const request = new ProofRequest({
    programELF: "./beacon_proof/elf/riscv32im-succinct-zkvm-elf",
    input: {
        blockNumber: 21000000,
        expectedStateRoot: "0x..."
    }
});

const proof = await request.prove();
// proof を対象チェーンのVerifierに送信
```

## ZKPエコシステム主要プロジェクト一覧

| プロジェクト | 分類 | 言語 | 特徴 |
|------------|------|------|------|
| circom + snarkJS | DSL + Prover | JS/Rust | 最もポピュラー、豊富なエコシステム |
| Halo2 | Framework | Rust | Zcash/zkSync採用、Trusted Setup不要 |
| Plonky2 | Framework | Rust | 高速再帰証明、Polygon採用 |
| gnark | Framework | Go | 高速、企業向け |
| Noir | Language | Rust | Aztech採用、Rustライクな構文 |
| ZoKrates | Language | Python/Rust | Ethereum向け高水準言語 |
| RISC Zero | zkVM | Rust | 任意のRustプログラムを証明可能 |
| SP1 (Succinct) | zkVM | Rust | ELFバイナリを証明可能 |
| Semaphore | Protocol | JS/Solidity | 匿名グループメンバーシップ標準 |
| MACI | Protocol | JS/Solidity | 匿名・耐共謀投票 |
| Zcash Sapling | Protocol | Rust/C++ | 秘匿トランザクションの参照実装 |
