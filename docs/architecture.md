# Architecture

小鱼是静态优先的工具站。`apps/web` 负责页面和 SEO，`packages` 中的深模块负责可复用行为，`apps/receipt-desktop` 是小票工具的第二个宿主。私人控制中心及实验室的极少量持久化接口由 `apps/control-worker` 按路径接管，不改变公开站点的静态输出。

## 模块与 seam

- 工具目录模块向页面暴露少量查询接口；元数据校验、排序和语言回退留在实现内。
- 小票模块只暴露挂载/销毁接口以及纯计算接口。
- 工作簿保存 seam 有两个真实 adapter：浏览器下载和 Electron IPC。
- OCR、文件内容和识别结果不跨网络 seam。
- 控制中心只通过 `control-core` 的认证和状态 interface 使用业务能力；Access JWT、Durable Object、浏览器网络探测和网站请求都是 adapter。
- `/control/*` 与 `/api/control/*` 默认由 Worker 原生密码会话保护；有条件时可通过认证 adapter 升级为 Cloudflare Access 加应用会话双重保护，并明确排除 PWA 缓存与公开 Analytics。
- `/api/lab/pets` 是公开实验室唯一的持久化 seam。浏览器生成随机匿名 ID，Durable Object 串行保存每个匿名访客的点击数和全站汇总；不写入姓名、邮箱、IP、User-Agent 或设备指纹，接口失败时页面只在本机保留即时反馈。

## 渐进升级

- React 不是基础依赖。首个明确需要 React 的工具出现时，再在 `apps/web` 加入 `@astrojs/react`，并仅对该工具启用 island。
- 公开工具默认不依赖 Worker；只有需要跨访客共享状态的实验（目前仅猫耳匿名计数）才经过明确的公开 API seam。私人控制中心继续使用同一个按路径接管、但认证边界独立的 Worker。
- 不引入 Turborepo；pnpm workspace 已足以管理当前规模。出现可测量的构建瓶颈后再评估任务缓存。
