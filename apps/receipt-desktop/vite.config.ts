import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  publicDir: path.resolve(appDirectory, "../web/public"),
  build: {
    outDir: "renderer-dist",
    emptyOutDir: true,
  },
});
