const REQUIRED_FIELDS = ["order", "name", "price", "quantity", "unit", "sourceAmount"] as const;
type HeaderField = (typeof REQUIRED_FIELDS)[number];

export interface HeaderCell {
  readonly text: string;
  readonly left: number;
  readonly right: number;
  readonly confidence?: number;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n\t ]+/g, "")
    .replace(/[（(]/g, "")
    .replace(/[）)]/g, "")
    .replace(/[\/／、]/g, "")
    .replace(/[：:]/g, "")
    .trim();
}

function headerField(value: unknown): HeaderField | undefined {
  const text = normalizeHeader(value);
  if (text.includes("序号")) return "order";
  if (text.includes("蔬菜名称") || text.includes("商品名称")) return "name";
  if (text.includes("单价") && !text.includes("进")) return "price";
  if (text.includes("数量") && text.includes("重量")) return "quantity";
  if (text.includes("规格") && text.includes("单位")) return "unit";
  if (text.includes("单品销售总价") || (text.includes("销售价") && !text.includes("进货"))) return "sourceAmount";
  return undefined;
}

export function resolveHeaderSchema(headerCells: readonly HeaderCell[]): Record<HeaderField, { left: number; right: number }> {
  const matched = new Map<HeaderField, { left: number; right: number }>();
  for (const cell of headerCells) {
    const field = headerField(cell.text);
    if (!field || matched.has(field)) continue;
    matched.set(field, { left: cell.left, right: cell.right });
  }
  const missing = REQUIRED_FIELDS.filter((field) => !matched.has(field));
  if (missing.length) {
    const recognized = headerCells.map((cell) => cell.text || "（空白）").join(" | ");
    throw new Error(`表头识别不完整：缺少 ${missing.join("、")}。识别到：${recognized}`);
  }
  return Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, matched.get(field)])) as Record<HeaderField, { left: number; right: number }>;
}
