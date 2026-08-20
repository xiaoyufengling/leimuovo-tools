export const site = {
  name: "小鱼",
  url: "https://leimuovo.com",
  locale: "zh-CN",
  title: "小鱼｜个人网站",
  description: "小鱼的个人网站。记录正在做的事、偶尔出现的想法，以及一些顺手做出来的小工具。",
  email: "xiaoyuqaq69@gmail.com",
  github: "https://github.com/xiaoyufengling/leimuovo-tools",
  issues: "https://github.com/xiaoyufengling/leimuovo-tools/issues",
} as const;

export type SiteConfig = typeof site;
