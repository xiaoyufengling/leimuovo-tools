import { describe, expect, it } from "vitest";
import { resolveHeaderSchema, type HeaderCell } from "../src/schema";

function headerCells(labels: string[], widths: number[]): HeaderCell[] {
  let left = 0;
  return labels.map((text, index) => {
    const right = left + (widths[index] ?? 0);
    const cell = { text, left, right, confidence: 90 };
    left = right;
    return cell;
  });
}

describe("header schema interface", () => {
  it("maps semantic fields independently of column width", () => {
    const compact = resolveHeaderSchema(headerCells(
      ["序号", "蔬菜名称", "单价（出）", "数量/重量", "规格/单位", "单品销售总价（元）"],
      [77, 309, 105, 100, 112, 134],
    ));
    expect(compact.order).toEqual({ left: 0, right: 77 });
    expect(compact.name).toEqual({ left: 77, right: 386 });
    expect(compact.price).toEqual({ left: 386, right: 491 });
  });

  it("ignores purchase and margin columns in a wide table", () => {
    const schema = resolveHeaderSchema(headerCells(
      ["序号", "蔬菜名称", "单价（进）", "单品进货总价（元）", "单价（出）", "数量/重量", "规格/单位", "销售价（元）", "毛利（元）", "备注"],
      [77, 309, 126, 147, 105, 100, 112, 133, 83, 273],
    ));
    expect(schema.price).toEqual({ left: 659, right: 764 });
    expect(schema.sourceAmount).toEqual({ left: 976, right: 1109 });
  });
});
