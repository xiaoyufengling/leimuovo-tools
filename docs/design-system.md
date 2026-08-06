# 小鱼 Design System

这是小鱼工具站的全站视觉与交互规范。它同时适用于 Astro 页面、原生工具、Electron 桌面外壳和私人控制中心。可执行真源位于 `packages/design-system/src`；业务页面只能消费语义 class 和 `--lm-*` token，不在页面内复制品牌值。

## 产品气质

- 内容优先、安静克制、留白充足。
- 黑白灰承担层级，系统蓝只用于链接、焦点和主要交互。
- 正常状态不使用绿色；红色仅表示异常或危险，琥珀色仅表示需要注意。
- 不使用复杂渐变、发光、滚动揭示、实时图表或装饰性动画。
- 每个页面都应让用户知道当前所在位置、下一步可做什么，以及失败时如何恢复。

## 页面骨架

所有公开页面使用下面的层级：

```html
<main id="main-content">
  <div class="lm-page">
    <section class="lm-page-header lm-container">...</section>
    <section class="lm-page-section lm-container">...</section>
  </div>
</main>
```

- `.lm-page` 是页面动画和最小高度的唯一入口。
- `.lm-page-header` 统一页面标题区；`.lm-page-header__lede` 放摘要，不把摘要塞进卡片。
- `.lm-page-section` 使用统一的上下节奏；页面底部使用 `--lm-page-bottom`。
- 长文使用 `.lm-container.lm-reading.content-page`，阅读宽度不超过 720px。
- 控制中心和未来设置页可以使用自己的内容布局，但必须保留 `.lm-page`、共享 tokens 和共享状态类。

## Tokens

### 颜色

浅色背景是 `#F7F7F8`，表面是 `#FFFFFF`，正文是 `#111113`，次要文字是 `#62626B`，焦点蓝是 `#0A66D6`。深色模式自动替换为 `#0B0B0D`、`#151517`、`#F5F5F7`、`#A1A1AA` 和 `#4DA3FF`。

业务代码使用 `--lm-color-background`、`--lm-color-surface`、`--lm-color-text`、`--lm-color-text-muted`、`--lm-color-accent`、`--lm-color-danger` 和 `--lm-color-warning`，禁止直接写 hex。状态必须同时包含图标或文字，不能只依赖颜色。

### 字体与间距

- 系统字体：Apple、Segoe UI、PingFang SC、Microsoft YaHei；不加载第三方字体。
- 文字阶梯：12、14、16、18、24、32；首页展示标题由 `--lm-text-display` 控制，上限 64px。
- 字距统一为 0；不使用负字距。
- 间距使用 4、8、12、16、24、32、48、64、96px 对应 token。
- 正文行高 `1.65`，标题使用 `--lm-leading-tight`。

### 形状、阴影与动效

- 输入框 10px，按钮 12px，卡片 18px，主面板 24px，徽章使用胶囊圆角。
- 默认只用 `--lm-shadow-sm` 和 `--lm-shadow-md` 两级阴影；深色模式优先使用边框和表面层级。
- 动效只允许 opacity、transform 和颜色/边框过渡，持续时间为 120/180/240ms。
- 页面内容进入使用 `.lm-motion-enter`，可用 `--1`、`--2`、`--3` 做 40ms 间隔的轻微错峰；现代浏览器会在内容进入视口时复用同一段动效；不为装饰添加无限循环动画。
- 悬停只用于可交互卡片和按钮；按下使用轻微缩放，不能造成布局移动。
- `prefers-reduced-motion: reduce` 下停用非必要动效和骨架脉冲。

## 组件契约

### 按钮

- 主操作：`.lm-button.lm-button--primary`，每个视图最多一个。
- 次操作：`.lm-button.lm-button--secondary`。
- 低强调操作：`.lm-button.lm-button--ghost`。
- 危险操作：`.lm-button.lm-button--danger`，只用于删除、退出等明确风险动作。
- 需要异步反馈时设置 `aria-busy="true"`，保留原按钮尺寸并放置 `.lm-button__spinner`。
- 成功或失败结果用 `data-state="success|danger"`，不重新发明按钮颜色。
- 图标按钮使用 `.lm-icon-button`，必须提供可见 tooltip 或 `aria-label`，触控尺寸至少 44×44px。

### 输入与表单

```html
<div class="lm-field">
  <label class="lm-label" for="name">名称</label>
  <input id="name" class="lm-input" />
  <p class="lm-help">补充说明。</p>
  <p class="lm-field-error" role="alert">错误说明。</p>
</div>
```

错误要靠近对应字段，使用 `aria-invalid="true"`；禁用或只读使用原生属性并保留清晰对比。多行文本使用 `.lm-input.lm-textarea`，复选框使用 `.lm-check`，未来设置页的二态开关使用 `.lm-switch` 并提供 `aria-checked`。

### 卡片

- `.lm-card` 是默认表面，不自动产生 hover。
- 完整卡片链接增加 `.lm-card--interactive`，统一 hover、focus、pressed 和 selected 状态。
- `aria-current="true"`、`aria-selected="true"` 或 `data-selected="true"` 表示选中。
- `aria-disabled="true"` 或 `data-disabled="true"` 表示不可用；不能只降低透明度而不提供文字解释。
- 工具卡片必须保持标题、摘要、分类/处理方式的固定信息层级，并设置稳定最小高度。

### 加载、空、错误和成功

加载状态使用 `.lm-skeleton` 和 `.lm-skeleton-layout`，先预留标题、说明和操作区的尺寸，禁止用单独转圈替代完整布局。异步按钮使用 `aria-busy` 和 spinner。

页面级空/错误状态使用 `apps/web/src/components/StatePanel.astro`，结构固定为：品牌化图标、状态 eyebrow、标题、解释、主恢复按钮和可选次按钮。当前统一变体包括：`empty`、`offline`、`not-found`、`forbidden`、`server-error`。

局部提示使用 `.lm-callout[data-tone="warning|danger"]`；短暂结果使用 `.lm-toast`，必须位于 `role="status"` 或 `aria-live="polite"` 容器内。Toast 只表达结果，不承载需要用户决策的内容。

弹窗使用原生 `<dialog class="lm-modal">`，内部按 `.lm-modal__header`、`.lm-modal__body`、`.lm-modal__footer` 分区；关闭按钮固定在右上角，Escape 可关闭，焦点返回触发按钮。

### 设置页预留

设置页面未来使用 `.lm-settings`，每个功能组使用 `.lm-settings-group`，每一行使用 `.lm-settings-row` 和 `.lm-settings-row__copy`。设置项默认是简短说明 + 右侧控件，不做侧边栏和密集表格；危险设置必须使用二次确认弹窗。

## 响应式与可访问性

- 以 390px、768px、1024px、1440px 验收；不允许横向滚动。
- 主要按钮、输入框、图标按钮、开关和复选框触控区域至少 44×44px。
- 所有图标使用 Lucide 1.75px 描边；图标按钮必须有名称，状态不能只用颜色表达。
- 焦点使用 `:focus-visible` 的蓝色外圈，不能移除浏览器键盘焦点。
- 手机端按钮可以变为整行，但文字必须在父容器内完整换行。

## 新页面与新工具

新工具只需要增加目录元数据、独立路由和 `ToolLayout` 内容；不要修改首页网格或复制一套 CSS。新页面必须使用 `BaseLayout`，复杂客户端状态先用原生 TypeScript；只有真实需要时才引入 React island。任何新状态优先复用上述状态组件和语义 token。
