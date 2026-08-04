import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";
import { createRow } from "../src/table";
import { buildWorkbook, exportWorkbook } from "../src/workbook";
import type { WorkbookExportAdapter } from "../src/types";

const rows = [
  createRow({ name: "(猪)净肉", price: 24.98, quantity: 5.08, unit: "kg", sourceAmount: 126.9 }, 0),
  createRow({ name: "牛肋条", price: 79.98, quantity: 3.21, unit: "kg", sourceAmount: 256.74 }, 1),
];

describe("workbook interface", () => {
  it("creates formulas and summary values", () => {
    const output = XLSX.write(buildWorkbook(rows), { type: "buffer", bookType: "xlsx" });
    const sheet = XLSX.read(output, { type: "buffer", cellFormula: true }).Sheets["番茄标签导入"]!;
    expect(sheet.A1?.v).toBe("序号");
    expect(sheet.F2?.f).toBe("ROUND(C2*D2,2)");
    expect(sheet.F4?.f).toBe("SUM(F2:F3)");
    expect(sheet.F4?.v).toBe(383.64);
  });

  it("passes one immutable workbook file through the selected adapter", async () => {
    const save = vi.fn<WorkbookExportAdapter["save"]>().mockResolvedValue({ status: "saved" });
    await expect(exportWorkbook(rows, { save })).resolves.toEqual({ status: "saved" });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]?.[0]).toMatchObject({ fileName: expect.stringMatching(/^番茄标签_.*\.xlsx$/), mimeType: expect.stringContaining("spreadsheetml") });
    expect(save.mock.calls[0]?.[0].bytes.byteLength).toBeGreaterThan(1000);
  });
});
