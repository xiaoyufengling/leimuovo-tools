import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(repositoryRoot, "apps", "web", "dist");

const requiredFiles = [
  "index.html",
  "404.html",
  "about/index.html",
  "privacy/index.html",
  "offline/index.html",
  "tools/index.html",
  "tools/receipt-checker/index.html",
  "xiaoyugan/index.html",
  "robots.txt",
  "sitemap-index.xml",
  "sitemap-0.xml",
  "manifest.webmanifest",
  "favicon-rem-cat.ico",
  "favicon-rem-cat-32.png",
  "apple-touch-icon-rem-cat.png",
  "icons/rem-cat-brand-96.png",
  "icons/rem-cat-icon-192.png",
  "icons/rem-cat-icon-512.png",
  "icons/rem-cat-icon-maskable-512.png",
  "images/xiaoyugan-rem-face.png",
  "sw.js",
  "_headers",
  "_redirects",
  "vendor/tesseract/worker/worker.min.js",
  "vendor/tesseract/core/tesseract-core-lstm.wasm.js",
  "vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  "vendor/tesseract/lang/chi_sim.traineddata.gz",
  "vendor/tesseract/lang/eng.traineddata.gz",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function text(relativePath) {
  return readFile(path.join(dist, relativePath), "utf8");
}

await Promise.all(requiredFiles.map((relativePath) => access(path.join(dist, relativePath))));

const [home, tools, receipt, laboratory, robots, sitemap, manifestSource, serviceWorker, headers, redirects] = await Promise.all([
  text("index.html"),
  text("tools/index.html"),
  text("tools/receipt-checker/index.html"),
  text("xiaoyugan/index.html"),
  text("robots.txt"),
  text("sitemap-0.xml"),
  text("manifest.webmanifest"),
  text("sw.js"),
  text("_headers"),
  text("_redirects"),
]);

assert(home.includes('rel="canonical" href="https://leimuovo.com/"'), "首页 canonical 缺失或不正确");
assert(home.includes('rel="manifest" href="/manifest.webmanifest"'), "页面未声明 PWA manifest");
assert(home.includes('rel="icon" href="/favicon-rem-cat.ico"'), "页面未声明蕾姆猫耳 favicon");
assert(home.includes('/icons/rem-cat-brand-96.png'), "主站导航未使用蕾姆猫耳品牌图标");
assert(home.includes('"@type":"WebSite"'), "首页 WebSite JSON-LD 缺失");
assert(home.includes('"name":"小鱼"'), "首页品牌名称不正确");
assert(tools.includes('"@type":"CollectionPage"'), "工具目录 CollectionPage JSON-LD 缺失");
assert(receipt.includes('"@type":"SoftwareApplication"'), "工具页 SoftwareApplication JSON-LD 缺失");
assert(laboratory.includes('/images/xiaoyugan-rem-face.png'), "实验室未使用透明猫耳主图");
assert(laboratory.includes('/icons/rem-cat-brand-96.png'), "实验室导航未使用蕾姆猫耳品牌图标");
assert(!laboratory.includes('data-rem-parts'), "实验室不应在互动时替换核准主图");
const laboratoryCssHref = laboratory.match(/href="(\/_astro\/xiaoyugan\.[^"]+\.css)"/)?.[1];
assert(laboratoryCssHref, "实验室构建产物缺少独立样式表");
const laboratoryCss = await text(laboratoryCssHref.slice(1));
assert(/\.xyg-rem-face\{[^}]*-webkit-touch-callout:none[^}]*-webkit-user-select:none/u.test(laboratoryCss), "实验室主图缺少生产环境 iOS 长按保护");

assert(robots.includes("Disallow: /offline/"), "robots.txt 未排除离线页");
assert(robots.includes("Disallow: /control/"), "robots.txt 未排除私人控制中心");
assert(robots.includes("Disallow: /api/control/"), "robots.txt 未排除控制中心 API");
assert(robots.includes("Sitemap: https://leimuovo.com/sitemap-index.xml"), "robots.txt 未声明 sitemap");
assert(!sitemap.includes("/offline/"), "sitemap 不应包含离线页");
assert(!sitemap.includes("/404/"), "sitemap 不应包含 404");
assert(!sitemap.includes("/en/"), "首发 sitemap 不应包含未发布英文路由");

const manifest = JSON.parse(manifestSource);
assert(manifest.lang === "zh-CN", "PWA 默认语言必须是 zh-CN");
assert(manifest.name === "小鱼" && manifest.short_name === "小鱼", "PWA 品牌名称不正确");
assert(manifest.start_url === "/" && manifest.scope === "/", "PWA scope/start_url 不正确");
assert(manifest.icons?.some((icon) => icon.purpose === "maskable"), "PWA 缺少 maskable 图标");

assert(!serviceWorker.includes("NavigationRoute"), "Service Worker 不应启用 SPA 首页导航回退");
assert(serviceWorker.includes("NetworkFirst"), "Service Worker 缺少 Network First 页面策略");
assert(serviceWorker.includes('/control/'), "Service Worker 未显式排除私人控制中心路由");
assert(serviceWorker.includes('/api/control/'), "Service Worker 未显式排除控制中心 API 路由");
assert(serviceWorker.includes("PrecacheFallbackPlugin") && serviceWorker.includes("/offline/"), "离线回退未配置");
assert(serviceWorker.includes('/vendor/tesseract/'), "OCR 资源缺少按需运行时缓存");
assert(!serviceWorker.includes('_astro/receipt-checker.'), "小票工具 JS/CSS 不应进入全站预缓存");
assert(!serviceWorker.includes('url:"vendor/tesseract') && !serviceWorker.includes('url:"/vendor/tesseract'), "OCR 大文件不应进入全站预缓存");

for (const directive of [
  "Content-Security-Policy:",
  "'wasm-unsafe-eval'",
  "X-Content-Type-Options: nosniff",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Permissions-Policy:",
]) {
  assert(headers.includes(directive), `Cloudflare _headers 缺少 ${directive}`);
}
assert(redirects.includes("https://www.leimuovo.com/* https://leimuovo.com/:splat 301"), "www 301 跳转缺失");

console.log(`Verified ${requiredFiles.length} Cloudflare build artifacts and deployment invariants.`);
