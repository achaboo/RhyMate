import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // kuromoji のブラウザ用プリビルドバンドルを使う（path モジュール問題を回避）
      kuromoji: resolve(__dirname, "node_modules/kuromoji/build/kuromoji.js"),
    },
  },
  build: {
    outDir: "dist",
  },
});
