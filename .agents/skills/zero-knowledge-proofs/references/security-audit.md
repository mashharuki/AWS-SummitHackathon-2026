# ZKP回路セキュリティ審査ガイド

## 目次
1. [ZKP特有の脆弱性カテゴリー](#1-zkp特有の脆弱性カテゴリー)
2. [脆弱性別の詳細と対策](#2-脆弱性別の詳細と対策)
3. [静的解析ツールの使い方](#3-静的解析ツールの使い方)
4. [審査チェックリスト](#4-審査チェックリスト)
5. [Solidityベリファイアの審査](#5-solidityベリファイアの審査)

---

## 1. ZKP特有の脆弱性カテゴリー

ZKP回路の脆弱性は「**健全性 (Soundness) の破綻**」に直結する。
悪意あるプロバーが偽の証明を生成できるようになるため、通常の契約バグより深刻。

| 脆弱性カテゴリー | 危険度 | 発生頻度 |
|----------------|--------|---------|
| Under-constrained Signal | 🔴 Critical | 非常に高い |
| assert/log の誤用 | 🔴 Critical | 高い |
| 代入演算子の混同 (< -- vs <==) | 🔴 Critical | 高い |
| 算術オーバーフロー | 🟠 High | 中程度 |
| 安全でないコンポーネント再利用 | 🟠 High | 中程度 |
| 信号のスコープ違反 | 🟡 Medium | 中程度 |
| 決定論的でないwitness | 🟡 Medium | 低い |
| ハッシュ関数の誤選択 | 🟡 Medium | 低い |

---

## 2. 脆弱性別の詳細と対策

### 🔴 Under-constrained Signal（最頻出・最危険）

**概要**: シグナルに制約が付いていない場合、悪意あるプロバーが任意の値を
そのシグナルに代入して偽の証明を生成できる。

```circom
// ❌ 脆弱: intermediate に制約がない
template Vulnerable() {
    signal input a;
    signal input b;
    signal intermediate;
    signal output result;

    intermediate <-- a * b;  // 代入のみ（制約なし）
    result <== intermediate + a;  // intermediate は任意値
    // 攻撃者: intermediate = 999999 として偽の result を生成可能
}

// ✅ 修正: <== で代入と制約を同時に設定
template Safe() {
    signal input a;
    signal input b;
    signal intermediate;
    signal output result;

    intermediate <== a * b;  // 代入 + 制約（安全）
    result <== intermediate + a;
}
```

**検出方法**:
```bash
# Circomspect で検出
circomspect circuits/your_circuit.circom

# 出力例:
# warning[P1009]: Intermediate signals should normally be constrained.
# --> circuits/example.circom:7:5
# intermediate <-- a * b;
```

### 🔴 assert の誤用

**概要**: `assert` はコンパイル時または witness 生成時のチェックであり、
**R1CSの制約には追加されない**。証明検証時には実行されない。

```circom
// ❌ 脆弱: assert は制約を生成しない
template DivisionVulnerable() {
    signal input dividend;
    signal input divisor;
    signal output quotient;

    assert(divisor != 0);  // ← 証明時には無視される！
    quotient <-- dividend / divisor;
    // divisor = 0 の証明を生成可能
}

// ✅ 修正: === で制約を明示的に設定
template DivisionSafe() {
    signal input dividend;
    signal input divisor;
    signal input divisorInverse;  // 補助シグナル
    signal output quotient;

    // divisor ≠ 0 を制約として表現: divisor * divisorInverse === 1
    divisor * divisorInverse === 1;
    quotient <== dividend * divisorInverse;
}
```

### 🔴 代入演算子の混同

```circom
// Circom の演算子一覧（重要！）
a <-- expr;   // 代入のみ（制約なし、witness生成に使用）
a --> expr;   // 右から左への代入のみ（制約なし）
a <== expr;   // 代入 + 制約（R1CSに追加）★ほぼ常にこちらを使う
a === expr;   // 制約のみ（代入なし）

// ❌ 一般的なミス: ビット分解後の再構成で代入のみ
template Vulnerable(n) {
    signal input in;
    signal bits[n];

    component n2b = Num2Bits(n);
    n2b.in <== in;
    for (var i = 0; i < n; i++) {
        bits[i] <-- n2b.out[i];  // ❌ 制約なし
    }
}

// ✅ 修正
template Safe(n) {
    signal input in;
    signal bits[n];

    component n2b = Num2Bits(n);
    n2b.in <== in;
    for (var i = 0; i < n; i++) {
        bits[i] <== n2b.out[i];  // ✅ 制約付き
    }
}
```

### 🟠 算術オーバーフロー

**概要**: Circom はフィールド演算（mod p）で動作する。
値が p = 2^254 程度を超えると意図しない結果になる。

```circom
// ❌ 脆弱: 64bit整数の加算でオーバーフローしないとは限らない
template SumVulnerable() {
    signal input a;  // 最大 2^64 の値
    signal input b;  // 最大 2^64 の値
    signal output sum;

    sum <== a + b;  // a + b が p を超える場合、ラップアラウンド
}

// ✅ 修正: Num2Bits で範囲を制限
template SumSafe(maxBits) {
    signal input a;
    signal input b;
    signal output sum;

    // 入力の範囲を制限（maxBits ビット以内であることを証明）
    component aCheck = Num2Bits(maxBits);
    component bCheck = Num2Bits(maxBits);
    aCheck.in <== a;
    bCheck.in <== b;

    // 和のオーバーフローチェック
    component sumCheck = Num2Bits(maxBits + 1);
    sumCheck.in <== a + b;
    sum <== a + b;
}
```

### 🟠 安全でないコンポーネント再利用

```circom
// circomlibのIsZeroを使う場合
include "circomlib/circuits/comparators.circom";

// ❌ 出力を使わない場合（under-constrained）
template Vulnerable() {
    signal input x;
    component isZero = IsZero();
    isZero.in <== x;
    // isZero.out を使っていない場合、コンポーネント内の制約は無効化される可能性
}

// ✅ 出力を必ず使う（または制約に組み込む）
template Safe() {
    signal input x;
    signal output isZeroResult;
    component isZero = IsZero();
    isZero.in <== x;
    isZeroResult <== isZero.out;  // 出力を明示的に使用
}
```

---

## 3. 静的解析ツールの使い方

### Circomspect（Trail of Bits製、最も広く使われる）

```bash
# インストール
cargo install circomspect

# 基本使用
circomspect circuits/your_circuit.circom

# 詳細出力
circomspect --level WARNING circuits/your_circuit.circom

# 全警告を有効化
circomspect --allow-warnings circuits/your_circuit.circom

# CI/CDへの組み込み（警告があれば終了コード1）
circomspect circuits/ && echo "No issues found"
```

**Circomspectが検出する主な問題**:
- `P1009`: Under-constrained intermediate signals
- `P1010`: Signals not in any constraint
- `P1008`: assert ではなく === を使うべき箇所
- `P1004`: 到達不可能なコード

### ZKAP（より高精度、研究ツール）

Circomspectよりも false positive が少ない。
論文: "Practical Security Analysis of Zero-Knowledge Proof Circuits" (USENIX Security 2024)

### 手動審査チェックポイント

```bash
# R1CS の分析（制約数確認）
snarkjs r1cs info circuit.r1cs
snarkjs r1cs print circuit.r1cs circuit.sym

# シグナルの一覧とその制約への参加を確認
# （全シグナルが制約に現れているか）
grep -n "<--\|-->" circuits/your_circuit.circom | head -20
# ← <-- が出たら要確認
```

---

## 4. 審査チェックリスト

### Level 1: 自動化チェック（必須）

```
□ circomspect を全回路に対して実行し、警告ゼロを確認
□ snarkjs r1cs info で制約数・シグナル数を確認
□ 意図した public input が正しく設定されているか
□ テストスイートで正常系・異常系が両方カバーされているか
□ 制約違反を引き起こすinputでcalculateWitnessが失敗することを確認
```

### Level 2: コードレビュー（必須）

```
□ 全ての `<--` 演算子を確認し、対応する `===` 制約があるか
□ `assert` が制約として使われていないか（assertはコメント扱い）
□ `log()` が制約として使われていないか（デバッグ専用）
□ 全てのコンポーネントの出力が使用または制約されているか
□ Num2Bits の n が適切なビット数か（小さすぎると範囲チェック失敗）
□ Poseidon/MiMC の入力数がテンプレートパラメータと一致するか
□ Merkle ProofのpathIndicesが0/1バイナリであることを制約しているか
```

### Level 3: 暗号的正確性（重要）

```
□ public input が本当に公開して良い情報か（プライバシーリーク確認）
□ nullifier hash が二重使用防止に機能しているか（コントラクト側も確認）
□ コミットメントスキームがbinding・hidingを満たしているか
□ Trusted Setupの参加者が十分か（Groth16 phase 2 は最低2人）
□ 使用するPTAUファイルが適切な規模か（制約数 < 2^K）
□ 証明が異なるversionの回路で流用できないか（domain separation）
```

### Level 4: 統合・インフラ（重要）

```
□ verification_key.json が本物か（生成プロセスを追跡可能か）
□ VerifierコントラクトがZkeyから生成されたものと一致するか
□ snarkjs zkey verify でzkey整合性確認済みか
□ フロントエンドのwitness生成が秘密情報をログ出力していないか
□ WebSocketやAPIを通じてwitness（秘密データ）を送信していないか
```

---

## 5. Solidityベリファイアの審査

```solidity
// snarkjsが生成するVerifierContractの審査ポイント

// ✅ 確認1: verifyProofがpublicSignalsのみを検証対象にしているか
function verifyProof(
    uint[2] memory a,       // proof.a
    uint[2][2] memory b,    // proof.b
    uint[2] memory c,       // proof.c
    uint[N] memory input    // public signals のみ
) public view returns (bool) {
    // ...
}

// ✅ 確認2: caller がproof要素を改ざんできないか
// （Solidityコントラクト側でpublic signalsを使う際の注意）

// ❌ 危険: ユーザーが提供したpublicSignalsをそのまま信用
function badPattern(uint nullifierHash) external {
    require(!usedNullifiers[nullifierHash], "Already used");
    usedNullifiers[nullifierHash] = true;
    // proof.public[0] と nullifierHash が一致することを検証していない！
}

// ✅ 安全: proofで検証済みのpublicSignalsを使う
function goodPattern(
    uint[2] memory a, uint[2][2] memory b, uint[2] memory c,
    uint[1] memory publicSignals  // [0] = nullifierHash
) external {
    require(verifyProof(a, b, c, publicSignals), "Invalid proof");
    uint nullifierHash = publicSignals[0];
    require(!usedNullifiers[nullifierHash], "Already used");
    usedNullifiers[nullifierHash] = true;
}
```

### ベリファイアのガスコスト最適化

```solidity
// Groth16 ベリファイア: 約250,000 gas
// PLONK ベリファイア: 約300,000 gas
// FFLONK ベリファイア: 約200,000 gas（最安）

// ガスを節約するために:
// 1. 検証前にビジネスロジックの事前チェックを行う
function submitProof(...) external {
    // まずビジネスロジックチェック（ガス安い）
    require(!usedNullifiers[nullifierHash], "Already used");
    require(block.timestamp < deadline, "Expired");

    // 最後にZK検証（ガス高い）
    require(verifyProof(a, b, c, signals), "Invalid proof");

    // 状態変更
    usedNullifiers[nullifierHash] = true;
}
```
