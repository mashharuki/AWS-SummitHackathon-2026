import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { build, defineConfig, type Plugin } from "vite";

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
  plugins: [tailwindcss(), react(), chromeExtensionPlugin()],

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
