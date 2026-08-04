import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { persistWorkbookRequest, validateWorkbookSaveRequest } from "../desktop/workbook-save.js";

const trustedOrigin = "http://127.0.0.1:41751/";
const payload = { fileName: "receipt.xlsx", bytes: new Uint8Array([1, 2, 3]) };

describe("desktop workbook IPC boundary", () => {
  it("rejects untrusted sender origins and invalid payloads", () => {
    expect(() => validateWorkbookSaveRequest({ senderUrl: "https://example.com/", trustedOrigin, payload }))
      .toThrow("Untrusted workbook save request");
    expect(() => validateWorkbookSaveRequest({ senderUrl: trustedOrigin, trustedOrigin, payload: { ...payload, bytes: new Uint8Array() } }))
      .toThrow("Invalid workbook save request");
  });

  it("returns cancelled without writing when the save dialog is dismissed", async () => {
    const writeWorkbook = vi.fn();
    await expect(persistWorkbookRequest({
      senderUrl: trustedOrigin,
      trustedOrigin,
      payload,
      chooseDestination: vi.fn().mockResolvedValue(null),
      writeWorkbook,
    })).resolves.toEqual({ status: "cancelled" });
    expect(writeWorkbook).not.toHaveBeenCalled();
  });

  it("sanitizes names and writes successful automated exports inside the selected directory", async () => {
    const ensureDirectory = vi.fn().mockResolvedValue(undefined);
    const writeWorkbook = vi.fn().mockResolvedValue(undefined);
    await expect(persistWorkbookRequest({
      senderUrl: trustedOrigin,
      trustedOrigin,
      payload: { ...payload, fileName: "..\\..\\receipt.xlsx" },
      automatedDirectory: path.join("exports", "receipts"),
      chooseDestination: vi.fn(),
      ensureDirectory,
      writeWorkbook,
    })).resolves.toEqual({ status: "saved" });
    expect(ensureDirectory).toHaveBeenCalledWith(path.join("exports", "receipts"), { recursive: true });
    expect(writeWorkbook).toHaveBeenCalledWith(path.join("exports", "receipts", "receipt.xlsx"), expect.any(Uint8Array));
  });
});
