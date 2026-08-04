import { describe, expect, it } from "vitest";
import { getToolBySlug, listFeaturedTools, listTools, toolCatalog } from "./tool-catalog";

describe("tool catalog interface", () => {
  it("returns every published tool once with a stable route", () => {
    const tools = listTools();
    expect(tools.map((tool) => tool.slug)).toEqual(["receipt-checker"]);
    expect(tools[0]?.href).toBe("/tools/receipt-checker/");
    expect(new Set(toolCatalog.map((tool) => tool.slug)).size).toBe(toolCatalog.length);
  });

  it("falls back to complete Chinese copy when a reserved locale is not published", () => {
    const tool = getToolBySlug("receipt-checker", "en");
    expect(tool?.copy.title).toBe("小票验算");
  });

  it("keeps the receipt checker out of the brand homepage featured list", () => {
    expect(listFeaturedTools()).toEqual([]);
  });
});
