import * as XLSX from "xlsx";
import { calculatedAmount, roundMoney } from "./table";
import type { ReceiptRow, WorkbookExportAdapter, WorkbookFile } from "./types";

const HEADERS = ["序号", "蔬菜名称", "单价（出）", "数量/重量", "规格/单位", "单品销售总价（元）"];
const MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" as const;

export function buildWorkbook(rows: readonly ReceiptRow[]): XLSX.WorkBook {
  const body = rows.map((row) => [row.order, row.name, row.price, row.quantity, row.unit, calculatedAmount(row)]);
  const total = roundMoney(body.reduce((sum, row) => sum + (typeof row[5] === "number" ? row[5] : 0), 0));
  const data = [HEADERS, ...body, ["今日汇总：", "", "", "", "", total]];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  for (let index = 0; index < rows.length; index += 1) {
    const excelRow = index + 2;
    worksheet[`F${excelRow}`] = { t: "n", v: calculatedAmount(rows[index]!), f: `ROUND(C${excelRow}*D${excelRow},2)`, z: "0.00" };
    if (worksheet[`C${excelRow}`]) worksheet[`C${excelRow}`]!.z = "0.00";
    if (worksheet[`D${excelRow}`]) worksheet[`D${excelRow}`]!.z = "0.##";
  }
  const totalRow = rows.length + 2;
  worksheet[`F${totalRow}`] = { t: "n", v: total, f: `SUM(F2:F${totalRow - 1})`, z: "0.00" };
  worksheet["!merges"] = [{ s: { r: totalRow - 1, c: 0 }, e: { r: totalRow - 1, c: 4 } }];
  worksheet["!cols"] = [{ wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = {
    CalcPr: { calcMode: "auto", fullCalcOnLoad: true, forceFullCalc: true },
  } as unknown as NonNullable<XLSX.WorkBook["Workbook"]>;
  XLSX.utils.book_append_sheet(workbook, worksheet, "番茄标签导入");
  return workbook;
}

export function createWorkbookFile(rows: readonly ReceiptRow[], now = new Date()): WorkbookFile {
  const workbook = buildWorkbook(rows);
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true }) as ArrayBuffer;
  const date = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .replaceAll("/", "-");
  return {
    fileName: `番茄标签_${date}.xlsx`,
    mimeType: MIME_TYPE,
    bytes: new Uint8Array(buffer),
  };
}

export async function exportWorkbook(rows: readonly ReceiptRow[], adapter: WorkbookExportAdapter) {
  return adapter.save(createWorkbookFile(rows));
}

export function createBrowserWorkbookExportAdapter(documentRef: Document = document): WorkbookExportAdapter {
  return {
    async save(file) {
      const blob = new Blob([file.bytes as BlobPart], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = documentRef.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName;
      documentRef.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { status: "saved" };
    },
  };
}
