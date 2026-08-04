import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const slug = argument("slug");
const title = argument("title");
const category = argument("category") ?? "效率工具";
const type = argument("type") ?? "static";

if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  throw new Error("请提供 kebab-case slug，例如 --slug text-cleaner");
}
if (!title?.trim()) throw new Error("请提供工具标题，例如 --title \"文本清理\"");
if (!["static", "vanilla"].includes(type)) throw new Error("--type 仅支持 static 或 vanilla；React 按需接入，不作为默认模板");

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metadataPath = path.join(repositoryRoot, "apps", "web", "src", "data", "tools", `${slug}.json`);
const pagePath = path.join(repositoryRoot, "apps", "web", "src", "pages", "tools", `${slug}.astro`);
const copy = {
  title: title.trim(),
  summary: "请补充一句清晰说明这个工具解决的问题。",
  seoDescription: "请补充完整的搜索描述，说明用途、处理位置和主要能力。",
};
const metadata = {
  slug,
  category,
  status: "beta",
  icon: "text",
  processing: "local",
  featured: false,
  locales: { "zh-CN": copy },
};
const clientScript = type === "vanilla"
  ? `\n  <script>\n    const root = document.querySelector('[data-tool-root="${slug}"]');\n    if (root) root.textContent = '在这里挂载 ${title.trim()} 的原生 TypeScript 模块。';\n  </script>`
  : "";
const page = `---
import ToolLayout from "../../layouts/ToolLayout.astro";
import { getToolBySlug } from "../../modules/tool-catalog";

const tool = getToolBySlug("${slug}");
if (!tool) throw new Error("Tool metadata is missing: ${slug}");
---

<ToolLayout tool={tool}>
  <section class="tool-canvas lm-container">
    <div class="lm-card" data-tool-root="${slug}" style="padding: var(--lm-space-6);">
      <p>请实现 ${title.trim()} 的主要界面。</p>
    </div>
  </section>${clientScript}
</ToolLayout>
`;

await mkdir(path.dirname(metadataPath), { recursive: true });
await mkdir(path.dirname(pagePath), { recursive: true });
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
try {
  await writeFile(pagePath, page, { encoding: "utf8", flag: "wx" });
} catch (error) {
  throw new Error(`页面创建失败；元数据已创建在 ${metadataPath}，请检查同名页面：${String(error)}`);
}

console.log(`Created ${title.trim()} at /tools/${slug}/`);
