import type {
  MeasurementKind,
  ReceiptRow,
  ReceiptRowSource,
  RowStatus,
  RowSummary,
} from "./types";

export const MONEY_TOLERANCE = 0.011;

const KNOWN_ITEM_NAMES = [
  "(猪)净肉", "(猪)五花肉", "(猪)脊骨", "(猪)外脊", "(猪)肉馅", "牛肋条", "羊腿肉", "鲤鱼", "鸡蛋",
  "豆制品*干豆腐", "豆制品*大豆腐", "粮油菜籽油(非转基因)*5L", "芹菜", "香菜", "大蒜", "胡萝卜", "尖椒", "土豆",
  "杂粮*高粱米", "西红柿", "黄瓜", "架豆王", "苦瓜", "西瓜", "茄子一级", "大葱一级", "紫茄子", "麻椒", "调料*麻椒油",
] as const;

const KNOWN_ITEM_ALIASES = new Map<string, string>([
  ["昔瓜", "黄瓜"], ["蓝瓜", "黄瓜"], ["茧瓜", "黄瓜"], ["荆瓜", "黄瓜"], ["十豆", "土豆"], ["芦芝", "芹菜"],
  ["习美一角", "茄子一级"], ["大莽一", "大葱一级"], ["此项子", "紫茄子"], ["胡划下", "胡萝卜"], ["订概", "麻椒"],
  ["壮腿岗", "羊腿肉"], ["和后肋条", "牛肋条"], ["〈《猪)外并", "(猪)外脊"], ["调料冰风概油", "调料*麻椒油"],
  ["调料交椒闻", "调料*麻椒油"],
]);

const KNOWN_ITEM_UNITS = new Map<string, string>([
  ["豆制品*大豆腐", "块"],
  ["调料*麻椒油", "瓶"],
]);

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseNumeric(rawValue: unknown): number | null {
  if (typeof rawValue === "number") return Number.isFinite(rawValue) ? rawValue : null;
  const cleaned = String(rawValue ?? "")
    .trim()
    .replace(/[Oo〇]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[，,]/g, ".")
    .replace(/[^0-9.\-]/g, "");
  const firstNumber = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!firstNumber) return null;
  const parsed = Number.parseFloat(firstNumber[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeItemName(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n\t ]+/g, "")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/^[《〈<]\s*(猪)[)）]/, "($1)")
    .replace(/^[·.。]+|[·.。]+$/g, "")
    .trim();
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? 0;
}

export function matchKnownItem(rawValue: unknown): { value: string; corrected: boolean } {
  const normalized = normalizeItemName(rawValue);
  if (!normalized) return { value: "", corrected: false };
  if ((KNOWN_ITEM_NAMES as readonly string[]).includes(normalized)) return { value: normalized, corrected: false };
  const alias = KNOWN_ITEM_ALIASES.get(normalized);
  if (alias) return { value: alias, corrected: true };

  let best: { candidate: string; distance: number; ratio: number } | undefined;
  for (const candidate of KNOWN_ITEM_NAMES) {
    const distance = editDistance(normalized, candidate);
    const ratio = distance / Math.max(normalized.length, candidate.length);
    if (!best || ratio < best.ratio) best = { candidate, distance, ratio };
  }
  if (best && best.distance <= 2 && best.ratio <= 0.34) return { value: best.candidate, corrected: true };
  return { value: normalized, corrected: false };
}

export function knownUnitForItem(itemName: unknown): string {
  return KNOWN_ITEM_UNITS.get(normalizeItemName(itemName)) ?? "";
}

export function normalizeUnit(value: unknown): string {
  const cleaned = String(value ?? "").replace(/[\r\n\t ]+/g, "").trim();
  const latin = cleaned.replace(/[^A-Za-z0-9|]/g, "");
  if (/^[|Il]?[kK]?[gGeEpPqQ9]{1,2}$/i.test(latin) || cleaned === "千克") return "kg";
  return cleaned;
}

export function measurementKind(row: Pick<ReceiptRowSource, "name" | "unit">): MeasurementKind {
  const unit = normalizeUnit(row.unit) || knownUnitForItem(row.name);
  if (["kg", "斤", "克", "g"].includes(unit)) return "weight";
  if (["块", "瓶", "个", "袋", "盒"].includes(unit)) return "count";
  return "unknown";
}

export function createRow(source: ReceiptRowSource = {}, index = 0): ReceiptRow {
  return {
    id: source.id ?? `row-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    order: index + 1,
    sourceOrder: Number.isInteger(source.sourceOrder) ? (source.sourceOrder ?? null) : null,
    name: normalizeItemName(source.name),
    price: parseNumeric(source.price),
    quantity: parseNumeric(source.quantity),
    unit: normalizeUnit(source.unit),
    sourceAmount: parseNumeric(source.sourceAmount),
    reverseQuantity: parseNumeric(source.reverseQuantity),
    numericInferred: source.numericInferred === true,
    confidence: Number.isFinite(source.confidence) ? (source.confidence ?? 100) : 100,
  };
}

export function calculatedAmount(row: Pick<ReceiptRow, "price" | "quantity">): number | null {
  if (!Number.isFinite(row.price) || !Number.isFinite(row.quantity)) return null;
  return roundMoney((row.price ?? 0) * (row.quantity ?? 0));
}

export function rowStatus(row: ReceiptRow): RowStatus {
  const amount = calculatedAmount(row);
  const missing: string[] = [];
  const kind = measurementKind(row);
  if (!row.name) missing.push("商品名称");
  if (!Number.isFinite(row.price)) missing.push("售价");
  if (!Number.isFinite(row.quantity)) missing.push("数量/重量");
  if (!row.unit) missing.push("单位");
  if (!Number.isFinite(row.sourceAmount)) missing.push("原表金额");

  const difference = amount !== null && Number.isFinite(row.sourceAmount)
    ? roundMoney(amount - (row.sourceAmount ?? 0))
    : null;
  const reverseQuantity = Number.isFinite(row.price) && (row.price ?? 0) > 0 && Number.isFinite(row.sourceAmount)
    ? roundMoney((row.sourceAmount ?? 0) / (row.price ?? 1))
    : Number.isFinite(row.reverseQuantity) ? row.reverseQuantity : null;
  const lowConfidence = row.confidence < 72;
  const numericInferred = row.numericInferred;
  return {
    amount,
    difference,
    missing,
    invalid: missing.length > 0,
    mismatch: difference !== null && Math.abs(difference) >= MONEY_TOLERANCE,
    lowConfidence,
    measurementKind: kind,
    reverseQuantity,
    numericInferred,
    needsReview: lowConfidence || numericInferred || kind === "unknown",
  };
}

export function summarizeRows(rows: readonly ReceiptRow[]): RowSummary {
  let invalidCount = 0;
  let mismatchCount = 0;
  let reviewCount = 0;
  let issueCount = 0;
  const total = rows.reduce((sum, row) => {
    const status = rowStatus(row);
    if (status.invalid) invalidCount += 1;
    if (status.mismatch) mismatchCount += 1;
    if (status.needsReview) reviewCount += 1;
    if (status.invalid || status.mismatch || status.needsReview) issueCount += 1;
    return sum + (status.amount ?? 0);
  }, 0);
  return {
    total: roundMoney(total),
    invalidCount,
    mismatchCount,
    reviewCount,
    issueCount,
    canExport: rows.length > 0 && invalidCount === 0,
  };
}

export function renumberRows(rows: readonly ReceiptRow[]): ReceiptRow[] {
  return rows.map((row, index) => ({ ...row, order: index + 1 }));
}
