import { defineConfig } from "vite";

/**
 * Vite 构建配置。
 * base 用相对路径 "./"：产物既能放在域名根目录，也能放在 GitHub Pages 的
 * 项目子路径（https://<用户名>.github.io/<仓库名>/）下正常加载资源。
 */
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1200,
  },
});
