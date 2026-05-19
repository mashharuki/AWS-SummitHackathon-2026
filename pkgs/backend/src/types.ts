/**
 * U-04 API 向け Hono アプリケーション型定義
 *
 * HonoVariables: ミドルウェアが設定する型付きコンテキスト変数
 * AppEnv: 型安全な c.get() / c.set() のための Hono ジェネリクス
 */

/** authMiddleware が伝郎するコンテキスト変数 */
export type HonoVariables = {
  userId: string;
};

/** Hono アプリ env ジェネリクス */
export type AppEnv = {
  Variables: HonoVariables;
};
