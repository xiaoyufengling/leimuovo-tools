import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

test("visual playground is visible and responsive on first paint", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/小鱼.*Visual Playground/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("BEYOND");
  await expect(page.locator(".pg-hero-copy")).toBeVisible();
  await expect(page.locator(".pg-hero-copy")).toHaveCSS("opacity", "1");
  await expect(page.locator('a[href="/xiaoyugan/"]')).toHaveCount(0);
  await expect(page.locator(".service-card, .price-card")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("material and shape controls respond to repeated input immediately", async ({ page }) => {
  await page.goto("/");
  for (const material of [1, 2, 0, 2, 0]) {
    await page.locator(`[data-material="${material}"]`).click();
    await expect(page.locator(`[data-material="${material}"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-material][aria-pressed="true"]')).toHaveCount(1);
  }
  await page.locator("[data-shape-control]").fill("86");
  await expect(page.locator("#shape-value")).toHaveText("86");
});

test("field modes and interruptible glass spread retain the latest request", async ({ page }) => {
  await page.goto("/");
  for (const mode of [1, 2, 0, 2]) {
    await page.locator(`[data-field="${mode}"]`).click();
    await expect(page.locator(`[data-field="${mode}"]`)).toHaveAttribute("aria-pressed", "true");
  }
  for (const value of [100, 0, 100, 0, 100]) {
    await page.locator(`[data-space-preset="${value}"]`).click();
    await expect(page.locator("#space-value")).toHaveText(`${value}%`);
  }
  await expect.poll(() => page.locator("[data-glass-stage]").evaluate(el => Number(getComputedStyle(el).getPropertyValue("--spread")))).toBeGreaterThan(.99);
});

test("native fast reverse scrolling is never captured or snapped", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => scrollTo(0, 500));
  await page.mouse.wheel(0, 1500);
  await page.mouse.wheel(0, -2200);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(50);
  const scrolling = await page.evaluate(() => ({
    behavior: getComputedStyle(document.documentElement).scrollBehavior,
    snap: getComputedStyle(document.documentElement).scrollSnapType,
    touch: getComputedStyle(document.querySelector("[data-flow-canvas]")!).touchAction,
  }));
  expect(scrolling).toEqual({ behavior: "auto", snap: "none", touch: "pan-y" });
});

test("reduced motion starts paused and all controls still work", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-motion-toggle]")).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-space-preset="100"]').click();
  await expect(page.locator("#space-value")).toHaveText("100%");
  await page.locator('[data-space-preset="0"]').click();
  await expect(page.locator("#space-value")).toHaveText("0%");
});

test("homepage remains readable when its motion bundle fails", async ({ page }) => {
  await page.route("**/_astro/*.js", route => route.abort());
  await page.goto("/");
  await expect(page.locator(".pg-hero-copy")).toBeVisible();
  await expect(page.locator(".pg-sculpture-fallback")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("BEYOND");
});

test("legacy noindex laboratory remains isolated and functional", async ({ page }) => {
  let count = 3;
  await page.route("**/api/lab/pets**", async (route) => {
    if (route.request().method() === "POST") count += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        visitor: { label: "冰蓝小鱼 · TEST", count },
        totalPets: count + 12,
        participantCount: 4,
        leaders: [
          { label: "月光小鱼 · 0001", count: 8 },
          { label: "冰蓝小鱼 · TEST", count },
        ],
      }),
    });
  });
  await page.goto("/xiaoyugan/");

  await expect(page).toHaveURL(/\/xiaoyugan\/$/);
  await expect(page).toHaveTitle("小鱼干｜蕾姆触摸实验室");
  await expect(page.getByRole("heading", { level: 1, name: /先摸一下.*再认识这个界面/ })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator("[data-pet-card]")).toBeVisible();
  await expect(page.locator(".xyg-brand__mark")).toHaveAttribute("src", "/brand/rem-cat-avatar-96-v6.png");
  await expect(page.locator(".xyg-rem-face")).toBeVisible();
  await expect(page.locator(".xyg-rem-face")).toHaveAttribute("src", "/brand/rem-cat-avatar-512-v6.png");
  await expect(page.locator("[data-rem-artwork]")).toHaveCount(1);
  await expect(page.locator("[data-rem-parts], [data-rem-base], [data-rem-ear]")).toHaveCount(0);
  const petButton = page.getByRole("button", { name: "摸一下蕾姆猫耳" });
  await expect(petButton).toBeVisible();
  await expect(page.locator("[data-own-count]").first()).toHaveText("3");
  await petButton.dispatchEvent("pointerdown", { clientX: 220, clientY: 180, pointerId: 1, pointerType: "mouse" });
  await expect(petButton).toHaveClass(/is-pet-active/);
  await petButton.dispatchEvent("click");
  await expect(page.locator("[data-own-count]").first()).toHaveText("4");
  await expect(page.locator("[data-recent-pets] li").first()).toContainText("蕾姆猫耳收到一次摸摸");
  await expect.poll(() => petButton.evaluate((element) => element.classList.contains("is-pet-active"))).toBe(false);
  expect(await page.locator(".xyg-glass").count()).toBeGreaterThanOrEqual(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("mobile laboratory stays visible when animation frames are delayed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "This protects the mobile first-paint path");
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 1;
  });
  await page.goto("/xiaoyugan/", { waitUntil: "domcontentloaded" });

  const visibleState = await page.evaluate(() => {
    const intro = document.querySelector<HTMLElement>(".xyg-intro");
    const card = document.querySelector<HTMLElement>("[data-pet-card]");
    return {
      introOpacity: intro ? Number(getComputedStyle(intro).opacity) : 0,
      cardOpacity: card ? Number(getComputedStyle(card).opacity) : 0,
      cardVisibility: card ? getComputedStyle(card).visibility : "hidden",
    };
  });

  expect(visibleState.introOpacity).toBeGreaterThanOrEqual(0.95);
  expect(visibleState.cardOpacity).toBeGreaterThanOrEqual(0.95);
  expect(visibleState.cardVisibility).not.toBe("hidden");
});

test("mobile short tap bounces the exact approved artwork without swapping layers", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "This regression exercises the touch interaction path");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let count = 2;
  await page.route("**/api/lab/pets**", async (route) => {
    if (route.request().method() === "POST") count += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        visitor: { label: "冰蓝小鱼 · TAP1", count },
        totalPets: count + 6,
        participantCount: 2,
        leaders: [],
      }),
    });
  });

  await page.goto("/xiaoyugan/", { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: "摸一下蕾姆猫耳" });
  const approvedArtwork = page.locator(".xyg-rem-face");
  await expect(page.locator("[data-own-count]").first()).toHaveText("2");
  await button.scrollIntoViewIfNeeded();
  const initialTransform = await approvedArtwork.evaluate((element) => getComputedStyle(element).transform);
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  const clientX = (box?.x ?? 0) + (box?.width ?? 0) * 0.28;
  const clientY = (box?.y ?? 0) + (box?.height ?? 0) * 0.32;

  await page.mouse.move(clientX, clientY);
  await page.mouse.down();
  await page.waitForTimeout(40);
  const pressedFrame = await page.evaluate(() => ({
    approvedOpacity: Number(getComputedStyle(document.querySelector<HTMLElement>(".xyg-rem-face")!).opacity),
    replacementLayers: document.querySelectorAll("[data-rem-parts], [data-rem-base], [data-rem-ear]").length,
    approvedTransform: getComputedStyle(document.querySelector<HTMLElement>(".xyg-rem-face")!).transform,
    approvedSource: document.querySelector<HTMLImageElement>(".xyg-rem-face")?.getAttribute("src"),
    touchAction: getComputedStyle(document.querySelector<HTMLElement>("[data-pet-button]")!).touchAction,
  }));
  expect(pressedFrame.approvedOpacity).toBeGreaterThanOrEqual(0.99);
  expect(pressedFrame.replacementLayers).toBe(0);
  expect(pressedFrame.approvedTransform).not.toBe(initialTransform);
  expect(pressedFrame.approvedSource).toBe("/brand/rem-cat-avatar-512-v6.png");
  expect(pressedFrame.touchAction).toBe("manipulation");
  await page.mouse.up();
  await expect(page.locator("[data-own-count]").first()).toHaveText("3");

  await expect.poll(() => approvedArtwork.evaluate((element) => getComputedStyle(element).transform)).toBe(initialTransform);
  await expect(approvedArtwork).toHaveCSS("opacity", "1");
});

test("mobile artwork responds to a press before the motion bundle is ready", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "This fallback is specific to early touch input");
  await page.route("**/_astro/*.js", (route) => route.abort());
  await page.goto("/xiaoyugan/", { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: "摸一下蕾姆猫耳" });
  const approvedArtwork = page.locator(".xyg-rem-face");
  await button.scrollIntoViewIfNeeded();
  const initialTransform = await approvedArtwork.evaluate((element) => getComputedStyle(element).transform);
  const box = await button.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
  await page.mouse.down();
  await page.waitForTimeout(20);
  await expect.poll(() => approvedArtwork.evaluate((element) => getComputedStyle(element).transform)).not.toBe(initialTransform);
  await page.mouse.up();
  await expect.poll(() => approvedArtwork.evaluate((element) => getComputedStyle(element).transform)).toBe(initialTransform);
});

test("mobile artwork suppresses native image preview and save gestures", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "This regression exercises the mobile long-press path");
  await page.route("**/api/lab/pets**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        visitor: { label: "冰蓝小鱼 · HOLD", count: 2 },
        totalPets: 8,
        participantCount: 2,
        leaders: [],
      }),
    });
  });

  await page.goto("/xiaoyugan/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-own-count]").first()).toHaveText("2");
  const artwork = page.locator(".xyg-rem-face");
  await expect(artwork).toHaveCount(1);
  await expect(artwork).toHaveAttribute("draggable", "false");

  const nativeGestureState = await artwork.evaluate((element) => {
    const contextMenu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    const dragStart = new DragEvent("dragstart", { bubbles: true, cancelable: true });
    const selectStart = new Event("selectstart", { bubbles: true, cancelable: true });
    element.dispatchEvent(contextMenu);
    element.dispatchEvent(dragStart);
    element.dispatchEvent(selectStart);
    const styles = getComputedStyle(element);
    return {
      contextMenuPrevented: contextMenu.defaultPrevented,
      dragStartPrevented: dragStart.defaultPrevented,
      selectStartPrevented: selectStart.defaultPrevented,
      pointerEvents: styles.pointerEvents,
    };
  });

  expect(nativeGestureState.contextMenuPrevented).toBe(true);
  expect(nativeGestureState.dragStartPrevented).toBe(true);
  expect(nativeGestureState.selectStartPrevented).toBe(true);
  expect(nativeGestureState.pointerEvents).toBe("none");
  await expect(page.locator(".xyg-rem-face")).toHaveCount(1);
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
    await expect(page.locator("main > .lm-page, main > .playground").first()).toBeVisible();
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
  await page.goto("/tools/");
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
  await expect(page.locator('link[rel="icon"][sizes="512x512"]')).toHaveAttribute("href", "/brand/rem-cat-avatar-512-v6.png");
  await expect(page.locator('link[rel="icon"][sizes="any"]')).toHaveAttribute("href", "/favicon-rem-cat-transparent-v6.ico");
  await expect(page.locator('link[rel="shortcut icon"]')).toHaveAttribute("href", "/favicon-rem-cat-transparent-v6.ico");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/brand/rem-cat-avatar-180-v6.png");
  await expect(page.locator('link[rel="apple-touch-icon-precomposed"]')).toHaveCount(0);
  const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
  expect(structuredData).toContain("WebSite");
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const manifestResponse = await request.get(manifestHref!);
  expect(manifestResponse.ok()).toBe(true);
  expect(await manifestResponse.json()).toMatchObject({
    name: "小鱼",
    short_name: "小鱼",
    icons: expect.arrayContaining([
      expect.objectContaining({ src: "/brand/rem-cat-avatar-192-v6.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/brand/rem-cat-avatar-512-v6.png", sizes: "512x512" }),
      expect.objectContaining({ src: "/brand/rem-cat-avatar-maskable-512-v6.png", purpose: "maskable" }),
    ]),
  });
  expect((await request.get("/robots.txt")).ok()).toBe(true);
  expect((await request.get("/sitemap-index.xml")).ok()).toBe(true);
});
