# NFR Requirements — U-05: web

**Unit**: U-05: web
**ステージ**: CONSTRUCTION / NFR Requirements
**作成日**: 2026-05-17
**バージョン**: 1.0.0
**方針**: 品質最大化（ハッカソン予選デモ・審査員が直接見る画面）

---

## 1. パフォーマンス要件

### NFR-WEB-P1: 初期ロード
- **要件**: Vite バンドルの初期 TTI（Time to Interactive）を 3秒以内（4G回線想定）
- **計測**: Lighthouse スコア 90以上（Performance）
- **対策**: コード分割（React.lazy + Suspense）・Three.js 遅延ロード

### NFR-WEB-P2: タスク一覧レスポンス
- **要件**: `/tasks` 画面のデータ取得・描画完了を 2秒以内
- **対策**: Promise.all による並列取得、楽観的 UI 更新

### NFR-WEB-P3: SSEストリーミング初回チャンク
- **要件**: `/api/tasks/:id/proposal?stream=true` の最初のチャンクをユーザーが 3秒以内に視認できること
- **ローディング表示**: スケルトンアニメーションでストリーミング開始を即座に伝える

### NFR-WEB-P4: Three.js フレームレート
- **要件**: Three.js キャラクターアニメーションが 60fps で動作（デスクトップ）
- **対策**: `useFrame` の最適化・`Suspense` ロード・Canvas 固定サイズ

---

## 2. セキュリティ要件

### NFR-WEB-S1: JWT 保管
- **要件**: `accessToken` はメモリのみで管理（localStorage 禁止）
- **rationale**: XSS 攻撃によるトークン窃取リスクを最小化
- **refreshToken**: localStorage に保存（Cognito SDK 標準の保管先）

### NFR-WEB-S2: CSRF 対策（OAuth フロー）
- **要件**: Cognito Hosted UI リダイレクト前に `state` を `crypto.randomUUID()` で生成し sessionStorage に保存。コールバック時に検証する

### NFR-WEB-S3: XSS 防止
- **要件**: ユーザー入力テキストの直接 `innerHTML` 設定禁止。React の JSX テキスト補間を使用
- **サボロー返答テキスト**: APIレスポンスはテキストとして表示（HTMLサニタイズ不要だがマークダウンレンダリングは行わない）

### NFR-WEB-S4: 環境変数管理
- **要件**: API エンドポイント / Cognito 設定は `VITE_` プレフィックスの環境変数で管理
- **ビルド時埋め込み**: Vite の `import.meta.env` 経由でアクセス
- `.env.example` を提供する（実際の値はコミットしない）

### NFR-WEB-S5: Content Security Policy
- **要件**: CloudFront のレスポンスヘッダーポリシーで CSP を設定
- `frame-ancestors: 'none'`・`default-src: 'self'`・`connect-src: 'self' *.amazonaws.com`

---

## 3. 信頼性要件

### NFR-WEB-R1: APIエラーハンドリング
- **要件**: 全APIエラーをトースト通知で伝達。ユーザーが再試行できること
- **ネットワーク断**: `navigator.onLine` を監視し、オフライン時にバナー表示

### NFR-WEB-R2: SSEストリーミング障害対応
- **要件**: EventSource がエラーになった場合（接続断 / 5xx）、自動で1回リトライ。リトライも失敗した場合はエラーメッセージをチャット欄に表示
- **フォールバック**: `GET /api/tasks/:id/proposal`（非ストリーミング）で最新 Proposal を取得して表示

### NFR-WEB-R3: 楽観的更新のロールバック
- **要件**: 承認・削除操作の楽観的更新が API 失敗した場合、UI 状態を操作前に確実にロールバックする

### NFR-WEB-R4: Three.js 障害分離
- **要件**: Three.js キャラクターの描画エラーが発生してもチャット機能に影響を与えない
- **対策**: `ErrorBoundary` で Three.js Canvas をラップし、絵文字フォールバックへ切り替える

---

## 4. アクセシビリティ要件

### NFR-WEB-A1: WCAG 2.1 AA 準拠
- コントラスト比 4.5:1 以上
- キーボードナビゲーション全対応
- スクリーンリーダー対応（`aria-label` / `role` / `aria-live`）

### NFR-WEB-A2: モーション低減対応
- `prefers-reduced-motion: reduce` 時に Three.js アニメーション無効化・静止フォールバック
- CSS アニメーションも同様に制御

---

## 5. ユーザビリティ要件

### NFR-WEB-U1: レスポンシブ対応
- 320px〜1920px の幅で正常表示
- タスク詳細: 768px 未満でタブ切替 UI

### NFR-WEB-U2: ローディング状態
- データ取得中は必ずスケルトン or スピナーを表示
- ボタン操作中は disabled + ローディングインジケーター

### NFR-WEB-U3: フォームバリデーション
- インライン編集・手動追加フォーム・自由テキスト入力で即時バリデーションメッセージを表示
- 送信ボタンのdisabled制御（空文字・上限超過）

---

## 6. テスト要件

### NFR-WEB-T1: ユニットテスト
- **ツール**: Vitest + @testing-library/react
- **カバレッジ目標**: Statements 80%以上（Three.js コンポーネントは除外）
- **対象**: カスタムフック（useAuth / useTasks / useProposalStream / useConnections）・ユーティリティ関数

### NFR-WEB-T2: コンポーネントテスト
- **ツール**: @testing-library/react
- **対象**: TaskCard（pending/approved モード）/ VerdictBox（3状態）/ LoginPage / QuickReplyButtons / FreeTextInput

### NFR-WEB-T3: E2Eテスト（Playwright）
- **ツール**: Playwright（既存設定あり）
- **対象シナリオ**:
  1. ログインフロー（モック）
  2. タスク一覧表示 → タスク承認
  3. タスク詳細 → チャット送信
  4. 設定 → Slack 連携ボタン表示

### NFR-WEB-T4: MSW（Mock Service Worker）によるAPI モック
- **ツール**: msw（Storybook / Vitest / Playwright 共通）
- **用途**: APIをモックしてフロントエンド単体でテスト実行可能にする

---

## 7. 可観測性要件

### NFR-WEB-O1: エラーバウンダリ
- アプリ全体を React ErrorBoundary でラップし、致命的エラー時に友好的なエラー画面を表示する

### NFR-WEB-O2: コンソールログ
- 開発時のみ `console.log` を許容。`NODE_ENV === 'production'` 時はログ抑制
