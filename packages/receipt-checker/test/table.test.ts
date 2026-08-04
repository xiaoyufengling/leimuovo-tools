import { describe, expect, it } from "vitest";
import { createRow, knownUnitForItem, matchKnownItem, measurementKind, normalizeUnit, rowStatus, summarizeRows } from "../src/table";

describe("receipt calculation interface", () => {
  it("validates the leader sample and totals 668.34 yuan", () => {
    const rows = [
      { name: "(猪)净肉", price: 24.98, quantity: 5.08, unit: "kg", sourceAmount: 126.9 },
      { name: "(猪)五花肉", price: 28.98, quantity: 2.23, unit: "kg", sourceAmount: 64.63 },
      { name: "(猪)脊骨", price: 24.98, quantity: 8.81, unit: "kg", sourceAmount: 220.07 },
      { name: "牛肋条", price: 79.98, quantity: 3.21, unit: "kg", sourceAmount: 256.74 },
    ].map((source, index) => createRow(source, index));
    expect(summarizeRows(rows)).toMatchObject({ total: 668.34, invalidCount: 0, mismatchCount: 0, canExport: true });
  });

  it("reports an amount mismatch and blocks incomplete rows", () => {
    const mismatch = createRow({ name: "黄瓜", price: 8.98, quantity: 5.86, unit: "kg", sourceAmount: 50 });
    expect(rowStatus(mismatch)).toMatchObject({ amount: 52.62, mismatch: true, difference: 2.62 });
    expect(summarizeRows([createRow({ name: "土豆", price: 5.58 })]).canExport).toBe(false);
  });

  it("normalizes units and known OCR aliases without hiding the correction", () => {
    for (const unit of ["keg", "ke", "人Kg", "KP", "k9"]) expect(normalizeUnit(unit)).toBe("kg");
    expect(measurementKind({ name: "豆制品*大豆腐", unit: "" })).toBe("count");
    expect(knownUnitForItem("调料*麻椒油")).toBe("瓶");
    expect(matchKnownItem("昔瓜")).toEqual({ value: "黄瓜", corrected: true });
  });
});
