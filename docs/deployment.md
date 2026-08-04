# GitHub、Cloudflare Pages 与域名部署

## 1. 创建 GitHub 仓库

1. 登录 GitHub，创建公开空仓库 `xiaoyufengling/leimuovo-tools`。
2. 不要在网页端预先生成 README、`.gitignore` 或 License，避免首次推送冲突。
3. 在本地项目根目录执行：

```powershell
git init -b main
git add .
git commit -m "feat: launch Leimuovo tools platform"
git remote add origin https://github.com/xiaoyufengling/leimuovo-tools.git
git push -u origin main
```

后续每次推送会运行 GitHub CI；Cloudflare Pages 原生 Git 集成会自动生成生产或预览部署。

## 2. 创建 Cloudflare Pages 项目

1. Cloudflare 控制台进入 **Workers & Pages → Create → Pages → Connect to Git**。
2. 授权 GitHub 后选择 `xiaoyufengling/leimuovo-tools`。
3. 生产分支设置为 `main`。
4. 构建设置：

| 设置 | 值 |
| --- | --- |
| Framework preset | Astro |
| Root directory | `/` |
| Build command | `pnpm run cf:build` |
| Build output directory | `apps/web/dist` |
| `NODE_VERSION` | `24` |
| `PNPM_VERSION` | `11.9.0` |

5. 首次部署通过后，在 Pages 的 **Deployments** 页面确认 `pages.dev` 地址可访问。
6. 在 Settings 中启用 Preview deployments。分支与 Pull Request 使用预览地址，`main` 使用生产地址。

`cf:build` 会先执行严格类型检查和全部单元测试，再生成静态站；验证失败时不会产生新的生产构建。

## 3. 迁移 DNSPod 到 Cloudflare

当前 `leimuovo.com` 使用 DNSPod nameserver。迁移前在 DNSPod 导出现有记录并截图留档。

1. Cloudflare **Add a site**，输入 `leimuovo.com` 并选择 Free 计划。
2. 检查 Cloudflare 自动扫描结果，尤其是 A、AAAA、CNAME、MX、TXT 和邮件验证记录；缺少的记录手工补齐。
3. 如果 DNSPod 已启用 DNSSEC，先在原服务关闭并等待 DS 记录撤销。
4. 到域名注册商控制台，把两个 DNSPod nameserver 替换为 Cloudflare 分配的 nameserver。
5. 等 Cloudflare Zone 状态变成 **Active** 后再继续，不要在传播期间删除原 DNSPod 区域。

## 4. 绑定域名与 HTTPS

1. Pages 项目进入 **Custom domains**，依次添加 `leimuovo.com` 与 `www.leimuovo.com`。
2. Cloudflare 会自动创建 Pages DNS 记录和 Universal SSL 证书。
3. 访问两个地址，确认 `www` 按仓库 `_redirects` 规则永久跳转到根域名。
4. SSL/TLS 设置为 **Full (strict)**，开启 **Always Use HTTPS**，最低 TLS 版本设为 1.2。
5. 连续稳定运行后再启用 HSTS；确认 nameserver 已稳定后，在 Cloudflare 开启 DNSSEC，并把 DS 信息提交给注册商。

## 5. Analytics 与环境变量

1. 在 Cloudflare Web Analytics 创建站点并复制 token。
2. Pages → Settings → Environment variables 添加 `PUBLIC_CF_WEB_ANALYTICS_TOKEN`，生产与预览环境可分别设置。
3. 重新部署。没有 token 时构建不会插入统计脚本，避免错误或伪数据。
4. Analytics 只用于页面访问和 Web Vitals，不得在工具模块中发送文件名、输入值或识别结果。

## 6. 桌面版发布

日常 push 不生成 EXE。准备版本时先更新 `apps/receipt-desktop/package.json` 版本并提交，然后创建标签：

```powershell
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions 会在 Windows runner 构建未签名便携版并附加到 GitHub Release。未购买代码签名证书前，Windows SmartScreen 可能显示未知发布者。
