# 小鱼控制中心

控制中心是只给主人使用的私人状态总览。公开站点仍由 Cloudflare Pages 静态部署，Cloudflare Worker 只接管 `/control/*` 与 `/api/control/*`。

## 当前访问方式

第一版使用 Worker 原生用户名和密码登录。由于 Cloudflare Zero Trust Access 的免费激活需要账单方式，当前不启用 Access，也不依赖信用卡。

- 公开网站没有静态“控制中心”入口。
- 在页脚“隐私”链接上快速连续点击 5 次，会打开 `/control/` 登录页。
- 这个手势只是隐藏入口，不是安全边界；直接访问路径仍由 Worker 登录保护。
- 登录成功后会临时显示公开导航入口；退出后会清除入口标记。
- 控制中心不进入 sitemap、PWA 缓存或 Analytics。

后续启用 Cloudflare Access 时，只需把 Worker 变量 `CONTROL_AUTH_MODE` 改成 `cloudflare-access`，再补齐 Access 的两个 Secret。页面、应用会话和状态接口不需要重写。

## 本地预览

```powershell
pnpm dev:control
```

打开 `http://localhost:4322/control/`。开发服务器接受任意非空用户名和密码，只提供本地模拟状态；这段逻辑只存在于 Vite 开发中，不会进入生产 Worker。

## 生成凭据

密码使用 PBKDF2-HMAC-SHA-256、随机盐和 600,000 次迭代。先在本地交互式终端生成哈希：

```powershell
pnpm control:hash-password
```

输入不会显示。命令只输出哈希，明文不会写入文件。另行生成至少 32 字节随机会话密钥：

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

密码和会话密钥不会写入 Git、`.env`、`.dev.vars`、命令参数或日志。之前在聊天中出现过的密码已经暴露，正式上线前请生成并使用一个全新的密码。

登录时，PBKDF2 在用户浏览器本地完成，Worker 只返回公开的盐与迭代参数并校验 32 字节派生证明。密码明文不会离开浏览器，也避免在 Workers Free 的 10ms CPU 限额内执行高强度 PBKDF2。

## 设置生产 Secret

先登录 Wrangler：

```powershell
pnpm --filter @leimuovo/control-worker exec wrangler login
```

然后逐项执行命令，在 Wrangler 的隐藏输入提示中粘贴对应值。不要把值发到聊天：

```powershell
pnpm --filter @leimuovo/control-worker exec wrangler secret put CONTROL_USERNAME
pnpm --filter @leimuovo/control-worker exec wrangler secret put CONTROL_PASSWORD_HASH
pnpm --filter @leimuovo/control-worker exec wrangler secret put CONTROL_SESSION_SECRET
pnpm --filter @leimuovo/control-worker exec wrangler secret put CONTROL_ALLOWED_EMAIL
```

`CONTROL_ALLOWED_EMAIL` 固定填写主人的邮箱。`CONTROL_SITE_ORIGIN` 和 `CONTROL_AUTH_MODE=password-only` 已写入 `apps/control-worker/wrangler.jsonc`，不是 Secret。

单层模式暂时不设置：

```text
CONTROL_ACCESS_TEAM_DOMAIN
CONTROL_ACCESS_AUD
```

未来切换 Access 时再设置这两个值，并把 `CONTROL_AUTH_MODE` 改成 `cloudflare-access`。Worker 会验证签名、issuer、audience、邮箱和过期时间，绝不信任普通请求头。

## 首次部署

完成 Secret 后，在仓库根目录执行：

```powershell
pnpm verify
pnpm --filter @leimuovo/control-worker deploy
```

部署成功后检查：

- 直接打开 `https://leimuovo.com/control/` 能看到登录页。
- 错误凭据返回统一错误，不泄露用户名是否存在。
- 登录前请求 `/api/control/status` 返回 401，登录后返回 200。
- 控制页面响应包含 `Cache-Control: no-store` 和 `X-Robots-Tag: noindex, nofollow, noarchive`。

## GitHub 自动部署

`.github/workflows/control-deploy.yml` 会在控制中心代码变更时运行检查、测试、构建和部署。需要在 GitHub 仓库添加：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Token 只授予 Workers Scripts Edit、Workers Routes Edit、Durable Objects Edit，以及 `leimuovo.com` Zone Read。未设置时工作流只验证和构建，不会尝试部署。

## 安全边界

- 会话使用 HMAC-SHA-256 签名，12 小时有效，Cookie 为 `Secure; HttpOnly; SameSite=Strict`。
- Worker 实例内存记录短期失败次数：10 分钟内失败 5 次后锁定 15 分钟，成功后清零。该保护不依赖付费状态服务，会随实例重启或跨 Cloudflare 节点重置；未来启用 Cloudflare Access 后再升级为全局限速。
- 状态数据没有历史存储；网站、VPS 和家庭设备检测结果只在请求期间生成。
- VPS 和家庭设备仍是 `not_configured` 占位，后续接入时优先使用 Cloudflare Tunnel、Access Service Token 或设备主动上报，不开放家庭公网端口。
