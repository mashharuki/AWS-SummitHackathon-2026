import "@testing-library/jest-dom";

// chrome API モック（Chrome 拡張環境のシミュレーション）
const chromeMock = {
  runtime: {
    sendMessage: () => Promise.resolve(),
    onMessage: {
      addListener: () => {},
      removeListener: () => {},
    },
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
