import {
  configureOcrAssets as configureLegacyAssets,
  detectTableGrid as detectLegacyTableGrid,
  recognizeSheet as recognizeLegacySheet,
  terminateOcr as terminateLegacyOcr,
} from "./ocr-legacy.js";
import type { OcrProgress, ReceiptRow } from "./types";

export interface DetectedTableGrid {
  readonly rows: readonly { top: number; bottom: number }[];
  readonly columns: readonly number[];
  readonly headerRow: { top: number; bottom: number };
  readonly tableTop: number;
  readonly tableBottom: number;
}

export function configureOcrAssets(assetBaseUrl: string): void {
  configureLegacyAssets(assetBaseUrl);
}

export function detectTableGrid(canvas: HTMLCanvasElement): DetectedTableGrid {
  return detectLegacyTableGrid(canvas) as DetectedTableGrid;
}

export async function recognizeSheet(file: File, onProgress: (progress: OcrProgress) => void): Promise<ReceiptRow[]> {
  return recognizeLegacySheet(file, onProgress) as Promise<ReceiptRow[]>;
}

export async function terminateOcr(): Promise<void> {
  await terminateLegacyOcr();
}
