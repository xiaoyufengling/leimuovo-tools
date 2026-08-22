import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

test("brand homepage remains focused and responsive", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/小鱼/);
  await expect(page.getByRole("heading", { level: 1, name: /把模糊的想法.*界面与视觉素材/ })).toBeVisible();
  await expect(page.getByText(/我为独立开发者、小团队和内容创作者/)).toBeVisible();
  await expect(page.locator(".signature-study")).toBeVisible();
  await expect(page.locator(".advantage-card")).toHaveCount(3);
  await expect(page.locator(".service-card")).toHaveCount(4);
  await expect(page.locator(".price-card")).toHaveCount(4);
  await expect(page.locator(".tool-card")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  for (const link of await page.locator(".portfolio-hero__actions a").all()) {
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("homepage remains readable when the motion bundle is unavailable", async ({ page }) => {
  await page.route("**/_astro/*.js", (route) => route.abort());
  await page.goto("/");

  const heroCopy = page.locator(".portfolio-hero__copy");
  await expect(heroCopy).toBeVisible();
  await expect(heroCopy).not.toHaveCSS("opacity", "0");
  await expect(page.getByRole("heading", { level: 1, name: /把模糊的想法.*界面与视觉素材/ })).toBeVisible();
});

test("homepage recovers from the legacy transparent cache state", async ({ page }) => {
  await page.route("**/_astro/*.js", (route) => route.abort());
  await page.goto("/");

  const heroCopy = page.locator(".portfolio-hero__copy");
  await heroCopy.evaluate((element) => {
    element.classList.remove("is-visible");
    element.style.opacity = "0";
    element.style.visibility = "hidden";
    element.style.transform = "translate3d(0, 2rem, 0)";
  });

  await expect(heroCopy).not.toHaveCSS("opacity", "0", { timeout: 4_000 });
  await expect(heroCopy).toBeVisible();
});

test("homepage cat ears reveal the quiet easter egg", async ({ page }) => {
  await page.goto("/");
  const catEars = page.getByRole("button", { name: "摸摸小鱼名字上的猫耳" });
  await expect(catEars).toBeVisible();
  await expect(catEars).toHaveAttribute("aria-pressed", "false");
  await catEars.click();
  await expect(catEars).toHaveAttribute("aria-pressed", "true");
  await expect(catEars).toHaveClass(/is-petted/);
  await expect(catEars.locator(".cat-ear-easter-egg__message")).toHaveText("喵~");
});

test("dark homepage keeps glass hierarchy and silhouette action icons", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("leimuovo-theme", "dark"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const actionIcons = page.locator(".portfolio-hero__actions .portfolio-button__icon");
  await expect(actionIcons).toHaveCount(2);
  await expect(actionIcons.locator("svg")).toHaveCount(2);
  expect(await actionIcons.allTextContents()).toEqual(["", ""]);

  const contactIcons = page.locator(".studio-contact .portfolio-button__icon");
  await expect(contactIcons).toHaveCount(2);
  await expect(contactIcons.locator("svg")).toHaveCount(2);
  expect(await contactIcons.allTextContents()).toEqual(["", ""]);

  const darkArtifacts = await page.evaluate(() => ({
    canvasBackground: getComputedStyle(document.documentElement).backgroundColor,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    topBackdrop: getComputedStyle(document.body).backgroundImage,
    pearlWash: getComputedStyle(document.querySelector(".home-atmosphere__wash--pearl")!).backgroundImage,
    headerShadow: getComputedStyle(document.querySelector(".site-header")!).boxShadow,
    cardShadow: getComputedStyle(document.querySelector(".studio-card")!).boxShadow,
    archiveShadow: getComputedStyle(document.querySelector(".signature-study__frame")!).boxShadow,
  }));

  expect(darkArtifacts.canvasBackground).toBe("rgb(23, 25, 28)");
  expect(darkArtifacts.bodyBackground).toBe("rgb(23, 25, 28)");
  expect(darkArtifacts.topBackdrop).toContain("linear-gradient");
  expect(darkArtifacts.topBackdrop).not.toContain("0, 0, 0");
  expect(darkArtifacts.pearlWash).not.toContain("255, 255, 255");
  expect(darkArtifacts.headerShadow).not.toContain("0.96");
  expect(darkArtifacts.cardShadow).not.toContain("0.72");
  expect(darkArtifacts.archiveShadow).not.toContain("0.98");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("light homepage keeps a cool porcelain liquid-glass hierarchy", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("leimuovo-theme", "light"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  const palette = await page.evaluate(() => ({
    canvas: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
    ink: getComputedStyle(document.querySelector(".lm-page--home")!).color,
    backdrop: getComputedStyle(document.body).backgroundImage,
    headerFilter: getComputedStyle(document.querySelector(".site-header")!).backdropFilter,
    headerShadow: getComputedStyle(document.querySelector(".site-header")!).boxShadow,
    archiveFilter: getComputedStyle(document.querySelector(".signature-study__frame")!).backdropFilter,
    cardBackground: getComputedStyle(document.querySelector(".studio-card")!).backgroundColor,
    cardBorder: getComputedStyle(document.querySelector(".studio-card")!).borderColor,
    cardShadow: getComputedStyle(document.querySelector(".studio-card")!).boxShadow,
  }));

  expect(palette.canvas).toBe("rgb(242, 245, 247)");
  expect(palette.body).toBe("rgb(242, 245, 247)");
  expect(palette.ink).toBe("rgb(25, 27, 31)");
  expect(palette.backdrop).toContain("radial-gradient");
  expect(palette.backdrop).toContain("linear-gradient");
  expect(palette.headerFilter).toContain("blur");
  expect(palette.archiveFilter).toContain("blur");
  expect(palette.cardBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(palette.cardBorder).not.toBe("rgba(0, 0, 0, 0)");
  expect(palette.cardShadow).not.toBe("none");
  expect(palette.headerShadow).not.toBe("none");
});

test("homepage opens the noindex Xiaoyugan visual laboratory", async ({ page }) => {
  await page.goto("/");
  const labEntry = page.locator(".lab-feature__link");
  await labEntry.scrollIntoViewIfNeeded();
  await expect(labEntry).toBeVisible();
  await expect(labEntry).toHaveAttribute("href", "/xiaoyugan/");
  await labEntry.click();

  await expect(page).toHaveURL(/\/xiaoyugan\/$/);
  await expect(page).toHaveTitle("小鱼干｜视觉实验室");
  await expect(page.getByRole("heading", { level: 1, name: /让界面.*拥有触感/ })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  expect(await page.locator(".xyg-glass").count()).toBeGreaterThanOrEqual(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
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
