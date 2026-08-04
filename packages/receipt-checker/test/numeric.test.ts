import { describe, expect, it } from "vitest";
import { resolveNumericRow } from "../src/numeric";

describe("numeric OCR resolution", () => {
  it("uses the row formula to restore omitted decimal points", () => {
    expect(resolveNumericRow({
      priceReadings: [{ text: "98", confidence: 0 }, { text: "808", confidence: 0 }, { text: "898", confidence: 0 }],
      quantityReadings: [{ text: "586", confidence: 26 }],
      sourceAmountReadings: [{ text: "22", confidence: 0 }, { text: "5962", confidence: 0 }, { text: "5262", confidence: 0 }],
    })).toEqual({ price: 8.98, quantity: 5.86, sourceAmount: 52.62, reverseQuantity: 5.86, formulaMatches: true, inferred: true });
  });

  it("does not silently replace high-confidence values", () => {
    expect(resolveNumericRow({
      priceReadings: [{ text: "8.98", confidence: 92 }],
      quantityReadings: [{ text: "5.86", confidence: 91 }],
      sourceAmountReadings: [{ text: "50", confidence: 90 }],
    })).toEqual({ price: 8.98, quantity: 5.86, sourceAmount: 50, reverseQuantity: 5.57, formulaMatches: false, inferred: false });
  });
});
