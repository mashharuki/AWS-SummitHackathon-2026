import "@testing-library/jest-dom";
import { vi } from "vitest";

// chrome API モック（Chrome 拡張環境のシミュレーション）
const chromeMock = {
  runtime: {
    getURL: (path: string) => `chrome-extension://test-extension/${path}`,
    sendMessage: () => Promise.resolve(),
    onMessage: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
  tabs: {
    create: vi.fn(() => Promise.resolve()),
  },
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    },
  },
  sidePanel: {
    setOptions: () => Promise.resolve(),
    open: () => Promise.resolve(),
  },
  action: {
    onClicked: {
      addListener: () => {},
    },
  },
};

Object.defineProperty(global, "chrome", {
  writable: true,
  configurable: true,
  value: chromeMock,
});

// matchMedia モック
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
