import { createWorker } from "tesseract.js";
import { resolveNumericRow } from "./numeric.ts";
import { resolveHeaderSchema } from "./schema.ts";
import {
  createRow,
  knownUnitForItem,
  matchKnownItem,
  normalizeUnit,
  parseNumeric,
} from "./table.ts";

const activeWorkers = new Set();
let runtimeAssetBaseUrl = "/vendor/tesseract/";

export function configureOcrAssets(assetBaseUrl) {
  runtimeAssetBaseUrl = `${String(assetBaseUrl || "/vendor/tesseract").replace(/\/$/, "")}/`;
}

function groupPositions(values, maxGap = 3) {
  if (!values.length) return [];
  const groups = [[values[0]]];

  for (let index = 1; index < values.length; index += 1) {
    const current = values[index];
    const group = groups.at(-1);
    if (current - group.at(-1) <= maxGap) group.push(current);
    else groups.push([current]);
  }

  return groups.map((group) => Math.round(group.reduce((sum, value) => sum + value, 0) / group.length));
}

function darkPixelCount(imageData, axis, position, from, to) {
  const { data, width } = imageData;
  let count = 0;
  for (let cursor = from; cursor < to; cursor += 1) {
    const x = axis === "x" ? position : cursor;
    const y = axis === "y" ? position : cursor;
    const offset = (y * width + x) * 4;
    const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
    if (data[offset + 3] > 0 && luminance < 175) count += 1;
  }
  return count;
}

export function detectTableGrid(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const horizontalCandidates = [];

  for (let y = 0; y < canvas.height; y += 1) {
    if (darkPixelCount(imageData, "y", y, 0, canvas.width) > canvas.width * 0.52) {
      horizontalCandidates.push(y);
    }
  }

  const horizontalMergeGap = Math.max(1, Math.round(canvas.height * 0.004));
  const rows = groupPositions(horizontalCandidates, horizontalMergeGap).filter((position, index, values) => (
    index === 0 || position - values[index - 1] > Math.max(3, canvas.height * 0.012)
  ));

  if (rows.length < 4) {
    throw new Error("没有找到完整的横向表格线。请上传领导发送的原始表格截图，不要裁掉表头和今日汇总行。");
  }

  const tableTop = rows[0];
  const tableBottom = rows.at(-1);
  const verticalCandidates = [];

  for (let x = 0; x < canvas.width; x += 1) {
    if (darkPixelCount(imageData, "x", x, tableTop, tableBottom) > (tableBottom - tableTop) * 0.62) {
      verticalCandidates.push(x);
    }
  }

  const verticalMergeGap = Math.max(1, Math.round(canvas.width * 0.004));
  const columns = groupPositions(verticalCandidates, verticalMergeGap).filter((position, index, values) => (
    index === 0 || position - values[index - 1] > Math.max(4, canvas.width * 0.012)
  ));

  if (columns.length < 7) {
    throw new Error("没有找到完整的表格列。请保留序号到销售总价的完整表头后重新截图。");
  }

  const dataRows = [];
  const minimumRowHeight = Math.max(4, Math.round((rows[1] - rows[0]) * 0.25));
  for (let index = 1; index < rows.length - 2; index += 1) {
    const top = rows[index];
    const bottom = rows[index + 1];
    if (bottom - top >= minimumRowHeight) dataRows.push({ top, bottom });
  }

  if (!dataRows.length) {
    throw new Error("没有找到商品数据行，请确认截图中包含完整表格。");
  }

  return {
    rows: dataRows,
    columns,
    headerRow: { top: rows[0], bottom: rows[1] },
    tableTop,
    tableBottom,
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("图片无法打开，请重新选择 PNG、JPG 或手机截图。"));
    };
    image.src = objectUrl;
  });
}

function imageToCanvas(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  return canvas;
}

function cropCell(
  sourceCanvas,
  left,
  top,
  right,
  bottom,
  mode = "text",
  numericThreshold = 185,
) {
  const paddingX = Math.max(2, Math.round((right - left) * 0.025));
  const paddingY = Math.max(1, Math.round((bottom - top) * 0.06));
  const width = Math.max(1, right - left - paddingX * 2);
  const height = Math.max(1, bottom - top - paddingY * 2);
  const targetHeight = mode === "numeric" || mode === "numeric-gray" ? 72 : 80;
  const scale = targetHeight / height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = targetHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    sourceCanvas,
    left + paddingX,
    top + paddingY,
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const luminance = imageData.data[index] * 0.299
      + imageData.data[index + 1] * 0.587
      + imageData.data[index + 2] * 0.114;
    const value = mode === "numeric-gray"
      ? luminance
      : mode === "numeric"
        ? luminance < numericThreshold ? 0 : 255
        : luminance < 220 ? 0 : 255;
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
    imageData.data[index + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

async function createOcrWorker(language, onProgress) {
  const assetBase = new URL(runtimeAssetBaseUrl, document.baseURI);
  const workerPath = new URL("worker/worker.min.js", assetBase).href;
  const corePath = new URL("core", assetBase).href.replace(/\/$/, "");
  const langPath = new URL("lang", assetBase).href.replace(/\/$/, "");
  const worker = await createWorker(language, 1, {
    cacheMethod: "write",
    workerPath,
    corePath,
    langPath,
    logger(message) {
      if (message.status === "loading language traineddata") {
        onProgress?.({ stage: "model", progress: message.progress ?? 0 });
      }
    },
  });
  activeWorkers.add(worker);
  return worker;
}

async function recognizeCell(worker, canvas) {
  const result = await worker.recognize(canvas, {}, { text: true });
  return {
    text: result.data.text.replace(/[\r\n]+/g, " ").trim(),
    confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : 0,
  };
}

async function recognizeHeaders(worker, sourceCanvas, grid, report) {
  await worker.setParameters({
    tessedit_pageseg_mode: "6",
    preserve_interword_spaces: "1",
    tessedit_char_whitelist: "",
    user_defined_dpi: "300",
  });

  const headerCells = [];
  for (let index = 0; index < grid.columns.length - 1; index += 1) {
    const left = grid.columns[index];
    const right = grid.columns[index + 1];
    const result = await recognizeCell(
      worker,
      cropCell(sourceCanvas, left, grid.headerRow.top, right, grid.headerRow.bottom),
    );
    headerCells.push({ ...result, left, right });
    report(`正在识别表头第 ${index + 1} 列`);
  }

  return resolveHeaderSchema(headerCells);
}

async function recognizeNumericCell(worker, sourceCanvas, left, top, right, bottom, expand = false) {
  const primary = await recognizeCell(
    worker,
    cropCell(sourceCanvas, left, top, right, bottom, "numeric", 185),
  );
  const readings = [{ ...primary, variant: "binary-185" }];
  if (!expand && Number.isFinite(parseNumeric(primary.text))) return readings;

  for (const threshold of [155, 210]) {
    const result = await recognizeCell(
      worker,
      cropCell(sourceCanvas, left, top, right, bottom, "numeric", threshold),
    );
    readings.push({ ...result, variant: `binary-${threshold}` });
  }

  const grayscale = await recognizeCell(
    worker,
    cropCell(sourceCanvas, left, top, right, bottom, "numeric-gray"),
  );
  readings.push({ ...grayscale, variant: "grayscale" });
  return readings;
}

function createNumericColumnStrip(sourceCanvas, field, rows) {
  const cells = rows.map((row) => cropCell(
    sourceCanvas,
    field.left,
    row.top,
    field.right,
    row.bottom,
    "numeric",
    185,
  ));
  const verticalPadding = 12;
  const stride = 96;
  const width = Math.max(...cells.map((cell) => cell.width)) + 24;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = rows.length * stride;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  cells.forEach((cell, index) => {
    const x = Math.round((width - cell.width) / 2);
    context.drawImage(cell, x, index * stride + verticalPadding);
  });
  return { canvas, stride };
}

async function recognizeNumericColumn(worker, sourceCanvas, field, rows) {
  const strip = createNumericColumnStrip(sourceCanvas, field, rows);
  const result = await worker.recognize(strip.canvas, {}, { text: true, blocks: true });
  const groups = Array.from({ length: rows.length }, () => []);

  for (const block of result.data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const centerY = (line.bbox.y0 + line.bbox.y1) / 2;
        const rowIndex = Math.max(0, Math.min(rows.length - 1, Math.floor(centerY / strip.stride)));
        groups[rowIndex].push(line);
      }
    }
  }

  if (groups.every((group) => group.length === 0)) {
    const lines = result.data.text.split(/[\r\n]+/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === rows.length) {
      return lines.map((text) => ({ text, confidence: result.data.confidence, variant: "column" }));
    }
  }

  return groups.map((group) => {
    const ordered = group.sort((left, right) => left.bbox.x0 - right.bbox.x0);
    return {
      text: ordered.map((line) => line.text.trim()).join(""),
      confidence: ordered.length ? Math.min(...ordered.map((line) => line.confidence)) : 0,
      variant: "column",
    };
  });
}

function resolveSourceOrder(readings) {
  const candidates = readings
    .map((reading) => ({
      value: parseNumeric(reading.text),
      confidence: reading.confidence,
    }))
    .filter((candidate) => Number.isInteger(candidate.value) && candidate.value > 0)
    .sort((left, right) => right.confidence - left.confidence);
  return candidates[0] ?? { value: null, confidence: 0 };
}

export async function recognizeSheet(file, onProgress) {
  const image = await loadImage(file);
  const sourceCanvas = imageToCanvas(image);
  const grid = detectTableGrid(sourceCanvas);
  const results = grid.rows.map(() => ({ confidence: [] }));
  const totalCells = (grid.columns.length - 1) + grid.rows.length * 6;
  let completed = 0;

  const report = (detail) => {
    completed += 1;
    onProgress?.({ stage: "recognize", progress: completed / totalCells, detail });
  };

  let worker = null;
  try {
    worker = await createOcrWorker("chi_sim", onProgress);
    const schema = await recognizeHeaders(worker, sourceCanvas, grid, report);

    await worker.setParameters({
      tessedit_pageseg_mode: "7",
      preserve_interword_spaces: "1",
      tessedit_char_whitelist: "",
      user_defined_dpi: "300",
    });

    for (let index = 0; index < grid.rows.length; index += 1) {
      const row = grid.rows[index];
      const name = await recognizeCell(
        worker,
        cropCell(sourceCanvas, schema.name.left, row.top, schema.name.right, row.bottom),
      );
      const knownName = matchKnownItem(name.text);
      results[index].name = knownName.value;
      results[index].confidence.push(knownName.corrected ? Math.min(name.confidence, 68) : name.confidence);
      report(`正在识别第 ${index + 1} 行商品名称`);

      const unit = await recognizeCell(
        worker,
        cropCell(sourceCanvas, schema.unit.left, row.top, schema.unit.right, row.bottom),
      );
      const normalizedUnit = normalizeUnit(unit.text);
      const knownUnit = knownUnitForItem(knownName.value);
      const unitIsValid = ["kg", "块", "瓶"].includes(normalizedUnit);
      results[index].unit = !unitIsValid && knownUnit ? knownUnit : normalizedUnit;
      results[index].confidence.push(!unitIsValid && knownUnit
        ? Math.min(unit.confidence, 68)
        : unit.confidence);
      report(`正在识别第 ${index + 1} 行单位`);
    }
    await worker.terminate();
    activeWorkers.delete(worker);
    worker = null;

    worker = await createOcrWorker("eng", onProgress);
    await worker.setParameters({
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "0",
      tessedit_char_whitelist: "0123456789.-",
      user_defined_dpi: "300",
    });

    const numericColumns = {};
    for (const [field, detail] of [
      ["order", "序号"],
      ["price", "售价"],
      ["quantity", "数量/重量"],
      ["sourceAmount", "原表金额"],
    ]) {
      numericColumns[field] = await recognizeNumericColumn(
        worker,
        sourceCanvas,
        schema[field],
        grid.rows,
      );
      for (let index = 0; index < grid.rows.length; index += 1) {
        report(`正在识别第 ${index + 1} 行${detail}`);
      }
    }

    await worker.setParameters({ tessedit_pageseg_mode: "7" });

    for (let index = 0; index < grid.rows.length; index += 1) {
      const row = grid.rows[index];
      const readingFor = async (field) => {
        const primary = numericColumns[field][index];
        if (Number.isFinite(parseNumeric(primary.text))) return [primary];
        return recognizeNumericCell(
          worker,
          sourceCanvas,
          schema[field].left,
          row.top,
          schema[field].right,
          row.bottom,
        );
      };

      const orderReadings = await readingFor("order");
      const sourceOrder = resolveSourceOrder(orderReadings);
      results[index].sourceOrder = sourceOrder.value;
      results[index].sourceOrderConfidence = sourceOrder.confidence;

      let priceReadings = await readingFor("price");
      let quantityReadings = await readingFor("quantity");
      let sourceAmountReadings = await readingFor("sourceAmount");

      let numeric = resolveNumericRow({
        priceReadings,
        quantityReadings,
        sourceAmountReadings,
      });
      if (!numeric.formulaMatches) {
        const expandLowConfidence = async (field, readings) => {
          if (readings.some((reading) => reading.confidence >= 72)) return readings;
          const alternatives = await recognizeNumericCell(
            worker,
            sourceCanvas,
            schema[field].left,
            row.top,
            schema[field].right,
            row.bottom,
            true,
          );
          return [...readings, ...alternatives];
        };

        priceReadings = await expandLowConfidence("price", priceReadings);
        quantityReadings = await expandLowConfidence("quantity", quantityReadings);
        sourceAmountReadings = await expandLowConfidence("sourceAmount", sourceAmountReadings);
        numeric = resolveNumericRow({ priceReadings, quantityReadings, sourceAmountReadings });
      }
      Object.assign(results[index], {
        price: numeric.price,
        quantity: numeric.quantity,
        sourceAmount: numeric.sourceAmount,
        reverseQuantity: numeric.reverseQuantity,
        numericInferred: numeric.inferred,
      });

      const numericConfidence = Math.min(
        Math.max(...priceReadings.map((reading) => reading.confidence)),
        Math.max(...quantityReadings.map((reading) => reading.confidence)),
        Math.max(...sourceAmountReadings.map((reading) => reading.confidence)),
      );
      results[index].confidence.push(numeric.inferred
        ? Math.min(numericConfidence, 68)
        : numericConfidence);
    }

    const orderCounts = new Map();
    for (const result of results) {
      orderCounts.set(result.sourceOrder, (orderCounts.get(result.sourceOrder) ?? 0) + 1);
    }
    for (const result of results) {
      const validOrder = Number.isInteger(result.sourceOrder)
        && orderCounts.get(result.sourceOrder) === 1;
      result.confidence.push(validOrder ? result.sourceOrderConfidence : 0);
    }
  } finally {
    if (worker) {
      await worker.terminate();
      activeWorkers.delete(worker);
    }
  }

  return results.map((result, index) => createRow({
    ...result,
    confidence: Math.min(...result.confidence),
  }, index));
}

export async function terminateOcr() {
  const workers = [...activeWorkers];
  await Promise.all(workers.map((worker) => worker.terminate()));
  activeWorkers.clear();
}
