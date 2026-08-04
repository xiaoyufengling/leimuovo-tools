export interface WorkbookSavePayload {
  fileName?: unknown;
  bytes?: unknown;
}

export function validateWorkbookSaveRequest(input: {
  senderUrl: string;
  trustedOrigin: string;
  payload: WorkbookSavePayload;
}): { fileName: string; bytes: Uint8Array };

export function persistWorkbookRequest(input: {
  senderUrl: string;
  trustedOrigin: string;
  payload: WorkbookSavePayload;
  automatedDirectory?: string;
  chooseDestination(fileName: string): Promise<string | null>;
  ensureDirectory?: (directory: string, options: { recursive: true }) => Promise<unknown>;
  writeWorkbook?: (filePath: string, data: Uint8Array) => Promise<unknown>;
}): Promise<{ status: "saved" | "cancelled" }>;
