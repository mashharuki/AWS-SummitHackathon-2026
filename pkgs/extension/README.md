# SABOROU Chrome 拡張（v2）

Slack のメッセージを検知し、AI が返信案を生成、ワンクリック（または音声「いいよ」）で
Slack に自動返信するサボり支援アシスタント。

## チームメンバー向け：動かすまでの手順

固定 Extension ID（`klnbcafcphlnmbdbjgmpdjfeimenokmj`）を使うため、
ビルドして読み込めば**そのままログインまで動きます**（音声を除く）。

### 1. ビルド

リポジトリのルートで依存をインストールし、拡張をビルドする。

```bash
# リポジトリルートで
pnpm install

# 拡張パッケージで環境変数を用意してビルド
cd pkgs/extension
cp .env.example .env.local   # 共有リソースの値が入っているのでそのまま使える
pnpm build
```

`dist/` に Chrome 拡張一式（manifest.json / panel.html / background.js / content.js / icons）が出力される。

### 2. Chrome に読み込む

1. `chrome://extensions` を開く
2. 右上「**デベロッパー モード**」を ON
3. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
4. `pkgs/extension/dist` フォルダを選択
5. Extension ID が `klnbcafcphlnmbdbjgmpdjfeimenokmj` になっていることを確認
   （固定 key により全員同じ ID になる）

### 3. ログイン

1. Chrome ツールバーの SABOROU アイコンをクリック → Side Panel が開く
2. 「**ログイン**」ボタン → Cognito Hosted UI でサインアップ / ログイン
   （メールアドレス + パスワード。Google ログインは現在無効）

### 4. Slack 連携を試す

1. Chrome で Slack（`https://app.slack.com/...`）を開く
2. 自分宛て（@メンション or DM）の新しいメッセージが届くと、
   Side Panel に「Slack 新着」カードが出て、AI が返信案を生成する
3. 「**いいよ**」ボタンで Slack に返信を送信

> Slack への返信送信には、自分の Slack Bot Token がバックエンドに登録されている必要がある。
> 未登録の場合は送信時にエラーになる（連携手順はチームに確認）。

## 音声対話（任意）

音声で「いいよ」と言って承認したい場合は、`.env.local` に ElevenLabs の
`VITE_ELEVENLABS_AGENT_ID` を設定する（ElevenLabs ダッシュボードで Conversational AI Agent を作成）。
未設定でも「いいよ」ボタンで全フローが動く。

注意: Chrome 拡張 Side Panel のマイク権限は Manifest V3 の制約があり、
環境によっては音声接続に追加対応が必要（現在調整中）。

## 開発

```bash
pnpm dev        # vite build --watch（変更を監視して dist 再生成）
pnpm test       # Vitest ユニットテスト
pnpm build      # 本番ビルド
npx tsc --noEmit  # 型チェック
```

## 構成

| ディレクトリ | 役割 |
|-------------|------|
| `src/panel/` | Side Panel UI（React）・音声フック・承認フロー・API クライアント |
| `src/content/` | content script（Slack DOM 検知・自動入力） |
| `src/background/` | service worker（Side Panel 起動） |
| `src/auth/` | Cognito PKCE 認証 |
