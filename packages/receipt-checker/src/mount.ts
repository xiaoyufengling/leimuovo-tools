import { CircleCheck, FileDown, ImageUp, Plus, RotateCcw, Trash2, createIcons } from "lucide";
import { calculatedAmount, createRow, parseNumeric, renumberRows, rowStatus, summarizeRows } from "./table";
import type { ReceiptRow, WorkbookExportAdapter } from "./types";
import "./styles.css";

export interface MountReceiptCheckerOptions {
  readonly assetBaseUrl?: string;
  readonly exportAdapter?: WorkbookExportAdapter;
}

export interface MountedReceiptChecker {
  destroy(): Promise<void>;
}

interface ReceiptElements {
  imageInput: HTMLInputElement;
  uploadSection: HTMLElement;
  progressSection: HTMLElement;
  progressLabel: HTMLElement;
  progressValue: HTMLElement;
  progressBar: HTMLElement;
  progressTrack: HTMLElement;
  progressDetail: HTMLElement;
  errorSection: HTMLElement;
  errorMessage: HTMLElement;
  retryButton: HTMLButtonElement;
  reviewSection: HTMLElement;
  replaceImageButton: HTMLButtonElement;
  sourceImage: HTMLImageElement;
  rows: HTMLElement;
  addRowButton: HTMLButtonElement;
  grandTotal: HTMLElement;
  issueCount: HTMLElement;
  confirmCheckbox: HTMLInputElement;
  exportBar: HTMLElement;
  exportTotal: HTMLElement;
  exportButton: HTMLButtonElement;
  toast: HTMLElement;
  workflowSteps: HTMLElement[];
}

function markup(): string {
  return `
    <div class="receipt-checker">
      <section class="receipt-workflow" aria-label="处理进度">
        <div class="receipt-workflow__step is-active" data-step="1"><span>1</span>选择截图</div>
        <div class="receipt-workflow__line" aria-hidden="true"></div>
        <div class="receipt-workflow__step" data-step="2"><span>2</span>核对数据</div>
        <div class="receipt-workflow__line" aria-hidden="true"></div>
        <div class="receipt-workflow__step" data-step="3"><span>3</span>导出表格</div>
      </section>

      <section class="receipt-upload lm-card lm-card--interactive" data-upload-section>
        <label class="receipt-upload__control" for="receipt-image-input">
          <i data-lucide="image-up" aria-hidden="true"></i>
          <strong>选择表格截图</strong>
          <span>支持相册图片和相机拍摄，图片不会上传</span>
        </label>
        <input id="receipt-image-input" data-image-input type="file" accept="image/*" />
      </section>

      <section class="receipt-progress lm-card" data-progress-section hidden aria-live="polite">
        <div class="receipt-progress__heading">
          <strong data-progress-label>准备识别</strong>
          <span data-progress-value>0%</span>
        </div>
        <div class="receipt-progress__track" data-progress-track role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <span data-progress-bar></span>
        </div>
        <p data-progress-detail>首次使用需要加载中文识别模型。</p>
        <div class="receipt-progress__skeletons" aria-hidden="true">
          <span class="lm-skeleton lm-skeleton--title"></span>
          <span class="lm-skeleton lm-skeleton--text"></span>
          <span class="lm-skeleton lm-skeleton--text-short"></span>
        </div>
      </section>

      <section class="receipt-error lm-card" data-error-section hidden role="alert">
        <div>
          <strong>这张图片暂时无法识别</strong>
          <p data-error-message></p>
        </div>
        <button class="lm-button lm-button--secondary" data-retry-button type="button"><i data-lucide="rotate-ccw" aria-hidden="true"></i>重新选择</button>
      </section>

      <section class="receipt-review" data-review-section hidden>
        <div class="receipt-review__toolbar">
          <div><p class="receipt-kicker">识别结果</p><h2>逐项核对</h2></div>
          <button class="lm-button lm-button--secondary" data-replace-image type="button">更换截图</button>
        </div>

        <details class="receipt-source">
          <summary>查看原始截图</summary>
          <img data-source-image alt="本次识别的原始表格截图" />
        </details>

        <div class="receipt-table-header" aria-hidden="true">
          <span>商品</span><span>售价</span><span>数量/重量</span><span>单位</span><span>原表</span><span>验算</span><span></span>
        </div>
        <div class="receipt-rows" data-rows></div>

        <button class="receipt-add-row" data-add-row type="button"><i data-lucide="plus" aria-hidden="true"></i>添加一行</button>

        <div class="receipt-summary">
          <div><span>今日汇总</span><strong data-grand-total>0.00 元</strong></div>
          <div><span>需要处理</span><strong data-issue-count>0 项</strong></div>
        </div>

        <label class="receipt-confirm">
          <input data-confirm type="checkbox" />
          <span>我已核对商品名称、单价、数量/重量和单位</span>
        </label>
      </section>

      <div class="receipt-export" data-export-bar hidden>
        <div><span>导出金额</span><strong data-export-total>0.00 元</strong></div>
        <button class="lm-button receipt-export__button" data-export type="button" disabled><i data-lucide="file-down" aria-hidden="true"></i>生成 Excel</button>
      </div>
      <div class="lm-toast receipt-toast" data-toast data-tone="success" hidden role="status" aria-live="polite"></div>
    </div>`;
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Receipt checker element missing: ${selector}`);
  return element;
}

function collectElements(root: HTMLElement): ReceiptElements {
  return {
    imageInput: required(root, "[data-image-input]"),
    uploadSection: required(root, "[data-upload-section]"),
    progressSection: required(root, "[data-progress-section]"),
    progressLabel: required(root, "[data-progress-label]"),
    progressValue: required(root, "[data-progress-value]"),
    progressBar: required(root, "[data-progress-bar]"),
    progressTrack: required(root, "[data-progress-track]"),
    progressDetail: required(root, "[data-progress-detail]"),
    errorSection: required(root, "[data-error-section]"),
    errorMessage: required(root, "[data-error-message]"),
    retryButton: required(root, "[data-retry-button]"),
    reviewSection: required(root, "[data-review-section]"),
    replaceImageButton: required(root, "[data-replace-image]"),
    sourceImage: required(root, "[data-source-image]"),
    rows: required(root, "[data-rows]"),
    addRowButton: required(root, "[data-add-row]"),
    grandTotal: required(root, "[data-grand-total]"),
    issueCount: required(root, "[data-issue-count]"),
    confirmCheckbox: required(root, "[data-confirm]"),
    exportBar: required(root, "[data-export-bar]"),
    exportTotal: required(root, "[data-export-total]"),
    exportButton: required(root, "[data-export]"),
    toast: required(root, "[data-toast]"),
    workflowSteps: [...root.querySelectorAll<HTMLElement>("[data-step]")],
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value: number | null, digits = 2): string {
  if (!Number.isFinite(value)) return "";
  return (value ?? 0).toFixed(digits).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formatMoney(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)} 元`;
}

function statusMarkup(row: ReceiptRow): string {
  const status = rowStatus(row);
  if (status.invalid) return `<span class="receipt-status is-error">缺少${escapeHtml(status.missing.join("、"))}</span>`;
  if (status.mismatch) {
    const reverse = Number.isFinite(status.reverseQuantity) ? ` · 反算 ${formatNumber(status.reverseQuantity)}` : "";
    return `<span class="receipt-status is-error">相差 ${Math.abs(status.difference ?? 0).toFixed(2)}${reverse}</span>`;
  }
  if (status.numericInferred) return '<span class="receipt-status is-review">金额关系辅助识别，请核对</span>';
  if (status.measurementKind === "unknown") return '<span class="receipt-status is-review">数量/重量类型待确认</span>';
  if (status.lowConfidence) return '<span class="receipt-status is-review">请重点核对</span>';
  return '<span class="receipt-status is-ok"><i data-lucide="circle-check" aria-hidden="true"></i>金额一致</span>';
}

function measurementLabel(row: ReceiptRow): string {
  const kind = rowStatus(row).measurementKind;
  if (kind === "weight") return "重量";
  if (kind === "count") return "数量";
  return "待确认";
}

export function mountReceiptChecker(root: HTMLElement, options: MountReceiptCheckerOptions = {}): MountedReceiptChecker {
  if (root.dataset.mounted === "true") throw new Error("Receipt checker is already mounted");
  root.dataset.mounted = "true";
  root.innerHTML = markup();
  const elements = collectElements(root);
  const controller = new AbortController();
  const { signal } = controller;
  const assetBaseUrl = options.assetBaseUrl ?? "/vendor/tesseract/";
  let ocrModule: Promise<typeof import("./ocr")> | undefined;
  let rows: ReceiptRow[] = [];
  let sourceUrl: string | undefined;
  let confirmed = false;
  let toastTimer: number | undefined;

  const refreshIcons = () => createIcons({
    icons: { CircleCheck, FileDown, ImageUp, Plus, RotateCcw, Trash2 },
    attrs: { "stroke-width": 1.75 },
  });

  function setStep(active: number) {
    for (const step of elements.workflowSteps) {
      const value = Number(step.dataset.step);
      step.classList.toggle("is-active", value === active);
      step.classList.toggle("is-complete", value < active);
    }
  }

  function setProgress(progress: number, label: string, detail: string) {
    const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
    elements.progressBar.style.width = `${percent}%`;
    elements.progressValue.textContent = `${percent}%`;
    elements.progressLabel.textContent = label;
    elements.progressDetail.textContent = detail;
    elements.progressTrack.setAttribute("aria-valuenow", String(percent));
  }

  function showToast(message: string, tone: "success" | "danger" = "success") {
    elements.toast.textContent = message;
    elements.toast.dataset.tone = tone;
    elements.toast.hidden = false;
    if (toastTimer !== undefined) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 2800);
  }

  function resetConfirmation() {
    confirmed = false;
    elements.confirmCheckbox.checked = false;
  }

  function renderSummary() {
    const summary = summarizeRows(rows);
    elements.grandTotal.textContent = formatMoney(summary.total);
    elements.exportTotal.textContent = formatMoney(summary.total);
    elements.issueCount.textContent = `${summary.issueCount} 项`;
    elements.issueCount.classList.toggle("has-issues", summary.issueCount > 0);
    elements.exportButton.disabled = !summary.canExport || !confirmed;
  }

  function renderRows() {
    elements.rows.innerHTML = rows.map((row) => {
      const status = rowStatus(row);
      const amount = calculatedAmount(row);
      const stateClass = status.invalid || status.mismatch ? " has-error" : status.needsReview ? " needs-review" : "";
      return `
        <article class="receipt-row${stateClass}" data-row-id="${escapeHtml(row.id)}">
          <div class="receipt-row__index" aria-label="第 ${row.order} 行">${row.order}</div>
          <label class="receipt-field lm-field receipt-field--name"><span class="lm-label">商品名称</span><input class="lm-input" data-field="name" type="text" value="${escapeHtml(row.name)}" autocomplete="off" /></label>
          <label class="receipt-field lm-field"><span class="lm-label">售价</span><input class="lm-input" data-field="price" type="number" inputmode="decimal" min="0" step="0.01" value="${formatNumber(row.price)}" /></label>
          <label class="receipt-field lm-field"><span class="lm-label">数量/重量（${measurementLabel(row)}）</span><input class="lm-input" data-field="quantity" type="number" inputmode="decimal" min="0" step="0.01" value="${formatNumber(row.quantity)}" /></label>
          <label class="receipt-field lm-field"><span class="lm-label">单位</span><input class="lm-input" data-field="unit" type="text" value="${escapeHtml(row.unit)}" autocomplete="off" /></label>
          <label class="receipt-field lm-field receipt-field--source"><span class="lm-label">原表金额</span><input class="lm-input" data-field="sourceAmount" type="number" inputmode="decimal" min="0" step="0.01" value="${formatNumber(row.sourceAmount)}" /></label>
          <div class="receipt-amount"><span>验算金额</span><strong>${amount === null ? "--" : amount.toFixed(2)}</strong>${statusMarkup(row)}</div>
          <button class="receipt-delete" type="button" data-action="delete" aria-label="删除第 ${row.order} 行" title="删除此行"><i data-lucide="trash-2" aria-hidden="true"></i></button>
        </article>`;
    }).join("");
    renderSummary();
    refreshIcons();
  }

  function showUpload() {
    elements.uploadSection.hidden = false;
    elements.progressSection.hidden = true;
    elements.errorSection.hidden = true;
    elements.reviewSection.hidden = true;
    elements.exportBar.hidden = true;
    elements.imageInput.value = "";
    setStep(1);
  }

  function showReview() {
    elements.uploadSection.hidden = true;
    elements.progressSection.hidden = true;
    elements.errorSection.hidden = true;
    elements.reviewSection.hidden = false;
    elements.exportBar.hidden = false;
    setStep(2);
    renderRows();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function processFile(file: File) {
    if (!file.type.startsWith("image/")) {
      elements.errorMessage.textContent = "请选择 PNG、JPG 或手机截图。";
      elements.errorSection.hidden = false;
      return;
    }
    resetConfirmation();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    elements.sourceImage.src = sourceUrl;
    elements.uploadSection.hidden = true;
    elements.errorSection.hidden = true;
    elements.reviewSection.hidden = true;
    elements.exportBar.hidden = true;
    elements.progressSection.hidden = false;
    setProgress(0.02, "正在读取截图", "识别在当前设备内完成，图片不会上传。");
    try {
      const ocr = await (ocrModule ??= import("./ocr").then((module) => {
        module.configureOcrAssets(assetBaseUrl);
        return module;
      }));
      rows = await ocr.recognizeSheet(file, (progress) => {
        if (progress.stage === "model") setProgress(progress.progress * 0.25, "正在加载中文模型", "首次使用耗时较长，之后会使用本机缓存。");
        else setProgress(0.25 + progress.progress * 0.75, "正在识别表格", progress.detail ?? "正在提取商品数据");
      });
      rows = renumberRows(rows);
      showReview();
    } catch (error) {
      console.error("OCR failed", error);
      elements.progressSection.hidden = true;
      elements.errorSection.hidden = false;
      elements.errorMessage.textContent = error instanceof Error ? error.message : `识别失败：${String(error ?? "未知错误")}`;
      setStep(1);
    }
  }

  elements.imageInput.addEventListener("change", () => {
    const file = elements.imageInput.files?.[0];
    if (file) void processFile(file);
  }, { signal });
  elements.retryButton.addEventListener("click", showUpload, { signal });
  elements.replaceImageButton.addEventListener("click", () => elements.imageInput.click(), { signal });
  elements.rows.addEventListener("change", (event) => {
    const input = (event.target as Element | null)?.closest<HTMLInputElement>("input[data-field]");
    const rowElement = input?.closest<HTMLElement>("[data-row-id]");
    if (!input || !rowElement) return;
    const row = rows.find((item) => item.id === rowElement.dataset.rowId);
    if (!row) return;
    const field = input.dataset.field;
    if (field === "price" || field === "quantity" || field === "sourceAmount") {
      row[field] = parseNumeric(input.value);
      row.numericInferred = false;
    } else if (field === "name" || field === "unit") {
      row[field] = input.value.trim();
    }
    row.confidence = 100;
    resetConfirmation();
    renderRows();
    const updated = elements.rows.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(row.id)}"]`);
    updated?.querySelector<HTMLInputElement>(`[data-field="${field}"]`)?.focus();
  }, { signal });
  elements.rows.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest("[data-action='delete']");
    const rowElement = button?.closest<HTMLElement>("[data-row-id]");
    if (!rowElement) return;
    rows = renumberRows(rows.filter((row) => row.id !== rowElement.dataset.rowId));
    resetConfirmation();
    renderRows();
  }, { signal });
  elements.addRowButton.addEventListener("click", () => {
    rows = [...rows, createRow({}, rows.length)];
    resetConfirmation();
    renderRows();
    elements.rows.lastElementChild?.querySelector<HTMLInputElement>("input")?.focus();
  }, { signal });
  elements.confirmCheckbox.addEventListener("change", () => {
    confirmed = elements.confirmCheckbox.checked;
    renderSummary();
    setStep(confirmed ? 3 : 2);
  }, { signal });
  elements.exportButton.addEventListener("click", async () => {
    const summary = summarizeRows(rows);
    if (!summary.canExport || !confirmed) return;
    try {
      const workbook = await import("./workbook");
      const adapter = options.exportAdapter ?? workbook.createBrowserWorkbookExportAdapter(root.ownerDocument);
      const result = await workbook.exportWorkbook(rows, adapter);
      showToast(result.status === "cancelled" ? "已取消保存" : "Excel 已保存，可以导入番茄标签");
    } catch (error) {
      console.error("Workbook save failed", error);
      showToast("Excel 保存失败，请重试", "danger");
    }
  }, { signal });

  refreshIcons();
  showUpload();

  return {
    async destroy() {
      controller.abort();
      if (toastTimer !== undefined) window.clearTimeout(toastTimer);
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (ocrModule) await (await ocrModule).terminateOcr();
      root.replaceChildren();
      delete root.dataset.mounted;
    },
  };
}
