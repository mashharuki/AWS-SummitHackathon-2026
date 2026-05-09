# AG-03: PersonaRenderer — コンポーネントメソッド定義

**レイヤー**: エージェント（packages/agent）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § AG-03

---

## インターフェース定義

```typescript
interface IPersonaRenderer {
  render(input: RenderInput): Promise<RenderOutput>
}

interface RenderInput {
  verdict: Verdict                    // 'can_saboru' | 'caution' | 'danger'
  reasoning: string[]                 // 判断材料のリスト
  summaryText: string                 // 1行サマリ（口調変換前）
  rawChatMessage: string              // チャットメッセージ（口調変換前・中立口調）
  personaId: string                   // 使用するペルソナID（現在: 'saboru_ottori'）
}

interface RenderOutput {
  summaryText: string                 // 口調変換済みサマリ
  chatMessage: string                 // サボロー口調に変換済みチャットメッセージ
  verdictEmoji: string                // verdict に対応する絵文字
  verdictLabel: string                // 日本語ラベル
  personaId: string                   // 使用したペルソナID
}
```

---

## ペルソナ定義: `saboru_ottori`（おっとりサボロー）

```typescript
const SABORU_OTTORI_PERSONA = {
  id: 'saboru_ottori',
  displayName: 'サボロー',
  voiceStyle: {
    tone: 'gentle_and_supportive',    // 優しく、背中を押す
    ending: ['〜だよ', '〜ね', '〜かな', 'ふぅ〜'],
    filler: ['え〜と...', 'ん〜...', 'そうだな〜...'],
    emoji: { can_saboru: '☁️😌', caution: '🌤️🤔', danger: '⚡😰' },
  },
  verdictPhrases: {
    can_saboru: [
      'まだ寝かせてOKだよ ☁️',
      '今は休んでいいよ 😌',
      'ゆっくりしてて大丈夫 ☁️',
    ],
    caution: [
      'ちょっと気にしておいたほうがいいかな 🌤️',
      'そろそろ動き始めてもいいかもね 🤔',
    ],
    danger: [
      'これはさすがにまずいよ... ⚡',
      'ごめん、今回は動かないといけないかも 😰',
    ],
  },
  systemPrompt: `あなたはサボローです。おっとりした口調で、ユーザーが罪悪感なくサボれるよう優しく背中を押します。
以下のルールを守ってください:
- 語尾は「〜だよ」「〜ね」「〜かな」を使う
- 絵文字を自然に1〜2個使う
- 150文字以内に収める
- 判定根拠を1〜2文で優しく説明する
- 「can_saboru」なら背中を押す。「danger」なら優しく現実を伝える`,
}
```

---

## `render()` 実装

```typescript
async render(input: RenderInput): Promise<RenderOutput> {
  const persona = PERSONA_REGISTRY[input.personaId]  // saboru_ottori

  // Bedrock（Claude Haiku）で口調変換 + 絵文字付与
  const response = await bedrockClient.converse({
    modelId: 'anthropic.claude-haiku-3',
    system: [{ text: persona.systemPrompt }],
    messages: [{
      role: 'user',
      content: [{
        text: `以下の判断文をサボロー口調に変換してください:\n${input.rawChatMessage}`,
      }],
    }],
    toolConfig: {
      tools: [{ toolSpec: PERSONA_RENDER_TOOL }],
      toolChoice: { tool: { name: 'persona_render' } },
    },
  })

  const rendered = parseRenderOutput(response)
  const verdictEmoji = persona.voiceStyle.emoji[input.verdict]
  const verdictLabel = VERDICT_LABELS_JP[input.verdict]

  return {
    summaryText: rendered.summaryText,
    chatMessage: rendered.chatMessage,
    verdictEmoji,
    verdictLabel,
    personaId: input.personaId,
  }
}
```

---

## 依存サービス

- **Amazon Bedrock（Claude Haiku 3）** — 高速・低コストな口調変換（レスポンス品質よりレイテンシ優先）

## 関連要件

- FR-03: サボり提案のサボロー口調出力
- NFR-01: レイテンシ 3 秒以内（Haiku を使うことで低コスト・高速化）

## シーケンス参照

`application-design.md` § 7.2（サボり提案生成フロー — Phase 3 部分）
