import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

// MSW サーバー起動
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// matchMedia モック — Object.defineProperty で configurable:true に設定することで
// Vitest teardown 時の "Cannot delete property" エラーを回避する
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// crypto モック — randomUUID / getRandomValues を提供（subtle は cognito.test.ts が個別オーバーライド）
Object.defineProperty(window, "crypto", {
  writable: true,
  configurable: true,
  value: {
    randomUUID: () => `test-uuid-${Math.random().toString(36).slice(2)}`,
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
});
