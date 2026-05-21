/**
 * MSW サーバー設定（Node.js環境 / vitest）
 */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
