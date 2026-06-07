# Omi ハードウェア詳細仕様

## デバイス比較表

| 仕様 | Omi Consumer (CV1) | Omi DevKit 2 (DK2) |
|------|-------------------|-------------------|
| **プロセッサ** | nRF5340 (デュアルコア) | Xiao nRF52840 |
| **Wi-Fi** | nRF7002 Wi-Fi 6 | なし (BLE のみ) |
| **マイク** | デュアル T5838 (PDM) | シングルマイク |
| **ストレージ** | - | 8GB オンボード |
| **ボタン** | - | プログラム可能ボタン |
| **フォームファクタ** | ネックレス型 (コンシューマ) | 開発者向けキット |
| **接続** | BLE + Wi-Fi | BLE のみ |
| **ファームウェア** | OTA / プリビルト | カスタム可 |
| **価格** | $89 | 別途 |
| **推奨用途** | デモ・日常使用 | FW 開発・プロトタイプ |

---

## Omi Consumer (CV1) のファームウェア更新

### OTA 更新（推奨）
1. Omi アプリを開く
2. Settings → Device → Firmware Update
3. アップデートが利用可能な場合、自動通知

### 手動更新
1. GitHub Releases から最新ファームウェアをダウンロード
2. タグ `cv1-vX.X.X` のリリースを選択
3. Omi アプリの Manual Flash 機能を使用

---

## Omi DevKit 2 のファームウェア開発

### 環境セットアップ

```bash
# Zephyr RTOS のセットアップ (nRF Connect SDK)
# 1. nRF Connect SDK をインストール (v2.5.0 推奨)
# https://developer.nordicsemi.com/

# 2. リポジトリのクローン
git clone https://github.com/BasedHardware/omi
cd omi/firmware

# 3. 依存関係のインストール
pip install west
west init -l app
west update
```

### ビルドとフラッシュ

```bash
# DevKit 2 向けビルド
west build -b xiao_ble app/firmware -- -DBOARD_ROOT=app

# フラッシュ (USB 接続)
west flash

# または OTA フラッシュ (Omi アプリ経由)
# ビルド成果物: build/zephyr/zephyr.uf2
# → Omi アプリの Custom Firmware 機能でアップロード
```

### プログラム可能ボタンの活用

```c
// firmware/src/button.c の例
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>

// ボタン押下時のコールバック
void button_pressed_callback(const struct device *dev,
                              struct gpio_callback *cb, uint32_t pins) {
    // カスタムアクション: 録音開始/停止、BLE データ送信など
    trigger_recording_toggle();
}
```

### カスタムセンサーの追加

DevKit 2 は I2C/SPI ピンが露出しており、以下を追加できる:
- 温度/湿度センサー (BME280)
- 加速度センサー (LSM6DS)
- 心拍センサー (MAX30102)

---

## ファームウェアのカスタマイズポイント

| ポイント | 場所 | 説明 |
|---------|------|------|
| 音声エンコード | `audio/` | Opus コーデック設定 |
| BLE プロトコル | `bluetooth/` | データ送信フォーマット |
| ボタン動作 | `button.c` | ショート/ロングプレス定義 |
| LED 制御 | `led.c` | ステータス表示 |
| 省電力設定 | `power.c` | スリープモード調整 |

---

## 重要な制約事項

- **BLE のみ (DK2)**: Wi-Fi なし → スマホアプリ経由でデータ送信が必須
- **Consumer の FW カスタマイズ**: OTA と手動のみ (DK2 ほど自由ではない)
- **バッテリー**: 連続録音で 8〜24 時間程度 (設定による)
- **音声品質**: 環境ノイズに影響されやすい → Consumer のデュアルマイクが有利
