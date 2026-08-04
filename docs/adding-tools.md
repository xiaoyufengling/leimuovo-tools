# 新增工具

## 使用脚手架

```powershell
pnpm new:tool -- --slug text-cleaner --title "文本清理" --category "文本工具" --type vanilla
```

命令会创建类型化目录元数据和独立 Astro 页面。工具目录会自动读取新条目，首页不会因为增加工具而改变布局。

## 实现要求

1. 先写工具模块的公开接口和关键行为测试，再实现页面挂载。
2. 页面必须使用 ToolLayout 和 `--lm-*` Design System tokens。
3. 文件输入默认本机处理；若有网络请求，必须在元数据、页面和隐私说明中明确标注。
4. 首发中文内容必须完整；未完成英文内容时不要发布 `/en/` 页面。
5. 原生 TypeScript 是默认客户端方案。只有复杂状态确实需要时才安装 `@astrojs/react`，并把 React 限制在该工具 island。
6. 在 390、768、1440px 验证布局、键盘操作、触控目标和 reduced motion。
