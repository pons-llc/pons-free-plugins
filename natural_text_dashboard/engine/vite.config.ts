import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * kintoneプラグインが読み込む単一のIIFEバンドルを ../src/js に直接出力する。
 * kintoneプラグインの配布物はビルド成果物を含む単一zipのため、コード分割はしない。
 */
export default defineConfig({
  build: {
    outDir: resolve(__dirname, "../src/js"),
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, "src/kintone/entry.ts"),
      name: "NaturalTextDashboard",
      formats: ["iife"],
      fileName: () => "dashboard.bundle.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: "dashboard.bundle.[ext]",
      },
    },
  },
});
