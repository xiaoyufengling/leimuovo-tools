export interface ReceiptRowSource {
  readonly id?: string;
  readonly sourceOrder?: number | null;
  readonly name?: unknown;
  readonly price?: unknown;
  readonly quantity?: unknown;
  readonly unit?: unknown;
  readonly sourceAmount?: unknown;
  readonly reverseQuantity?: unknown;
  readonly numericInferred?: boolean;
  readonly confidence?: number;
}

export interface ReceiptRow {
  id: string;
  order: number;
  sourceOrder: number | null;
  name: string;
  price: number | null;
  quantity: number | null;
  unit: string;
  sourceAmount: number | null;
  reverseQuantity: number | null;
  numericInferred: boolean;
  confidence: number;
}

export type MeasurementKind = "weight" | "count" | "unknown";

export interface RowStatus {
  amount: number | null;
  difference: number | null;
  missing: string[];
  invalid: boolean;
  mismatch: boolean;
  lowConfidence: boolean;
  measurementKind: MeasurementKind;
  reverseQuantity: number | null;
  numericInferred: boolean;
  needsReview: boolean;
}

export interface RowSummary {
  total: number;
  invalidCount: number;
  mismatchCount: number;
  reviewCount: number;
  issueCount: number;
  canExport: boolean;
}

export interface OcrReading {
  readonly text: string;
  readonly confidence: number;
}

export interface OcrProgress {
  readonly stage: "model" | "recognition";
  readonly progress: number;
  readonly detail?: string;
}

export type ExportStatus = "saved" | "cancelled";

export interface WorkbookFile {
  readonly fileName: string;
  readonly mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  readonly bytes: Uint8Array;
}

export interface WorkbookExportAdapter {
  save(file: WorkbookFile): Promise<{ status: ExportStatus }>;
}
