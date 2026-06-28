# Omi アプリ開発 詳細ガイド

## アプリの種類

| 種類 | 説明 | サーバー要否 |
|------|------|------------|
| **Prompt-based** | AI の性格・応答スタイルをカスタマイズ | 不要 |
| **Memory Trigger** | 会話完了時に Webhook 呼び出し | 必要 |
| **Real-time Transcript** | 音声セグメントをリアルタイムで送信 | 必要 |
| **Chat Tool** | カスタムツールを会話中に呼び出し | 必要 |
| **Audio Streaming** | PCM16 音声バイトをリアルタイム送信 | 必要 |
| **Day Summary** | 日次サマリー生成時に Webhook 呼び出し | 必要 |

---

## Webhook ペイロード詳細

### 1. Memory Creation Trigger

```
POST /your-endpoint?uid={user_id}
```

```json
{
  "id": "memory_abc123",
  "created_at": "2024-07-22T23:59:45.910559+00:00",
  "started_at": "2024-07-22T23:30:00.000000+00:00",
  "finished_at": "2024-07-22T23:59:00.000000+00:00",
  "transcript_segments": [
    {
      "text": "会話テキスト",
      "speaker": "SPEAKER_00",
      "speaker_id": null,
      "is_user": true,
      "person_id": null,
      "start": 0.0,
      "end": 3.5
    }
  ],
  "structured": {
    "title": "プロジェクトの議論",
    "overview": "プロジェクトの優先事項について話し合った",
    "action_items": ["モックアップを作成する", "チームに共有する"],
    "category": "work",
    "emoji": "💼"
  },
  "folder_id": "folder_uuid_or_null",
  "folder_name": "Work"
}
```

### 2. Real-Time Transcript Processor

```
POST /your-endpoint?session_id={session_id}&uid={user_id}
```

```json
[
  {
    "text": "会議は明日の10時に開始します",
    "speaker": "SPEAKER_00",
    "speaker_id": null,
    "is_user": false,
    "person_id": null,
    "start": 10.0,
    "end": 15.0
  },
  {
    "text": "了解しました",
    "speaker": "SPEAKER_01",
    "is_user": true,
    "start": 16.0,
    "end": 17.5
  }
]
```

**重要**: `session_id` で同一会話のセグメントを追跡できる。

### 3. Audio Bytes Stream

```
POST /your-endpoint?sample_rate=16000&uid={user_id}
Content-Type: application/octet-stream
```

- フォーマット: PCM16 (16-bit little-endian)
- サンプルレート: 16000 Hz
- WAV ヘッダーを先頭に付与すれば再生可能

```python
import wave
import io

def pcm_to_wav(pcm_data: bytes, sample_rate: int = 16000) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)  # モノラル
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)
    return buffer.getvalue()
```

### 4. Day Summary

```
POST /your-endpoint?uid={user_id}
```

```json
{
  "uid": "user123",
  "created_at": "2024-01-15T22:00:00.123456+00:00",
  "summary_json": {
    "date": "2024-01-15",
    "headline": "生産的な1日：3回のフォーカスセッション",
    "stats": {
      "total_conversations": 3,
      "total_duration_minutes": 87,
      "key_topics": ["プロジェクト管理", "技術設計"]
    },
    "action_items": [
      {"task": "レポートを送る", "priority": "high", "due": "明日"},
      {"task": "コードレビュー", "priority": "medium", "due": "今週中"}
    ],
    "highlights": ["重要な意思決定", "新しいアイデア"]
  }
}
```

---

## 完全な FastAPI 実装テンプレート

```python
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
import boto3
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
app = FastAPI(title="Omi Integration App")

# DynamoDB クライアント (AWS 統合時)
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
table = dynamodb.Table('omi-conversations')


@app.get("/setup")
async def setup_status(uid: str):
    """Omi がセットアップ完了確認のために呼ぶ (任意)"""
    user_configured = check_user_configured(uid)
    return {"is_setup_completed": user_configured}


@app.post("/webhook/memory")
async def handle_memory(
    request: Request,
    uid: str,
    background: BackgroundTasks
):
    """会話完了時に呼ばれる。必ず即座に 200 を返す。"""
    try:
        memory = await request.json()
        background.add_task(process_memory_async, uid, memory)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Memory webhook error: {e}")
        return {"status": "ok"}  # エラーでも 200 を返す (Omi のリトライ防止)


@app.post("/webhook/realtime")
async def handle_realtime(
    request: Request,
    session_id: str,
    uid: str,
    background: BackgroundTasks
):
    """リアルタイム文字起こしセグメントを受信"""
    segments = await request.json()
    background.add_task(process_realtime_async, uid, session_id, segments)
    return {"status": "ok"}


async def process_memory_async(uid: str, memory: dict):
    """バックグラウンドで会話を処理"""
    try:
        structured = memory.get("structured", {})
        segments = memory.get("transcript_segments", [])
        
        # 話者ごとにテキストをまとめる
        speaker_texts = {}
        for seg in segments:
            speaker = seg.get("speaker", "UNKNOWN")
            if speaker not in speaker_texts:
                speaker_texts[speaker] = []
            speaker_texts[speaker].append(seg["text"])
        
        # DynamoDB に保存
        table.put_item(Item={
            "uid": uid,
            "memory_id": memory["id"],
            "created_at": memory["created_at"],
            "title": structured.get("title", ""),
            "overview": structured.get("overview", ""),
            "action_items": structured.get("action_items", []),
            "speakers": list(speaker_texts.keys()),
            "full_transcript": json.dumps(segments, ensure_ascii=False),
            "ttl": int(datetime.now().timestamp()) + 86400 * 90  # 90日TTL
        })
        
        logger.info(f"[{uid}] Memory saved: {structured.get('title', '')}")
    except Exception as e:
        logger.error(f"Failed to process memory for {uid}: {e}")


async def process_realtime_async(uid: str, session_id: str, segments: list):
    """リアルタイムセグメントの処理 (トリガーワード検出など)"""
    combined_text = " ".join(seg["text"] for seg in segments)
    
    # トリガーワード検出
    trigger_words = ["メモして", "調べて", "タスクを追加", "覚えておいて"]
    for word in trigger_words:
        if word in combined_text:
            await handle_trigger(uid, word, combined_text)
            break


async def handle_trigger(uid: str, trigger: str, context: str):
    """トリガーワード検出時のアクション"""
    logger.info(f"[{uid}] Trigger '{trigger}' detected: {context}")
    # 通知送信、Slack 投稿、DynamoDB 保存など


def check_user_configured(uid: str) -> bool:
    """ユーザーの設定完了確認"""
    # TODO: DB チェックなど
    return True
```

---

## ローカル開発環境 (ngrok / tunnel)

```bash
# ngrok でローカルサーバーを公開
pip install ngrok
ngrok http 8000

# または cloudflare tunnel (無料・永続 URL)
cloudflared tunnel --url http://localhost:8000

# uvicorn でサーバー起動
uvicorn main:app --reload --port 8000
```

---

## Railway.app への本番デプロイ

```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
restartPolicyType = "ON_FAILURE"
```

```bash
# デプロイ
npm install -g @railway/cli
railway login
railway init
railway up
```

---

## Omi アプリの登録手順

1. Omi アプリ (iOS/Android) を開く
2. **Apps タブ** → 右上 **+** ボタン
3. **Integration** を選択
4. 設定を入力:
   - **App Name**: アプリ名
   - **Description**: 説明
   - **Webhook URL**: `https://your-server.com/webhook/memory`
   - **Trigger**: Memory Creation / Real-time Transcript から選択
   - **Setup URL** (任意): `https://your-server.com/setup`
5. **Save** → **Install**
6. デバイスで会話 → Webhook が届くか確認

---

## 認証とセキュリティ

Omi の Webhook は現在 `uid` クエリパラメータで認証する。
本番環境では以下の対策を推奨:

```python
import hmac
import hashlib

# Webhook シークレットによる署名検証 (任意実装)
def verify_webhook(body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

@app.post("/webhook/memory")
async def handle_memory(request: Request, uid: str):
    # uid の有効性確認
    if not is_valid_uid(uid):
        raise HTTPException(status_code=401, detail="Invalid uid")
    # ...
```
