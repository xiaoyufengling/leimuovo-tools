# Architecture

Leimuovo 是静态优先的工具站。`apps/web` 负责页面和 SEO，`packages` 中的深模块负责可复用行为，`apps/receipt-desktop` 是小票工具的第二个宿主。

## 模块与 seam

- 工具目录模块向页面暴露少量查询接口；元数据校验、排序和语言回退留在实现内。
- 小票模块只暴露挂载/销毁接口以及纯计算接口。
- 工作簿保存 seam 有两个真实 adapter：浏览器下载和 Electron IPC。
- OCR、文件内容和识别结果不跨网络 seam。

## 渐进升级

- React 不是基础依赖。首个明确需要 React 的工具出现时，再在 `apps/web` 加入 `@astrojs/react`，并仅对该工具启用 island。
- 第一版没有 Worker。未来只有在浏览器无法完成某项能力时，才定义 port，并用 Cloudflare Worker adapter 与测试 adapter 实现。
- 不引入 Turborepo；pnpm workspace 已足以管理当前规模。出现可测量的构建瓶颈后再评估任务缓存。
