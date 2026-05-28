import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll } from "vitest";
import "./i18n";
import i18n from "./i18n";
import { server } from "./mocks/server";

// MSW サーバー起動
beforeAll(() => {
  void i18n.changeLanguage("ja");
  server.listen({ onUnhandledRequest: "bypass" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// PointerEvent ポリフィル — jsdom は PointerEvent 未実装のため、MouseEvent を
// 継承した最小実装を提供する。これにより fireEvent.pointer*（ガント編集テスト）で
// clientX / pointerId がハンドラに正しく伝わる（MouseEvent は clientX を honors する）。
if (typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
    }
  }
  Object.defineProperty(window, "PointerEvent", {
    writable: true,
    configurable: true,
    value: PointerEventPolyfill,
  });
  // Element.setPointerCapture / releasePointerCapture も未実装のため no-op を補う
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
}

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
