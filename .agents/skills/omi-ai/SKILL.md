---
name: omi-ai
description: >
  Omi AI（BasedHardware製オープンソースウェアラブルAIデバイス）を使ったプロダクトの
  企画・設計・実装・テスト・デモを包括的に支援するスキル。
  ハッカソン優勝レベルのデモ構築から、ファームウェアカスタマイズ、
  Webhook統合アプリ開発、MCP連携、AWS統合まで全工程をカバーする。

  以下のキーワードや文脈で必ずこのスキルを使用すること:
  「Omi」「omi.me」「BasedHardware」「ウェアラブル AI」「AIネックレス」「AIペンダント」
  「音声ウェアラブル」「DevKit2」「wearable device firmware」「omi webhook」「omi MCP」
  「omi アプリ開発」「会話録音デバイス」「音声メモリデバイス」「omi-cli」「omi integration」
  ハッカソンで Omi デバイスを使いたい / Omi を使ったプロダクトを作りたい場合はこのスキルが必須。
  Omi を初めて使う方でもハッカソン優勝レベルのデモが構築できるよう完全サポートする。

version: 1
metadata:
  hardware: [DevKit2, OmiConsumer, OmiGlass]
  task: [setup, app-development, firmware, mcp, webhook, hackathon-demo, aws-integration]
  language: [python, typescript, javascript]
  services: [fastapi, aws-lambda, dynamodb, bedrock, api-gateway]
---

# Omi AI 開発スキル

**このスキルがロードされたら**: まずユーザーのゴール（ハッカソンデモ / プロダクト開発 / MCP統合 / ファームウェア）を確認し、該当セクションの参照ファイルを読んで対応すること。

---

## Omi AI とは

Omi はペンダント型のオープンソース AI ウェアラブルデバイス。24時間装着し、会話をリアルタイムで文字起こし・記憶・分析する。

```
ユーザーが会話 → Omi デバイスが録音 → BLE/Wi-Fi → スマホアプリ → Webhook → あなたのバックエンド
```

**開発者にとって重要な 3 つの入口**:

| 統合方法 | 用途 | 難易度 |
|---------|------|--------|
| **Webhook App** | 会話完了時・リアルタイム文字起こしを受信してアクション | ★★☆ (2分でスタート) |
| **MCP Server** | Codex/Cursor から Omi の記憶・会話に直接アクセス | ★★☆ (5分でスタート) |
| **Firmware** | DevKit2 のカスタム動作・センサー追加 | ★★★★ (要組込み知識) |

---

## ハードウェア選択

| モデル | 用途 | 特徴 |
|-------|------|------|
| **Omi Consumer (CV1)** | 本番デモ・日常使用 | nRF5340 + Wi-Fi 6、デュアルマイク、コンシューマ品質 |
| **Omi DevKit 2 (DK2)** | ファームウェア開発・プロトタイプ | nRF52840、8GB ストレージ、プログラム可能ボタン、カスタム FW |
| **Omi Glass** | スマートグラス | グラス型フォームファクタ |

**ハッカソン推奨**: Consumer (CV1) — 安定性が高くデモリスクが低い。ファームウェアカスタマイズが必要なら DevKit 2。

詳細スペック → `references/hardware.md`

---

## 5分で動くクイックスタート

### Step 1: API キーの取得

```bash
# Omi アプリ (iOS/Android) → Settings → Developer → API Keys → Create
# 環境変数に設定
export OMI_API_KEY="omi_dev_your_key_here"
```

### Step 2: CLI インストール & 動作確認

```bash
pip install omi-cli
omi memories list --limit 5          # メモリ一覧
omi conversations list --limit 3     # 会話一覧
omi memories search "プロジェクト"    # セマンティック検索
```

### Step 3: Webhook App の骨格 (Python/FastAPI)

```python
from fastapi import FastAPI, Request, BackgroundTasks
import httpx

app = FastAPI()

@app.post("/webhook/memory")
async def handle_memory(request: Request, uid: str, background: BackgroundTasks):
    """会話完了時に呼ばれる。すぐ 200 を返してバックグラウンドで処理する。"""
    memory = await request.json()
    background.add_task(process_memory, uid, memory)
    return {"status": "ok"}

async def process_memory(uid: str, memory: dict):
    title = memory.get("structured", {}).get("title", "")
    overview = memory.get("structured", {}).get("overview", "")
    # ここに独自処理 (DynamoDB 保存、通知送信など)
    print(f"[{uid}] 新しい記憶: {title} - {overview}")
```

### Step 4: Omi アプリでアプリを登録

1. Omi アプリ → **Apps** → **+** → **Integration**
2. Webhook URL に `https://your-server.com/webhook/memory` を入力
3. トリガーに **Memory Creation** を選択
4. 保存してインストール

詳細な実装パターン → `references/app-development.md`

---

## ハッカソンデモ構築パターン

### パターン A: 会話メモリ + 通知 (SABOROU Memory タイプ)

```
Omi 装着
    → (会話録音・文字起こし)
    → Webhook: POST /memory  [title, transcript, speaker情報]
    → バックエンド: Bedrock で要約・人物識別・感情分析
    → DynamoDB: 人物ごとに会話履歴を保存
    → 次回同じ人と会話したとき → 過去の記憶を取り出して通知
```

### パターン B: リアルタイム音声処理

```
Omi 装着
    → (リアルタイム転写: 各発話セグメントを即送信)
    → Webhook: POST /realtime  [text, speaker, start, end]
    → バックエンド: トリガーワード検出 (「調べて」「メモして」)
    → アクション実行 (検索/Slack送信/カレンダー登録)
```

### パターン C: MCP 経由で Codex に記憶を持たせる

```
Omi MCP Server + Codex Desktop
    → Codex から search_memories("プロジェクトXについて")
    → Omi の会話データを直接参照
    → Codex が記憶を持った状態で会話
```

デモスクリプト・AWS 統合コード → `references/hackathon-patterns.md`

---

## MCP セットアップ (Codex Desktop / Cursor)

```json
// claude_desktop_config.json または .cursor/mcp.json
{
  "mcpServers": {
    "omi": {
      "command": "uvx",
      "args": ["omi-mcp-server"],
      "env": {
        "OMI_API_KEY": "omi_dev_your_key_here"
      }
    }
  }
}
```

利用可能なツール:
- `search_memories` — セマンティック検索でメモリを検索
- `get_conversations` — 会話一覧の取得
- `search_conversations` — 会話のセマンティック検索
- `create_memory` / `edit_memory` / `delete_memory` — メモリ操作

詳細設定・使用例 → `references/mcp-setup.md`

---

## Webhook ペイロード形式 (クイックリファレンス)

### Memory Creation (会話完了時)
```json
{
  "id": "memory_abc123",
  "created_at": "2024-07-22T23:59:45.910559+00:00",
  "transcript_segments": [
    {"text": "会話テキスト", "speaker": "SPEAKER_00", "is_user": true, "start": 0.0, "end": 3.5}
  ],
  "structured": {
    "title": "プロジェクトの議論",
    "overview": "概要テキスト",
    "action_items": ["タスク1", "タスク2"]
  }
}
```

### Real-Time Transcript (リアルタイム)
```json
[
  {"text": "今日の会議は...", "speaker": "SPEAKER_00", "is_user": false, "start": 10.0, "end": 15.0}
]
```
クエリパラメータ: `?session_id=abc123&uid=user123`

---

## 日本語対応の注意点

- **会話サマリー**: 日本語環境でも正常動作 ✅
- **メモリ機能**: デフォルトは英語抽出 → プロンプトアプリで日本語指定が必要 ⚠️
- **音声認識**: 日本語音声の認識精度は環境依存（静かな場所推奨）
- **プロンプトカスタマイズ**: Apps → Prompt-based でシステムプロンプトを日本語指定可

日本語対応の詳細 → `references/japanese-tips.md`

---

## AWS 統合アーキテクチャ (参考)

```
Omi Device
    ↓ BLE
Omi Mobile App
    ↓ Webhook
API Gateway (AWS)
    ↓
Lambda (FastAPI/Mangum)
    ↓
Bedrock (分析・要約)  ←→  DynamoDB (会話履歴)
    ↓
SNS → Mobile Push Notification
```

AWS CDK での実装パターン → `references/hackathon-patterns.md`

---

## よくあるトラブル

| 問題 | 原因 | 対処 |
|------|------|------|
| Webhook が届かない | サーバーが HTTPS でない | ngrok や Railway.app を使う |
| `200 OK` が遅い | 処理がブロッキング | BackgroundTasks で非同期化 |
| 音声認識が不安定 | 環境ノイズ | 静かな場所で実施・Consumer 版推奨 |
| バッテリー消費が速い | 連続録音 | 録音モードの設定確認 |
| メモリが英語になる | デフォルト動作 | プロンプトアプリで日本語指定 |

---

## 参考ファイル

| ファイル | 内容 |
|---------|------|
| `references/hardware.md` | DevKit2/Consumer 詳細仕様・ファームウェア開発 |
| `references/app-development.md` | Webhook 全種類の実装・認証・デプロイ |
| `references/mcp-setup.md` | MCP の詳細設定・ツール一覧・統合例 |
| `references/hackathon-patterns.md` | ハッカソン向けデモパターン・AWS CDK コード |
| `references/japanese-tips.md` | 日本語対応・トラブルシュート |
