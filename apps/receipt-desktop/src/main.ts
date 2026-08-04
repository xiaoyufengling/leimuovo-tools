import "@leimuovo/design-system/tokens.css";
import "@leimuovo/design-system/base.css";
import "@leimuovo/design-system/components.css";
import { mountReceiptChecker, type WorkbookExportAdapter } from "@leimuovo/receipt-checker";
import "./styles.css";

declare global {
  interface Window {
    receiptDesktop: {
      saveWorkbook(fileName: string, bytes: Uint8Array): Promise<{ status: "saved" | "cancelled" }>;
    };
  }
}

const root = document.querySelector<HTMLElement>("[data-receipt-checker]");
if (!root) throw new Error("Receipt checker root is missing");

const desktopAdapter: WorkbookExportAdapter = {
  save: (file) => window.receiptDesktop.saveWorkbook(file.fileName, file.bytes),
};

mountReceiptChecker(root, {
  assetBaseUrl: "/vendor/tesseract/",
  exportAdapter: desktopAdapter,
});

const themeButton = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
themeButton?.addEventListener("click", () => {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const current = document.documentElement.dataset.theme || (systemDark ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { window.localStorage.setItem("leimuovo-theme", next); } catch {}
});
