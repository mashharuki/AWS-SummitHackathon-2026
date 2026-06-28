import "@testing-library/jest-dom";
import { vi } from "vitest";

const defaultPort = {
  name: "SABOROU_SIDE_PANEL",
  postMessage: vi.fn(),
  disconnect: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
  },
  onDisconnect: {
    addListener: vi.fn(),
  },
};

// chrome API モック（Chrome 拡張環境のシミュレーション）
const chromeMock = {
  runtime: {
    getURL: (path: string) => `chrome-extension://test-extension/${path}`,
    sendMessage: vi.fn(() => Promise.resolve(undefined)),
    connect: vi.fn(() => defaultPort),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onConnect: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    create: vi.fn(() => Promise.resolve()),
    query: vi.fn(() => Promise.resolve([])),
    captureVisibleTab: vi.fn(() =>
      Promise.resolve("data:image/jpeg;base64,test"),
    ),
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    },
    session: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    },
  },
  sidePanel: {
    setOptions: vi.fn(() => Promise.resolve()),
    open: vi.fn(() => Promise.resolve()),
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
  notifications: {
    create: vi.fn(() => Promise.resolve("notification-id")),
    clear: vi.fn(() => Promise.resolve(true)),
    getPermissionLevel: vi.fn(() => Promise.resolve("granted" as const)),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  windows: {
    getCurrent: vi.fn(() => Promise.resolve({ id: 1 })),
    getLastFocused: vi.fn(() => Promise.resolve({ id: 1 })),
    update: vi.fn(() => Promise.resolve({ id: 1 })),
    create: vi.fn(() => Promise.resolve({ id: 1 })),
  },
  alarms: {
    create: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve(true)),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
};

Object.defineProperty(defaultPort, "sender", {
  configurable: true,
  value: undefined,
});

Object.defineProperty(chromeMock, "__defaultPort", {
  configurable: true,
  value: defaultPort,
});

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
