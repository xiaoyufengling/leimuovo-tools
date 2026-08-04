import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_WORKBOOK_BYTES = 20 * 1024 * 1024;

function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function validateWorkbookSaveRequest({ senderUrl, trustedOrigin, payload }) {
  if (!trustedOrigin || safeOrigin(senderUrl) !== safeOrigin(trustedOrigin)) {
    throw new Error("Untrusted workbook save request");
  }
  const rawFileName = typeof payload?.fileName === "string" ? payload.fileName : "";
  const fileName = path.posix.basename(rawFileName.replaceAll("\\", "/"));
  const bytes = payload?.bytes instanceof Uint8Array ? payload.bytes : undefined;
  if (!fileName.endsWith(".xlsx") || !bytes?.byteLength || bytes.byteLength > MAX_WORKBOOK_BYTES) {
    throw new Error("Invalid workbook save request");
  }
  return { fileName, bytes };
}

export async function persistWorkbookRequest({
  senderUrl,
  trustedOrigin,
  payload,
  automatedDirectory,
  chooseDestination,
  ensureDirectory = mkdir,
  writeWorkbook = writeFile,
}) {
  const { fileName, bytes } = validateWorkbookSaveRequest({ senderUrl, trustedOrigin, payload });
  let filePath;
  if (automatedDirectory?.trim()) {
    await ensureDirectory(automatedDirectory, { recursive: true });
    filePath = path.join(automatedDirectory, fileName);
  } else {
    filePath = await chooseDestination(fileName);
    if (!filePath) return { status: "cancelled" };
  }
  await writeWorkbook(filePath, Buffer.from(bytes));
  return { status: "saved" };
}
