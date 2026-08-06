import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

test("brand homepage remains focused and responsive", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/小鱼/);
  await expect(page.getByRole("heading", { level: 1, name: "小鱼" })).toBeVisible();
  await expect(page.getByText("把麻烦的小事，留给工具。")).toBeVisible();
  await expect(page.locator(".hero__content")).toHaveCSS("animation-name", "lm-motion-enter");
  await expect(page.locator(".hero__brand")).toHaveCount(0);
  await expect(page.locator(".principle-card")).toHaveCount(3);
  await expect(page.locator(".tool-card")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  for (const link of await page.locator(".hero__actions a").all()) {
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("tool catalog exposes the receipt checker only on the secondary page", async ({ page }) => {
  await page.goto("/tools/");
  await expect(page.getByRole("heading", { level: 1, name: "小而专注的工具。" })).toBeVisible();
  await expect(page.getByRole("link", { name: /小票验算/ })).toBeVisible();
  await page.getByRole("link", { name: /小票验算/ }).click();
  await expect(page).toHaveURL(/\/tools\/receipt-checker\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "小票验算" })).toBeVisible();
  await expect(page.getByText("选择表格截图")).toBeVisible();
});

test("public pages share one page rhythm and typography contract", async ({ page }) => {
  for (const pathname of ["/", "/tools/", "/tools/receipt-checker/", "/about/", "/privacy/"]) {
    await page.goto(pathname);
    await expect(page.locator("main > .lm-page").first()).toBeVisible();
    const pageHeading = page.getByRole("heading", { level: 1 });
    await expect(pageHeading).toBeVisible();
    await expect(pageHeading).toHaveCSS("letter-spacing", "normal");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  }
});

test("offline and error routes use the same branded recovery state", async ({ page }) => {
  for (const pathname of ["/offline/", "/404/", "/403/", "/500/"]) {
    await page.goto(pathname);
    const state = page.locator(".lm-state");
    await expect(state).toBeVisible();
    await expect(state.locator(".lm-state__icon")).toBeVisible();
    await expect(state.locator(".lm-state__actions .lm-button").first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  }
});

test("receipt loading keeps a branded skeleton layout ready", async ({ page }) => {
  await page.goto("/tools/receipt-checker/");
  await expect(page.locator("[data-progress-section] .lm-skeleton")).toHaveCount(3);
  await expect(page.locator("[data-receipt-checker] .lm-toast")).toHaveCount(1);
});

test("theme choice persists without hiding keyboard focus", async ({ browserName, page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /切换为.*外观/ });
  await toggle.click();
  const selected = await page.locator("html").getAttribute("data-theme");
  expect(["light", "dark"]).toContain(selected);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", selected ?? "dark");
  const skipLink = page.getByRole("link", { name: "跳到主要内容" });
  if (browserName === "webkit") {
    // Mobile Safari/WebKit does not enable full-keyboard Tab navigation by
    // default, but focusable controls must still expose the same focus state.
    await skipLink.focus();
  } else {
    await page.keyboard.press("Tab");
  }
  await expect(skipLink).toBeFocused();
});

test("private control entry appears only after the non-sensitive login hint", async ({ context, page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "控制中心" })).toHaveCount(0);

  await context.addCookies([{
    name: "control_hint",
    value: "1",
    domain: "127.0.0.1",
    path: "/",
    sameSite: "Strict",
  }]);
  await page.reload();
  await expect(page.getByRole("link", { name: "控制中心" })).toHaveAttribute("href", "/control/");
});

test("footer privacy link reveals the private control route only after five quick clicks", async ({ page }) => {
  await page.goto("/");
  const privacyLink = page.getByRole("link", { name: "隐私", exact: true });

  await privacyLink.click({ clickCount: 5, delay: 60 });

  await expect(page).toHaveURL(/\/control\/$/);
});

test("a normal privacy click keeps the footer link behavior unchanged", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "隐私", exact: true }).click();
  await expect(page).toHaveURL(/\/privacy\/$/);
});

test("invalid local file shows inline feedback without a POST request", async ({ page }) => {
  const postRequests: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") postRequests.push(request.url()); });
  await page.goto("/tools/receipt-checker/");
  await page.locator("[data-image-input]").setInputFiles({ name: "not-an-image.txt", mimeType: "text/plain", buffer: Buffer.from("local") });
  await expect(page.getByRole("alert")).toContainText("请选择 PNG、JPG 或手机截图");
  expect(postRequests).toEqual([]);
});

test("real receipt fixture stays local and completes OCR", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "完整 OCR 仅在桌面 Chromium 跑一次，避免重复下载模型");
  testInfo.setTimeout(300_000);

  const posts: string[] = [];
  const externalRequests: string[] = [];
  const failedOcrAssets: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (request.method() === "POST") posts.push(url);
    if (/^https?:/.test(url) && !url.startsWith("http://127.0.0.1:4321")) externalRequests.push(url);
  });
  page.on("response", (response) => {
    if (response.url().includes("/vendor/tesseract/") && response.status() >= 400) {
      failedOcrAssets.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/tools/receipt-checker/");
  const fixture = fileURLToPath(new URL("../fixtures/leader-sheet-4-rows.png", import.meta.url));
  await page.locator("[data-image-input]").setInputFiles(fixture);
  await page.locator("[data-review-section]:not([hidden]), [data-error-section]:not([hidden])")
    .waitFor({ state: "visible", timeout: 280_000 });

  const error = page.locator("[data-error-section]");
  if (await error.isVisible()) {
    throw new Error(`OCR 页面报错：${await page.locator("[data-error-message]").textContent()}`);
  }

  const rows = await page.locator("[data-row-id]").evaluateAll((elements) => elements.map((element) => (
    Object.fromEntries([...element.querySelectorAll<HTMLInputElement>("input[data-field]")]
      .map((input) => [input.dataset.field, input.value]))
  )));
  expect(rows).toEqual([
    { name: "(猪)净肉", price: "24.98", quantity: "5.08", unit: "kg", sourceAmount: "126.9" },
    { name: "(猪)五花肉", price: "28.98", quantity: "2.23", unit: "kg", sourceAmount: "64.63" },
    { name: "(猪)脊骨", price: "24.98", quantity: "8.81", unit: "kg", sourceAmount: "220.07" },
    { name: "牛肋条", price: "79.98", quantity: "3.21", unit: "kg", sourceAmount: "256.74" },
  ]);
  await expect(page.locator("[data-grand-total]")).toHaveText("668.34 元");
  expect(posts).toEqual([]);
  expect(externalRequests).toEqual([]);
  expect(failedOcrAssets).toEqual([]);
});

test("SEO and PWA artifacts are discoverable", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://leimuovo.com/");
  const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
  expect(structuredData).toContain("WebSite");
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const manifestResponse = await request.get(manifestHref!);
  expect(manifestResponse.ok()).toBe(true);
  expect(await manifestResponse.json()).toMatchObject({ name: "小鱼", short_name: "小鱼" });
  expect((await request.get("/robots.txt")).ok()).toBe(true);
  expect((await request.get("/sitemap-index.xml")).ok()).toBe(true);
});
