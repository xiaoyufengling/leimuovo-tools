import type { OcrProgress, ReceiptRow } from "./types";

export function configureOcrAssets(assetBaseUrl: string): void;
export function detectTableGrid(canvas: HTMLCanvasElement): unknown;
export function recognizeSheet(file: File, onProgress: (progress: OcrProgress) => void): Promise<ReceiptRow[]>;
export function terminateOcr(): Promise<void>;
