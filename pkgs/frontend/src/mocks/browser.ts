/**
 * MSW ブラウザ設定（ローカル開発用モックモード）
 *
 * VITE_USE_MOCK=true のとき main.tsx から起動される。
 * テスト用の server.ts（msw/node）とは別系統。
 */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
