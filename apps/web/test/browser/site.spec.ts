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

test("mobile homepage is readable on first paint without waiting for interaction or recovery", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "This regression is specific to the touch/mobile media-query branch");

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const heroCopy = page.locator(".portfolio-hero__copy");
  const firstPaint = await heroCopy.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      opacity: Number(style.opacity),
      visibility: style.visibility,
      filter: style.filter,
      motionReady: document.querySelector(".lm-page--home")?.classList.contains("is-motion-ready") ?? false,
    };
  });

  expect(firstPaint.visibility).not.toBe("hidden");
  expect(firstPaint.opacity).toBeGreaterThanOrEqual(0.95);
  expect(["none", "blur(0px)"]).toContain(firstPaint.filter);
});

test("returning from the laboratory does not replay the homepage entrance", async ({ page }) => {
  await page.goto("/");
  await page.goto("/xiaoyugan/");
  await page.locator(".xyg-back").click();
  await expect(page).toHaveURL(/\/$/);

  const heroCopy = page.locator(".portfolio-hero__copy");
  await expect(heroCopy).toBeVisible();
  await expect(heroCopy).toHaveCSS("opacity", "1");
  await expect(heroCopy).toHaveCSS("transform", "none");
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
  await page.goto("/");
  await expect(page.locator(".brand-link .brand-mark")).toHaveAttribute("src", "/icons/rem-cat-brand-96.png");
  const labEntry = page.locator(".lab-feature__link");
  await labEntry.scrollIntoViewIfNeeded();
  await expect(labEntry).toBeVisible();
  await expect(labEntry).toHaveAttribute("href", "/xiaoyugan/");
  await page.goto("/xiaoyugan/");

  await expect(page).toHaveURL(/\/xiaoyugan\/$/);
  await expect(page).toHaveTitle("小鱼干｜蕾姆触摸实验室");
  await expect(page.getByRole("heading", { level: 1, name: /先摸一下.*再认识这个界面/ })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator("[data-pet-card]")).toBeVisible();
  await expect(page.locator(".xyg-brand__mark")).toHaveAttribute("src", "/icons/rem-cat-brand-96.png");
  await expect(page.locator(".xyg-rem-face")).toBeVisible();
  await expect(page.locator(".xyg-rem-face")).toHaveAttribute("src", "/images/xiaoyugan-rem-face.png");
  await expect(page.locator("[data-rem-artwork]")).toHaveCount(1);
  await expect(page.locator("[data-rem-parts], [data-rem-base], [data-rem-ear]")).toHaveCount(0);
  const petButton = page.getByRole("button", { name: "摸一下蕾姆猫耳" });
  await expect(petButton).toBeVisible();
  await expect(page.locator("[data-own-count]").first()).toHaveText("3");
  await petButton.dispatchEvent("pointerdown", { clientX: 220, clientY: 180, pointerId: 1, pointerType: "mouse" });
  await expect(petButton).toHaveClass(/is-pet-active/);
  await petButton.click();
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
  expect(pressedFrame.approvedSource).toBe("/images/xiaoyugan-rem-face.png");
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
  await expect(page.locator('link[rel="icon"][sizes="512x512"]')).toHaveAttribute("href", "/icons/rem-cat-icon-512.png?v=safari-favorite-20260824");
  await expect(page.locator('link[rel="icon"][sizes="any"]')).toHaveAttribute("href", "/favicon.ico?v=rem-cat-20260824");
  await expect(page.locator('link[rel="icon"][sizes="180x180"]')).toHaveAttribute("href", "/safari-favorite-rem-cat-20260824.png");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/apple-touch-icon-rem-cat-20260824.png");
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
      expect.objectContaining({ src: "/icons/rem-cat-icon-192.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/icons/rem-cat-icon-512.png", sizes: "512x512" }),
      expect.objectContaining({ src: "/icons/rem-cat-icon-maskable-512.png", purpose: "maskable" }),
    ]),
  });
  expect((await request.get("/robots.txt")).ok()).toBe(true);
  expect((await request.get("/sitemap-index.xml")).ok()).toBe(true);
});
