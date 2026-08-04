import type { Locale } from "../i18n/config";

export type ToolStatus = "active" | "beta" | "coming-soon";
export type ProcessingMode = "local" | "network";

export interface ToolCopy {
  readonly title: string;
  readonly summary: string;
  readonly seoDescription: string;
}

export interface ToolDefinition {
  readonly slug: string;
  readonly category: string;
  readonly status: ToolStatus;
  readonly icon: "receipt" | "text" | "image" | "calculator";
  readonly processing: ProcessingMode;
  readonly featured: boolean;
  readonly locales: Partial<Record<Locale, ToolCopy>> & { readonly "zh-CN": ToolCopy };
}

const metadataFiles = import.meta.glob<ToolDefinition>("../data/tools/*.json", {
  eager: true,
  import: "default",
});
const definitions: readonly ToolDefinition[] = Object.values(metadataFiles)
  .sort((left, right) => left.slug.localeCompare(right.slug));

function assertValidCatalog(items: readonly ToolDefinition[]): void {
  const slugs = new Set<string>();
  for (const item of items) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) {
      throw new Error(`Invalid tool slug: ${item.slug}`);
    }
    if (slugs.has(item.slug)) throw new Error(`Duplicate tool slug: ${item.slug}`);
    if (!item.locales["zh-CN"]) throw new Error(`Missing zh-CN copy: ${item.slug}`);
    slugs.add(item.slug);
  }
}

assertValidCatalog(definitions);

export function listTools(options: { locale?: Locale; includeComingSoon?: boolean } = {}) {
  const locale = options.locale ?? "zh-CN";
  return definitions
    .filter((tool) => options.includeComingSoon === true || tool.status !== "coming-soon")
    .map((tool) => ({
      ...tool,
      copy: tool.locales[locale] ?? tool.locales["zh-CN"],
      href: `/tools/${tool.slug}/`,
    }));
}

export function getToolBySlug(slug: string, locale: Locale = "zh-CN") {
  const tool = definitions.find((candidate) => candidate.slug === slug);
  if (!tool) return undefined;
  return {
    ...tool,
    copy: tool.locales[locale] ?? tool.locales["zh-CN"],
    href: `/tools/${tool.slug}/`,
  };
}

export function listFeaturedTools(locale: Locale = "zh-CN") {
  return listTools({ locale }).filter((tool) => tool.featured);
}

export const toolCatalog = definitions;
