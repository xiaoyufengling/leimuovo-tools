# Leimuovo Tools

Leimuovo 是一个静态优先、隐私优先的个人工具站。网站部署到 Cloudflare Pages，文件类工具优先在浏览器本机处理。

## 开发

要求 Node.js 24 和 pnpm 11.9.0。

```powershell
pnpm install
pnpm dev
```

常用命令：

```powershell
pnpm check
pnpm test
pnpm build:web
pnpm verify:build
pnpm test:browser
pnpm new:tool -- --slug text-cleaner --title "文本清理"
```

## Cloudflare Pages

- 构建命令：`pnpm run cf:build`
- 输出目录：`apps/web/dist`
- 生产分支：`main`
- 环境变量：`NODE_VERSION=24`、`PNPM_VERSION=11.9.0`

完整域名和部署步骤见 `docs/deployment.md`。
