# 小鱼控制中心

控制中心由 Cloudflare Access、Cloudflare Worker 和应用内用户名密码共同保护。公开 Astro 站点仍由 Pages 静态部署，Worker 只接管 `/control/*` 与 `/api/control/*`。

## 本地预览

```powershell
pnpm dev:control
```

打开 `http://localhost:4322/control/`。开发服务器接受任意非空用户名和密码，只提供本地模拟状态；这段逻辑只存在于 Vite 开发中，不会进入生产构建。

## 1. 创建 Cloudflare Access 应用

1. Cloudflare Zero Trust 进入 **Access → Applications → Add an application → Self-hosted**。
2. 名称填写“小鱼控制中心”，会话时长设为 12 小时。
3. 在同一个应用中添加 `leimuovo.com/control/*` 与 `leimuovo.com/api/control/*` 两个 Public hostname/path。
4. 建立 Allow 策略，仅允许 Emails `xiaoyuqaq69@gmail.com`，登录方式启用 One-time PIN。
5. 记录应用的 AUD Tag，以及 Zero Trust 的 Team domain，例如 `xiaoyu.cloudflareaccess.com`。如果控制台只能建立两个独立 Access 应用，将两个 AUD Tag 用英文逗号连接后写入 `CONTROL_ACCESS_AUD`。

必须先完成 Access 再部署 Worker 路由。Worker 仍会独立验证 Access JWT，所以直接 Worker 请求和伪造邮箱请求头都会被拒绝。

## 2. 生成凭据

在本地交互式终端运行：

```powershell
pnpm control:hash-password
```

输入不会显示。命令只输出 PBKDF2 哈希，明文不会写入文件。另行生成至少 32 字节随机会话密钥：

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

不要把用户名、哈希或会话密钥提交到 Git。

## 3. 设置 Worker secrets

在仓库根目录登录 Wrangler，然后逐项输入值：

```powershell
pnpm --filter @leimuovo/control-worker exec wrangler login
pnpm --filter @leimuovo/control-worker exec wrangler secret put CONTROL_USERNAME
pnpm --filter @leimuovo/control-worker exec wrangler secret put CONTROL_PASSWORD_HASH
pnpm --filter @leimuovo/control-worker exec wrangler secret put CONTROL_SESSION_SECRET
pnpm --filter @leimuovo/control-worker exec wrangler secret put CONTROL_ACCESS_TEAM_DOMAIN
pnpm --filter @leimuovo/control-worker exec wrangler secret put CONTROL_ACCESS_AUD
pnpm --filter @leimuovo/control-worker exec wrangler secret put CONTROL_ALLOWED_EMAIL
```

`CONTROL_ALLOWED_EMAIL` 固定填写 `xiaoyuqaq69@gmail.com`。生产普通变量 `CONTROL_SITE_ORIGIN` 已在 `wrangler.jsonc` 固定为 `https://leimuovo.com`。

## 4. 首次部署与自动部署

首次部署前执行：

```powershell
pnpm verify
pnpm --filter @leimuovo/control-worker deploy
```

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

API Token 只授予该账户的 Workers Scripts Edit、Workers Routes Edit、Durable Objects Edit，以及 `leimuovo.com` Zone Read。设置后，`main` 分支中控制中心相关代码发生变化会自动部署 Worker；未设置时工作流会安全跳过部署。

## 5. 上线验收

- 无痕窗口访问 `/control/` 必须先出现 Cloudflare Access。
- 非允许邮箱无法通过；错误用户名和密码显示同一条错误。
- 连续五次失败后返回 15 分钟锁定。
- 登录后公开站点动态显示“控制中心”；完全退出后入口消失。
- `workers.dev` 和 Preview URLs 保持关闭。
- 控制页面响应包含 `no-store`、严格 CSP 和 `X-Robots-Tag`，且不进入 PWA 缓存或 Analytics。
