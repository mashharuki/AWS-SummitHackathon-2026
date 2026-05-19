# テックスタック決定 — U-05: web

**Unit**: U-05: web
**ステージ**: CONSTRUCTION / NFR Requirements
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 採用技術スタック

| カテゴリ | ライブラリ / ツール | バージョン | 選定理由 |
|---------|-------------------|-----------|---------|
| UI フレームワーク | React | 19.2.6 | 既存ベース・Concurrent Features |
| 言語 | TypeScript | ~6.0.2 | 型安全・pkgs/shared 型共有 |
| ビルドツール | Vite | 8.x | HMR 高速・コード分割 |
| コンポーネントライブラリ | shadcn/ui | latest | Tailwind ネイティブ・カスタマイズ自由 |
| スタイリング | Tailwind CSS | 4.x | ユーティリティファースト・高速 UI |
| ルーティング | React Router | v7 | 業界標準・型安全 |
| 認証 | amazon-cognito-identity-js | latest | Cognito JWT 管理 |
| APIクライアント | fetch（ネイティブ） + カスタム wrapper | - | 軽量・型安全 |
| SSEストリーミング | Vercel AI SDK（useChat） | latest | UI との SSE 統合が簡潔 |
| 3D描画 | @react-three/fiber + @react-three/drei | v9 / v10 | React 統合 Three.js |
| テスト（ユニット） | Vitest + @testing-library/react | 4.x | Vite 統合・高速 |
| テスト（E2E） | Playwright | 1.60.x | 既存設定あり |
| APIモック | msw（Mock Service Worker） | v2 | ブラウザ / Node.js 両対応 |
| コード品質 | Biome | 1.9.x 相当（pnpm workspace 統一） | 既存設定に合わせる |

---

## 追加インストール要パッケージ

```json
{
  "dependencies": {
    "react-router-dom": "^7.0.0",
    "amazon-cognito-identity-js": "^6.3.7",
    "ai": "^4.x",              // Vercel AI SDK
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^10.0.0",
    "three": "^0.172.0",
    "class-variance-authority": "^0.7.0",  // shadcn/ui 依存
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.400.0",           // shadcn/ui アイコン
    "@saboru/shared": "workspace:*"        // pkgs/shared 型インポート
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@testing-library/jest-dom": "^6.4.2",
    "msw": "^2.3.0",
    "@types/three": "^0.172.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

---

## 除外した技術と理由

| 検討技術 | 除外理由 |
|---------|---------|
| Zustand / Redux | MVP規模では useState + useContext で十分 |
| React Query / SWR | カスタムフックで十分。SSEとの統合も容易 |
| Storybook | 時間制約あり・E2Eで代替 |
| Next.js | 静的サイト配信 + Lambda 分離アーキテクチャと整合しない |
| Axios | fetch ネイティブで十分（ポリフィル不要）|
