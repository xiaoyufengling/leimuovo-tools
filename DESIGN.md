---
version: alpha
name: REMOVO / 小鱼
description: 小鱼个人网站、实验室与角色视觉的长期设计基准。
colors:
  background: "#f7f7f8"
  surface: "#ffffff"
  surface-muted: "#f0f0f2"
  surface-elevated: "rgba(255, 255, 255, 0.82)"
  text: "#111113"
  text-muted: "#62626b"
  text-subtle: "#7b7b84"
  border: "rgba(17, 17, 19, 0.12)"
  border-strong: "rgba(17, 17, 19, 0.2)"
  accent: "#0a66d6"
  accent-hover: "#0755b4"
  accent-soft: "rgba(10, 102, 214, 0.1)"
  on-accent: "#ffffff"
typography:
  xs:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
    fontSize: 0.75rem
    lineHeight: 1.65
  sm:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
    fontSize: 0.875rem
    lineHeight: 1.65
  base:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
    fontSize: 1rem
    lineHeight: 1.65
  lg:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
    fontSize: 1.125rem
    lineHeight: 1.16
  xl:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
    fontSize: 1.5rem
    lineHeight: 1.16
  2xl:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
    fontSize: 2rem
    lineHeight: 1.16
  mono:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: 0.75rem
    lineHeight: 1.65
rounded:
  control: 0.625rem
  button: 0.75rem
  card: 1.125rem
  panel: 1.5rem
  pill: 999px
spacing:
  "1": 0.25rem
  "2": 0.5rem
  "3": 0.75rem
  "4": 1rem
  "6": 1.5rem
  "8": 2rem
  "12": 3rem
  "16": 4rem
  "24": 6rem
components:
  lm-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.button}"
  lm-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
  lm-panel:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
---

## Overview

REMOVO / 小鱼不是普通商务模板，而是一个清透、安静、带轻二次元气质的个人创作空间。它保留“小鱼、雷姆灵感、蓝白清透、小耳朵、个人实验室”这些品牌灵魂，同时让访问者清楚理解创作者能提供的视觉、游戏 UI、网页原型与轻量工具能力。

整体情绪是温柔、软糯、安静、通透、轻盈、治愈、亲近，以及克制的梦幻感。可爱但不幼稚，高级但不疏离；界面应像一件持续生长的个人作品，而不是批量生产的接单页。

角色视觉与界面视觉共享同一种性格，但不使用同一种材质：角色采用柔软的水彩绘本质感，界面采用黑白基底、蓝色点缀、清透玻璃与细腻动效。二者通过留白、低对比、柔和边界和克制的颜色建立统一感。

## Colors

界面以中性黑白为主，冰蓝色只承担交互、识别与局部氛围，不使用廉价的大面积彩色渐变。默认深色模式延续主站的黑色体验；浅色模式不是简单反相，而是保持相同的层级、透明度和清透感。

- 浅色模式使用 frontmatter 中的标准颜色令牌：柔白背景、纯白表面、深墨文字与低透明边界。
- 深色模式使用现有项目值：背景 `#0b0b0d`，表面 `#151517`，次级表面 `#1d1d20`，浮层 `rgba(21, 21, 23, 0.82)`，主文字 `#f5f5f7`，弱文字 `#a1a1aa`，微弱文字 `#8b8b94`，边界 `rgba(255, 255, 255, 0.13)`，强调边界 `rgba(255, 255, 255, 0.22)`，强调色 `#4da3ff`，悬停强调色 `#75b8ff`，柔和强调底 `rgba(77, 163, 255, 0.14)`。
- 角色主色保持低饱和的冰蓝头发、青蓝眼睛、淡粉肤色与粉色发饰。蓝色轮廓必须比纯黑柔和，肤色与腮红必须像晕染而不是色块。
- 角色颜色不得为了“更醒目”而加深蓝色、提高整体饱和度或增加强烈蓝色外发光。

## Typography

中文是信息表达主体，英文只作为短标签、编号或技术性辅助。界面字体使用系统无衬线栈，保证苹果设备与中文 Windows 环境下都清晰自然；等宽字体只用于 REMOVO、年份、实验编号和极短的元信息。

正文采用舒展的 `1.65` 行高，标题采用紧凑的 `1.16` 行高。标题可以有力量，但不使用夸张的商业宣传字重；正文、说明、标签之间必须形成明确层级。卡片中的说明占据中部，关键词在底部形成节奏，不能把所有文字挤在卡片上缘。

## Layout

桌面端使用有上限的流式内容区，移动端使用安全边距与单列卡片。所有页面依照现有间距令牌建立节奏：`4px` 只做微调，`8px` 与 `12px` 组织紧密关系，`16px` 与 `24px` 组织组件内部，`32px` 以上组织区块之间的呼吸。

内容优先卡片化，但卡片不是随意铺开的方块。大卡与小卡可以变化，标题、说明、标签的位置规则必须一致。桌面端允许非对称编排来体现个人实验室感；移动端每张卡片独立看都应完整、稳定、不拥挤，也不因过度留白显得空洞。

主视觉必须先提供情绪，再用一句清晰中文说明创作者能做什么。角色形象可成为视觉锚点，但不能压过页面的核心信息。

## Elevation & Depth

深度主要来自色阶、细边界、局部透明和背景模糊，而不是厚重阴影。玻璃表面只出现在导航、浮层和需要强调空间关系的卡片上；它应像苹果式清透材质，但保持 REMOVO 的蓝白气息。

边界在深浅模式中都必须可见。毛玻璃不能把层级洗平，也不能让文字对比不足。阴影保持柔软、扩散和低透明；光晕只能在指针附近或重要交互时轻微出现，不形成持续发亮的赛博效果。

动效语言统一为轻微缩放、柔和位移、短暂模糊恢复和弹性回正。优先使用 `transform` 与 `opacity`，移动端减少跟随和背景运动，并完整支持 `prefers-reduced-motion`。

## Shapes

界面的核心形状是柔和圆角矩形、胶囊标签与圆形角色头像。控件、按钮、卡片、面板分别使用既有 `control`、`button`、`card`、`panel` 圆角，不能在同一层级随意混用。

角色头部是横向略宽但仍接近圆形的软糯团子轮廓，脸部占比大，不画身体。五官位置整体偏下，头发体积蓬松但不把脸横向拉宽。外轮廓保留轻微手绘不规则感，不能变成机械矢量、厚黑描边或塑料贴纸边缘。

## Components

### 角色基准头像

未来提到“我们的网站角色风格”“可爱蕾姆风格”或“第一张无耳朵版本”，默认指本节规范：

- 日系轻二次元 Q 版大头肖像，融合水彩、淡彩铅笔与儿童绘本的柔软触感。
- 基准版本没有猫耳。脸型、刘海、眼睛、发卡与蝴蝶结以无猫耳版为母版，后续变体不得擅自改动比例和位置。
- 头发是低饱和浅冰蓝、蓬松短波波头；厚重长刘海自然遮住左眼，右侧露出一只大而简洁的青蓝椭圆眼睛，眼内只保留柔和渐层与少量白色高光。
- 鼻子不显式绘制；嘴巴是很小的淡粉弧线；双颊是大面积、低边界的柔和粉色晕染。
- 线条使用蓝色手绘感轮廓，不用纯黑粗描边。表面保留淡淡纸张、水彩或粉彩颗粒，但不能产生脏污、锐化和噪点边缘。
- 右侧保留粉色交叉发卡与简洁蝴蝶结长丝带。配饰结构保持轻、少、清晰，不增加复杂头饰。
- 光线为高明度、漫反射、低对比；不增加强烈阴影、硬边赛璐璐阴影或环绕人物的蓝色光晕。

### 猫耳扩展层

猫耳属于独立的品牌变体和交互资源，不属于基准脸本体。应单独导出一张只包含双耳的透明图层，也可另行导出与基准头像组合后的完整版本。

耳朵使用与头发一致的浅冰蓝外毛，内耳为淡粉色并具有清楚、柔软、向内生长的白色绒毛。耳朵不带红色 X，不遮挡既有头发结构，不改变头部宽度。做 Q 弹点击动画时，耳朵可以有略微延迟的压缩与回弹，但层级、位置和图像内容不能在点击时切换或复制。

### 位图交付

透明素材必须是真实 RGBA 透明底。不得使用棋盘格、白底、绿底或黑底伪装透明，也不得出现白边、黑边、绿色污染、彩色锯齿或半透明残留。导出前必须分别在纯白、纯黑和站点默认深色背景上检查边缘。

### 卡片与按钮

卡片的标题负责定调，说明文字占据视觉中部，底部标签对齐成稳定节奏。悬停只增加细微边界、柔光和小幅位移。按钮有短距离磁吸与按压回弹，但始终保证一次轻触立即响应；不能要求长按，也不能阻止页面的基本导航。

## Do's and Don'ts

- Do 把无猫耳版作为角色比例、颜色和五官的唯一基准母版。
- Do 将猫耳、光效和互动装饰做成可拆卸的独立层。
- Do 保留 REMOVO、小鱼、雷姆灵感、蓝白清透、轻二次元和个人空间的辨识度。
- Do 让中文承担主要信息，英文只做短标签。
- Do 使用真实透明底，并在浅色、深色和默认站点背景上检查边缘。
- Do 让动效细腻、丝滑、轻量，并为移动端和减少动画设置做减法。
- Don't 加深角色蓝色、整体提高饱和度或把脸横向拉宽。
- Don't 在耳朵上加入红色 X，也不要让猫耳改变基准头像的头发与脸型。
- Don't 使用强蓝光晕、纯黑粗线、硬赛璐璐阴影、3D 塑料感或贴纸感。
- Don't 生成假透明棋盘格、残留底色、白边、黑边或明显锯齿。
- Don't 把网站改成普通商务官网、廉价渐变模板或堆叠特效的赛博页面。
- Don't 为了留白而让卡片失去内容重量，也不要为了饱满而把信息塞满。
