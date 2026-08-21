export const site = {
  name: "小鱼",
  url: "https://leimuovo.com",
  locale: "zh-CN",
  title: "小鱼｜游戏 UI 与视觉设计",
  description: "小鱼的个人设计空间：游戏 UI、视觉设计、动态原型与持续生长的视觉实验室。",
  email: "xiaoyuqaq69@gmail.com",
  github: "https://github.com/xiaoyufengling/leimuovo-tools",
  issues: "https://github.com/xiaoyufengling/leimuovo-tools/issues",
} as const;

export type SiteConfig = typeof site;
