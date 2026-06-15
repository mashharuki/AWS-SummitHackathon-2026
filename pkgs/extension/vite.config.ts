import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type Plugin, build, defineConfig } from "vite";

const ELEVENLABS_WORKLET_LOADER_START = "const b=new Map;function k(e,t){";
const ELEVENLABS_WORKLET_LOADER_END = '}const C=k("raw-audio-processor",';

/**
 * @11labs/client 0.2.0 creates AudioWorklets from blob:/data: URLs. Chrome
 * Manifest V3 extension pages reject both under the required CSP, so point the
 * SDK at equivalent worklet files packaged with the extension.
 */
function elevenLabsExtensionWorkletsPlugin(): Plugin {
  let transformed = false;

  return {
    name: "elevenlabs-extension-worklets",
    enforce: "pre",
    transform(code, id) {
      if (
        !id.endsWith("/dist/lib.modern.js") ||
        !code.includes("raw-audio-processor") ||
        !code.includes("Failed to load the")
      ) {
        return null;
      }

      const start = code.indexOf(ELEVENLABS_WORKLET_LOADER_START);
      const end = code.indexOf(ELEVENLABS_WORKLET_LOADER_END, start);
      if (start === -1 || end === -1) {
        throw new Error(
          "Unable to patch the ElevenLabs AudioWorklet loader. Check the installed @11labs/client version.",
        );
      }

      transformed = true;
      const loader =
        "const b=new Map;function k(e,t){return async n=>{const s=chrome.runtime.getURL(`worklets/${e}.js`);return n.addModule(s)}}";

      return {
        code: `${code.slice(0, start)}${loader}${code.slice(end + 1)}`,
        map: null,
      };
    },
    buildEnd() {
      if (!transformed) {
        throw new Error(
          "The ElevenLabs AudioWorklet loader was not found during the extension build.",
        );
      }
    },
  };
}

/**
 * Chrome 拡張ビルド設定（手動マルチエントリ方式）
 *
 * crxjs/vite-plugin は Vite 8 系との互換性が不安定なため、
 * 手動マルチエントリ + rollup の Chrome 拡張向け設定を採用する。
 * - panel.html  : Side Panel UI (React 19)
 * - background  : Service Worker (ESM)
 * - content     : Content Script (IIFE, 単一ファイル, ハッシュなし固定名)
 * dist/ 直下に manifest.json をコピーし、Chrome に読み込ませる。
 *
 * Content script は IIFE フォーマットで出力する必要がある。
 * ESM では chrome.runtime へのアクセスが制限されるページ環境で動作しないため。
 * Rollup の output.format をエントリ別に制御できないため、
 * content script のみ別の Rollup インスタンスでビルドする。
 */

/**
 * manifest.json と icons/ を dist/ にコピーするプラグイン
 * Chrome 拡張の読み込みには manifest.json が dist 直下に必要
 */
function chromeExtensionPlugin(): Plugin {
  return {
    name: "chrome-extension-copy",
    async closeBundle() {
      // manifest.json をコピー
      copyFileSync(
        resolve(__dirname, "manifest.json"),
        resolve(__dirname, "dist/manifest.json"),
      );
      // icons/ ディレクトリをコピー（存在する場合）
      try {
        const iconsDir = resolve(__dirname, "icons");
        const distIconsDir = resolve(__dirname, "dist/icons");
        mkdirSync(distIconsDir, { recursive: true });
        for (const file of readdirSync(iconsDir)) {
          copyFileSync(`${iconsDir}/${file}`, `${distIconsDir}/${file}`);
        }
      } catch {
        // icons ディレクトリが存在しない場合はスキップ
      }

      // content script を IIFE 形式で別ビルド（Chrome content script に必要）
      // panel/background とは別ビルドにして format: "iife" を強制する
      await build({
        configFile: false,
        resolve: {
          alias: {
            "@": resolve(__dirname, "src"),
          },
        },
        build: {
          outDir: resolve(__dirname, "dist"),
          emptyOutDir: false, // panel/background の成果物を消さない
          lib: {
            entry: resolve(__dirname, "src/content/index.ts"),
            name: "SaborouContentScript",
            formats: ["iife"],
            fileName: () => "content.js",
          },
          rollupOptions: {
            output: {
              // IIFE 全体を即時実行させる（content script として必要）
              inlineDynamicImports: true,
            },
          },
        },
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    elevenLabsExtensionWorkletsPlugin(),
    chromeExtensionPlugin(),
  ],

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Chrome 拡張は ESM で動作するのでモジュール形式を維持
    modulePreload: false,
    rollupOptions: {
      input: {
        // Side Panel エントリ
        panel: resolve(__dirname, "panel.html"),
        // Side Panelで許可UIを表示できない場合に使うマイク権限取得ページ
        micPermission: resolve(__dirname, "mic-permission.html"),
        // Service Worker エントリ（ESM。manifest.json の "type": "module" と対応）
        background: resolve(__dirname, "src/background/index.ts"),
      },
      output: {
        // Chunk ファイルのエントリポイント名を維持（Chrome が manifest で参照するため）
        entryFileNames: (chunkInfo) => {
          // background service worker は dist/background.js として出力
          if (chunkInfo.name === "background") return "background.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },

  // Vitest 設定
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
  },
});
