import { parseNumeric, roundMoney } from "./table";
import type { OcrReading } from "./types";

const RELIABLE_CONFIDENCE = 72;

interface NumericCandidate {
  readonly value: number;
  readonly score: number;
  readonly inferred: boolean;
}

function fieldPrior(field: "price" | "quantity" | "sourceAmount", decimalPlaces: number, digitCount: number): number {
  if (field === "price") {
    if (decimalPlaces === 2) return 20;
    if (decimalPlaces === 1) return 8;
    if (decimalPlaces === 0) return digitCount <= 2 ? 12 : 0;
    return -5;
  }
  if (field === "quantity") {
    if (decimalPlaces === 2) return 18;
    if (decimalPlaces === 1) return 10;
    if (decimalPlaces === 0) return digitCount <= 2 ? 12 : -2;
    return 0;
  }
  if (decimalPlaces === 2) return 20;
  if (decimalPlaces === 1) return 6;
  if (decimalPlaces === 0) return digitCount <= 3 ? 10 : -2;
  return -6;
}

function directCandidate(reading: OcrReading): NumericCandidate | undefined {
  const value = parseNumeric(reading.text);
  if (!Number.isFinite(value)) return undefined;
  return { value: value ?? 0, score: reading.confidence + 30, inferred: false };
}

function candidatesFor(readings: readonly OcrReading[], field: "price" | "quantity" | "sourceAmount"): NumericCandidate[] {
  const reliable = readings
    .filter((reading) => reading.confidence >= RELIABLE_CONFIDENCE)
    .map(directCandidate)
    .filter((candidate): candidate is NumericCandidate => candidate !== undefined)
    .sort((left, right) => right.score - left.score);
  if (reliable[0]) return [reliable[0]];

  const candidates: NumericCandidate[] = [];
  for (const reading of readings) {
    const normalized = reading.text.replace(/[Oo〇]/g, "0").replace(/[Il|]/g, "1").replace(/[，,]/g, ".").replace(/[^0-9.]/g, "");
    if (!normalized) continue;
    if (normalized.includes(".")) {
      const direct = directCandidate(reading);
      if (direct) candidates.push({ ...direct, score: direct.score + 15 });
      continue;
    }
    const digits = normalized.replace(/\D/g, "");
    if (!digits) continue;
    const rawNumber = Number.parseInt(digits, 10);
    if (!Number.isFinite(rawNumber)) continue;
    for (let decimalPlaces = 0; decimalPlaces <= Math.min(3, digits.length); decimalPlaces += 1) {
      candidates.push({
        value: rawNumber / 10 ** decimalPlaces,
        score: reading.confidence + fieldPrior(field, decimalPlaces, digits.length),
        inferred: decimalPlaces > 0,
      });
    }
  }
  const bestByValue = new Map<number, NumericCandidate>();
  for (const candidate of candidates) {
    const existing = bestByValue.get(candidate.value);
    if (!existing || candidate.score > existing.score) bestByValue.set(candidate.value, candidate);
  }
  return [...bestByValue.values()];
}

function plausible(field: "price" | "quantity" | "sourceAmount", value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false;
  if (field === "price") return value > 0 && value <= 10000;
  if (field === "quantity") return value <= 10000;
  return value <= 1000000;
}

function formulaMatch(price: number, quantity: number, sourceAmount: number): boolean {
  return Math.abs(roundMoney(price * quantity) - sourceAmount) < 0.011;
}

export function resolveNumericRow(input: {
  readonly priceReadings: readonly OcrReading[];
  readonly quantityReadings: readonly OcrReading[];
  readonly sourceAmountReadings: readonly OcrReading[];
}) {
  const prices = candidatesFor(input.priceReadings, "price").filter((candidate) => plausible("price", candidate.value));
  const quantities = candidatesFor(input.quantityReadings, "quantity").filter((candidate) => plausible("quantity", candidate.value));
  const amounts = candidatesFor(input.sourceAmountReadings, "sourceAmount").filter((candidate) => plausible("sourceAmount", candidate.value));
  if (!prices.length || !quantities.length || !amounts.length) {
    return {
      price: prices[0]?.value ?? null,
      quantity: quantities[0]?.value ?? null,
      sourceAmount: amounts[0]?.value ?? null,
      reverseQuantity: null,
      formulaMatches: false,
      inferred: true,
    };
  }

  let best: { price: NumericCandidate; quantity: NumericCandidate; amount: NumericCandidate; matches: boolean; score: number } | undefined;
  for (const price of prices) {
    for (const quantity of quantities) {
      for (const amount of amounts) {
        const matches = formulaMatch(price.value, quantity.value, amount.value);
        const score = price.score + quantity.score + amount.score + (matches ? 200 : 0);
        if (!best || score > best.score) best = { price, quantity, amount, matches, score };
      }
    }
  }
  if (!best) throw new Error("Unable to resolve numeric row");
  return {
    price: best.price.value,
    quantity: best.quantity.value,
    sourceAmount: best.amount.value,
    reverseQuantity: roundMoney(best.amount.value / best.price.value),
    formulaMatches: best.matches,
    inferred: best.price.inferred || best.quantity.inferred || best.amount.inferred,
  };
}
