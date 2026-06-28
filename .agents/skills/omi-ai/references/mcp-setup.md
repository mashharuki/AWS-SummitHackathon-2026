# Omi MCP セットアップ詳細ガイド

## Omi MCP とは

Omi のメモリ・会話データに Claude / Cursor などの AI が直接アクセスできるようになる仕組み。

```
Claude Desktop
    │ MCP プロトコル
    ▼
Omi MCP Server (uvx omi-mcp-server)
    │ REST API
    ▼
Omi Cloud (api.omi.me)
    │
    ▼
あなたの Omi の記憶・会話データ
```

---

## セットアップ手順

### 1. API キーの取得

Omi アプリ → Settings → Developer → API Keys → **Create New Key**

### 2. Claude Desktop の設定

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
// %APPDATA%\Claude\claude_desktop_config.json (Windows)
{
  "mcpServers": {
    "omi": {
      "command": "uvx",
      "args": ["omi-mcp-server"],
      "env": {
        "OMI_API_KEY": "omi_dev_your_api_key_here"
      }
    }
  }
}
```

### 3. Cursor の設定

```json
// .cursor/mcp.json (プロジェクトルート)
{
  "mcpServers": {
    "omi": {
      "command": "uvx",
      "args": ["omi-mcp-server"],
      "env": {
        "OMI_API_KEY": "omi_dev_your_api_key_here"
      }
    }
  }
}
```

### 4. 動作確認

Claude に「昨日の会話を教えて」と聞く → Omi の会話データが返ってくれば成功。

---

## 利用可能なツール一覧

| ツール名 | 説明 | パラメータ |
|---------|------|-----------|
| `search_memories` | セマンティック検索でメモリを検索 | `query`, `limit` |
| `get_memories` | メモリ一覧の取得 | `limit`, `offset` |
| `create_memory` | 新しいメモリを作成 | `content`, `tags` |
| `edit_memory` | 既存メモリを更新 | `memory_id`, `content` |
| `delete_memory` | メモリを削除 | `memory_id` |
| `get_conversations` | 会話一覧の取得 | `limit`, `offset` |
| `search_conversations` | 会話のセマンティック検索 | `query`, `limit` |
| `get_conversation_by_id` | 特定の会話を取得 | `conversation_id` |

---

## Python SDK での使用例

```python
from mcp import MultiServerMCPClient
import asyncio

async def search_omi_memories(query: str):
    async with MultiServerMCPClient({
        "omi": {
            "command": "uvx",
            "args": ["omi-mcp-server"],
            "env": {"OMI_API_KEY": "omi_dev_your_key"}
        }
    }) as client:
        result = await client.call_tool("omi", "search_memories", {
            "query": query,
            "limit": 5,
        })
        return result

# LangChain との統合
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

async def create_omi_agent():
    async with MultiServerMCPClient(...) as client:
        tools = client.get_tools()
        agent = create_react_agent("claude-3-5-sonnet", tools)
        response = await agent.ainvoke({
            "messages": [{"role": "user", "content": "今日の会議について教えて"}]
        })
        return response
```

---

## Bedrock AgentCore Gateway との統合 (SABOROU Memory 用)

Bedrock AgentCore Gateway は Omi の API を MCP サーバーとして公開できる。

```bash
# AgentCore CLI でゲートウェイを作成
aws bedrock-agentcore create-gateway \
  --name "saborou-memory-gateway" \
  --openapi-spec file://openapi-spec.yaml \
  --description "SABOROU Memory API Gateway"
```

これにより Bedrock Agent から `searchMemories`, `notifyMemory` などのツールを MCP 経由で呼び出せる。

---

## トラブルシューティング

| 問題 | 原因 | 対処 |
|------|------|------|
| `uvx: command not found` | uv 未インストール | `pip install uv` |
| `OMI_API_KEY not set` | 環境変数なし | config.json に env セクションを追加 |
| メモリが返ってこない | データなし | Omi デバイスで会話してからリトライ |
| 日本語メモリが英語 | Omi のデフォルト動作 | アプリのプロンプト設定で日本語指定 |
