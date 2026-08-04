export const site = {
  name: "小鱼",
  url: "https://leimuovo.com",
  locale: "zh-CN",
  title: "小鱼｜安静、快速、尊重隐私的个人工具集",
  description: "一组在浏览器本机运行的实用工具。无需注册，尽量不上传数据，适配手机、平板和桌面设备。",
  email: "xiaoyuqaq69@gmail.com",
  github: "https://github.com/xiaoyufengling/leimuovo-tools",
  issues: "https://github.com/xiaoyufengling/leimuovo-tools/issues",
} as const;

export type SiteConfig = typeof site;
