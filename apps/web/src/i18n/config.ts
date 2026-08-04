export const supportedLocales = ["zh-CN", "en"] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = "zh-CN";

export function localePath(pathname: string, locale: Locale = defaultLocale): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return locale === defaultLocale ? normalized : `/en${normalized}`;
}
