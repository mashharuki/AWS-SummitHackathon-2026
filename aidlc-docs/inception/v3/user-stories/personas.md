# SABOROU v3 Personas - MCP Serverization

**作成日**: 2026-06-16
**対象**: 音声AgentによるSABOROU機能呼び出しとSlack `@Claude` 委譲

---

## Persona P-V3-01: Slack対応を委ねたいデモ利用者

**属性**:

- 職種: ハッカソン審査員に見せるデモユーザー / 多忙なSlackワーカー
- ITリテラシー: 中〜高
- 利用環境: Chrome拡張 Side Panel、Slack、ElevenLabs音声Agent

**課題**:

- Slackで来た依頼にすぐ返信するのが面倒。
- どのタスクをやるべきか、どれを先延ばしできるか判断したくない。
- 手でAPIや画面を操作せず、声だけでSABOROUに任せたい。

**ゴール**:

- 音声でタスク一覧を聞く。
- SABOROUの返信案を聞いて、音声で承認する。
- 必要なら選んだタスクをSlack上の `@Claude` に委譲する。

---

## Persona P-V3-02: 副作用を安全に制御したいSABOROU開発者

**属性**:

- 職種: SABOROU開発者 / デモ運用担当
- ITリテラシー: 高
- 利用環境: pnpm monorepo、AWS CDK、AgentCore Gateway、Hono API、Chrome拡張

**課題**:

- AgentCore GatewayとHono APIの認証経路がズレると、MCP経由だけ動かない。
- Slack送信や `@Claude` メンションは副作用が大きく、誤送信を避けたい。
- OpenAPI定義が二重管理で、MCP公開漏れが起きやすい。

**ゴール**:

- 実AWS / AgentCore / ElevenLabs接続まで検証できる。
- MCPツールのallowlistと認可をテストで固定する。
- 認証失敗や権限不足を安全に観測できる。

---

## Persona P-V3-03: Slack上で依頼を受けるClaude

**属性**:

- 種別: Slack上の外部AI協業者
- ITリテラシー: 高
- 利用環境: Slackメンションによるタスク受領

**課題**:

- 曖昧な依頼文では実行内容や成果物が不明になる。
- SABOROUが投稿した文面に、期限、背景、期待成果物がないと動きづらい。

**ゴール**:

- `@Claude` メンションで、実行可能な粒度の依頼を受け取る。
- タスクタイトル、背景、成果物、制約を1つのSlack投稿で理解する。

---

## Persona-to-Story Mapping

| Persona | Related Stories |
|---------|-----------------|
| P-V3-01 | US-V3-01, US-V3-02, US-V3-03, US-V3-04, US-V3-05 |
| P-V3-02 | US-V3-06, US-V3-07, US-V3-08, US-V3-09 |
| P-V3-03 | US-V3-05 |
