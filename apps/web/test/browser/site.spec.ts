import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const consoleRoot = "[data-rem-experience]";
const dashboard = ".console-dashboard";

async function expectConsoleReady(page: Page) {
  await expect(page.locator(consoleRoot)).toHaveAttribute("data-ready", "true");
}

async function enterConsole(page: Page) {
  await expectConsoleReady(page);
  await page.locator("button[data-skip-intro]").click();
  await expect(page.locator(dashboard)).toHaveClass(/is-interactive/);
}

async function consoleProgress(page: Page) {
  return page.locator("[data-story-progress]").evaluate((element) =>
    Number(getComputedStyle(element).getPropertyValue("--story-progress")),
  );
}

async function scrollConsole(page: Page, fraction: number) {
  const target = await page.locator("[data-console-runway]").evaluate((element, progress) => {
    const rect = element.getBoundingClientRect();
    const distance = rect.height - innerHeight;
    if (distance <= 0) throw new Error("The motion runway must be taller than the viewport");
    const y = Math.round(scrollY + rect.top + distance * progress);
    scrollTo(0, y);
    return y;
  }, fraction);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(target, 0);
  await expect.poll(async () => Math.abs(await consoleProgress(page) - fraction)).toBeLessThan(0.01);
}

async function assemblyState(page: Page) {
  return page.locator(".assembly-piece").evaluateAll((elements) => elements.map((element) => ({
    piece: element.getAttribute("data-assembly"),
    transform: getComputedStyle(element).transform,
    opacity: Number(getComputedStyle(element).opacity),
  })));
}

async function historyMinutes(page: Page, machine: string) {
  return page.locator(`[data-machine-row="${machine}"] [data-cell="history"] svg`).evaluate((svg) => ({
    duration: Number(svg.getAttribute("viewBox")?.split(/\s+/)[2]),
    sum: [...svg.querySelectorAll("rect")].reduce((sum, segment) => sum + Number(segment.getAttribute("width")), 0),
    segments: svg.querySelectorAll("rect").length,
  }));
}

test("Rem console starts with a black monitor and twelve real data rows", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Rem.*Production console.*小鱼/);
  await expectConsoleReady(page);
  await expect(page.locator("html")).toHaveClass(/rem-motion/);
  await expect(page.locator(".monitor-power")).toHaveCSS("opacity", "0");
  expect(await consoleProgress(page)).toBe(0);
  expect((await assemblyState(page)).every((piece) => piece.opacity === 0)).toBe(true);
  const blackLevel = await page.locator("[data-monitor-screen]").evaluate((element) =>
    getComputedStyle(element).backgroundColor.match(/\d+/g)?.slice(0, 3).map(Number),
  );
  expect(blackLevel).toHaveLength(3);
  expect(blackLevel?.every((channel) => channel <= 24)).toBe(true);
  await expect(page.locator("[data-machine-row]")).toHaveCount(12);
  await expect(page.locator('[data-machine-row][data-kind="cnc"]')).toHaveCount(6);
  await expect(page.locator('[data-machine-row][data-kind="print"]')).toHaveCount(6);
  await expect(page.locator('[data-production-chart="cnc"] [data-chart-total]')).toHaveText("840");
  await expect(page.locator('[data-production-chart="print"] [data-chart-total]')).toHaveText("369,600");
  await expect(page.locator("[data-sculpture], [data-liquid-canvas], [data-material], [data-shape-control], .pg-hero-copy")).toHaveCount(0);
  await expect(page.locator('a[href="/xiaoyugan/"], .service-card, .price-card')).toHaveCount(0);
  const giantCircles = await page.locator(consoleRoot).evaluate((root) => [...root.querySelectorAll("*")].filter((element) => {
    const box = element.getBoundingClientRect();
    const radius = getComputedStyle(element).borderTopLeftRadius;
    const radiusPx = parseFloat(radius) * (radius.includes("%") ? box.width / 100 : 1);
    return box.width > Math.min(innerWidth, innerHeight) * 0.45
      && box.height > box.width * 0.8 && box.height < box.width * 1.2
      && radiusPx >= Math.min(box.width, box.height) * 0.45;
  }).length);
  expect(giantCircles).toBe(0);
});

test("native scroll assembles distinct reversible frames at 0, 45, and 100 percent", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expectConsoleReady(page);
  await scrollConsole(page, 0);
  const start = await assemblyState(page);
  const before = await page.screenshot();
  await testInfo.attach("console-before-black-boot", { body: before, contentType: "image/png" });

  await scrollConsole(page, 0.45);
  const middle = await assemblyState(page);
  expect(middle.some((piece) => piece.opacity > 0.01)).toBe(true);
  await expect(page.locator(dashboard)).not.toHaveClass(/is-interactive/);
  const midway = await page.screenshot();
  await testInfo.attach("console-midway-assembly", { body: midway, contentType: "image/png" });

  await scrollConsole(page, 1);
  const end = await assemblyState(page);
  expect(end.every((piece) => piece.opacity >= 0.99)).toBe(true);
  expect(middle.some((piece, index) => piece.transform !== end[index]?.transform)).toBe(true);
  await expect(page.locator(dashboard)).toHaveClass(/is-interactive/);
  const after = await page.screenshot();
  await testInfo.attach("console-after-ready", { body: after, contentType: "image/png" });
  expect(before.equals(midway)).toBe(false);
  expect(midway.equals(after)).toBe(false);

  await scrollConsole(page, 0.45);
  expect(await assemblyState(page)).toEqual(middle);
  await scrollConsole(page, 0);
  expect(await assemblyState(page)).toEqual(start);
  await expect(page.locator(dashboard)).not.toHaveClass(/is-interactive/);
  await expect(page.locator(".monitor-power")).toHaveCSS("opacity", "0");
});

test("skip intro lands on a working production console", async ({ page }) => {
  await page.goto("/");
  await enterConsole(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Production overview");
  await expect(page.locator(".monitor-power")).toHaveCSS("opacity", "1");
  expect(await consoleProgress(page)).toBeGreaterThanOrEqual(0.885);
  await page.locator('[data-chart-kind="cnc"][data-chart-period="week"]').click();
  await expect(page.locator('[data-production-chart="cnc"] [data-chart-total]')).toHaveText("4,200");
});

test("CNC and Print periods independently update matching rows and conserve history minutes", async ({ page }) => {
  await page.goto("/");
  await enterConsole(page);
  await page.locator('[data-chart-kind="cnc"][data-chart-period="week"]').click();
  await expect(page.locator('[data-chart-kind="cnc"][data-chart-period="week"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-chart-kind="print"][data-chart-period="day"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-production-chart="cnc"] [data-chart-total]')).toHaveText("4,200");
  await expect(page.locator('[data-production-chart="print"] [data-chart-total]')).toHaveText("369,600");
  await expect(page.locator('[data-machine-row="cnc-01"] [data-cell="output"]')).toHaveText("720 pcs");
  await expect(page.locator('[data-machine-row="print-01"] [data-cell="output"]')).toHaveText("84,000 sheets");
  for (let index = 1; index <= 6; index += 1) {
    const suffix = String(index).padStart(2, "0");
    expect(await historyMinutes(page, `cnc-${suffix}`)).toEqual({ duration: 2400, sum: 2400, segments: 4 });
    expect(await historyMinutes(page, `print-${suffix}`)).toEqual({ duration: 480, sum: 480, segments: 4 });
  }
  await page.locator('[data-chart-kind="print"][data-chart-period="month"]').click();
  await expect(page.locator('[data-production-chart="print"]')).toHaveAttribute("data-total", "7392000");
  await expect(page.locator('[data-production-chart="print"] [data-chart-total]')).toHaveAttribute("title", "7,392,000");
  await expect(page.locator('[data-production-chart="cnc"] [data-chart-total]')).toHaveText("4,200");
  expect(await historyMinutes(page, "print-01")).toEqual({ duration: 9600, sum: 9600, segments: 4 });
  expect(await historyMinutes(page, "cnc-01")).toEqual({ duration: 2400, sum: 2400, segments: 4 });
});

test("machine details use a native modal and return focus after close and Escape", async ({ page }) => {
  await page.goto("/");
  await enterConsole(page);
  const trigger = page.locator('[data-machine-row="cnc-01"] [data-machine-open="cnc-01"]');
  const dialog = page.locator("dialog[data-machine-dialog]");
  // Give the native dialog a keyboard-focused return target on Safari too.
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
  await expect(dialog.locator("[data-detail-title]")).toHaveText("CNC-01");
  await expect(dialog.locator("[data-detail-kind]")).toContainText("WO-101");
  await dialog.locator("[data-detail-close]").first().click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator(dashboard)).toHaveClass(/is-interactive/);
});

test("period and machine selections survive repeated filters and reverse replay", async ({ page }) => {
  await page.goto("/");
  await enterConsole(page);
  await page.locator('[data-chart-kind="cnc"][data-chart-period="week"]').click();
  await page.locator('[data-console-view="machines"]').click();
  for (const kind of ["cnc", "print", "all", "print", "all", "cnc"]) {
    await page.locator(`[data-kind-filter="${kind}"]`).click();
    await expect(page.locator(`[data-kind-filter="${kind}"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-machine-row]:visible")).toHaveCount(kind === "all" ? 12 : 6);
    if (kind !== "all") {
      await expect(page.locator(`[data-machine-row]:visible:not([data-kind="${kind}"])`)).toHaveCount(0);
    }
  }
  // The same visible control becomes the replay button once the scene is ready.
  await page.locator("button[data-skip-intro]").click();
  await expect.poll(() => consoleProgress(page)).toBe(0);
  await expect(page.locator(dashboard)).not.toHaveClass(/is-interactive/);
  await scrollConsole(page, 0.45);
  await scrollConsole(page, 1);
  await expect(page.locator(dashboard)).toHaveClass(/is-interactive/);
  await expect(page.locator('[data-console-view="machines"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-kind-filter="cnc"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-machine-row]:visible")).toHaveCount(6);
  await page.locator('[data-console-view="overview"]').click();
  await expect(page.locator('[data-chart-kind="cnc"][data-chart-period="week"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-chart-kind="print"][data-chart-period="day"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-production-chart="cnc"] [data-chart-total]')).toHaveText("4,200");
  await expect(page.locator('[data-production-chart="print"] [data-chart-total]')).toHaveText("369,600");
  await page.locator('[data-chart-kind="cnc"][data-chart-period="day"]').click();
  await expect(page.locator('[data-production-chart="cnc"] [data-chart-total]')).toHaveText("840");
});

test("search hides during black replay and preserves its query after reassembly", async ({ page }) => {
  await page.goto("/");
  await enterConsole(page);
  const toggle = page.locator("[data-search-toggle]");
  const panel = page.locator("[data-search-panel]");
  const input = page.locator("[data-machine-search]");
  await toggle.click();
  await expect(input).toBeFocused();
  // Fill the input the app already focused; refocusing or scrolling it into
  // view can move the native sticky scene away from its ready position.
  await input.fill("CNC-05");
  await expect(page.locator("[data-machine-row]:visible")).toHaveCount(1);
  await expect(page.locator("[data-machine-row]:visible")).toHaveAttribute("data-machine-row", "cnc-05");

  await page.locator("button[data-skip-intro]").click();
  await expect.poll(() => consoleProgress(page)).toBe(0);
  await expect(page.locator(".monitor-power")).toHaveCSS("opacity", "0");
  await expect(page.locator(dashboard)).not.toHaveClass(/is-interactive/);
  await expect(panel).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(input).toHaveValue("CNC-05");

  await scrollConsole(page, 0.45);
  await expect(panel).toBeHidden();
  await scrollConsole(page, 1);
  await expect(page.locator(dashboard)).toHaveClass(/is-interactive/);
  await expect(panel).toBeHidden();
  await expect(input).toHaveValue("CNC-05");
  await expect(page.locator("[data-machine-row]:visible")).toHaveCount(1);
  await expect(page.locator("[data-machine-row]:visible")).toHaveAttribute("data-machine-row", "cnc-05");

  await toggle.click();
  await expect(input).toBeFocused();
  await input.fill("");
  await expect(page.locator("[data-machine-row]:visible")).toHaveCount(12);
  await expect(page.locator(dashboard)).toHaveClass(/is-interactive/);
  await page.locator("[data-search-close]").click();
  await expect(panel).toBeHidden();
  await expect(input).toHaveValue("");
});

test("compact desktop monitor fits all twelve rows and the Now column without table scrolling", async ({ page, isMobile }) => {
  test.skip(isMobile, "The desktop fit contract excludes intentional mobile and tablet table overflow");
  await page.setViewportSize({ width: 1180, height: 757 });
  await page.goto("/");
  await enterConsole(page);
  await expect(page.locator("[data-machine-row]:visible")).toHaveCount(12);
  const geometry = await page.locator(".machine-table-scroll").evaluate((element) => {
    const box = element.getBoundingClientRect();
    const bounds = {
      left: box.left + element.clientLeft,
      right: box.left + element.clientLeft + element.clientWidth,
      top: box.top + element.clientTop,
      bottom: box.top + element.clientTop + element.clientHeight,
    };
    const rows = [...element.querySelectorAll<HTMLElement>("[data-machine-row]")].map((row) => {
      const rect = row.getBoundingClientRect();
      const now = row.querySelector<HTMLElement>('[role="cell"]:last-child')!;
      const state = now.querySelector<HTMLElement>(".machine-state")!;
      return {
        id: row.dataset.machineRow,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        height: rect.height,
        nowRight: now.getBoundingClientRect().right,
        stateRight: state.getBoundingClientRect().right,
      };
    });
    const nowHeader = element.querySelector<HTMLElement>('.machine-table-head [role="columnheader"]:last-child')!;
    return {
      bounds,
      rows,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      nowHeaderRight: nowHeader.getBoundingClientRect().right,
    };
  });
  expect(geometry.scrollLeft).toBe(0);
  expect(geometry.scrollTop).toBe(0);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 2);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 2);
  expect(geometry.rows).toHaveLength(12);
  expect(geometry.rows.at(-1)?.id).toBe("print-06");
  expect(geometry.nowHeaderRight).toBeLessThanOrEqual(geometry.bounds.right + 2);
  for (const row of geometry.rows) {
    expect(row.height, `${row.id} has a rendered row`).toBeGreaterThan(1);
    expect(row.top, `${row.id} top`).toBeGreaterThanOrEqual(geometry.bounds.top - 2);
    expect(row.bottom, `${row.id} bottom`).toBeLessThanOrEqual(geometry.bounds.bottom + 2);
    expect(row.left, `${row.id} left`).toBeGreaterThanOrEqual(geometry.bounds.left - 2);
    expect(row.right, `${row.id} right`).toBeLessThanOrEqual(geometry.bounds.right + 2);
    expect(row.nowRight, `${row.id} Now cell`).toBeLessThanOrEqual(geometry.bounds.right + 2);
    expect(row.stateRight, `${row.id} state label`).toBeLessThanOrEqual(geometry.bounds.right + 2);
  }
});

test("desktop wheel input scrolls naturally in both directions without snapping", async ({ page, isMobile }) => {
  test.skip(isMobile, "Mobile WebKit does not support mouse.wheel; programmatic native scrolling is covered separately");
  await page.goto("/");
  await expectConsoleReady(page);
  await page.mouse.move(15, 250);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect.poll(() => consoleProgress(page)).toBeGreaterThan(0);
  await page.mouse.wheel(0, -2000);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  await expect.poll(() => consoleProgress(page)).toBeLessThan(0.01);
  const scrolling = await page.evaluate(() => ({
    behavior: getComputedStyle(document.documentElement).scrollBehavior,
    snap: getComputedStyle(document.documentElement).scrollSnapType,
  }));
  expect(scrolling).toEqual({ behavior: "auto", snap: "none" });
  await enterConsole(page);
  const tableBox = await page.locator(".machine-table-scroll").boundingBox();
  expect(tableBox).not.toBeNull();
  const beforeTableWheel = await page.evaluate(() => scrollY);
  await page.mouse.move(tableBox!.x + tableBox!.width * 0.5, tableBox!.y + tableBox!.height * 0.4);
  await page.mouse.wheel(0, -500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(beforeTableWheel - 100);
});

test("mobile native scrolling keeps page width fixed and the data table scrolls internally", async ({ page, isMobile }) => {
  test.skip(!isMobile, "This checks narrow touch-device layouts, including tablet WebKit");
  await page.goto("/");
  await expectConsoleReady(page);
  for (const progress of [0, 0.45, 1]) {
    await scrollConsole(page, progress);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  const table = page.locator(".machine-table-scroll");
  const overflow = await table.evaluate((element) => ({
    internal: element.scrollWidth > element.clientWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(overflow.internal).toBe(true);
  expect(["auto", "scroll"]).toContain(overflow.overflowX);
  await table.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollX)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await scrollConsole(page, 0);
  await expect(page.locator(".monitor-power")).toHaveCSS("opacity", "0");
});

test("reduced motion opens a ready console immediately and keeps period controls working", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expectConsoleReady(page);
  await expect(page.locator("html")).not.toHaveClass(/rem-motion/);
  await expect(page.locator(dashboard)).toHaveClass(/is-interactive/);
  await expect(page.locator(".monitor-power")).toHaveCSS("opacity", "1");
  expect((await assemblyState(page)).every((piece) => piece.opacity === 1 && piece.transform === "none")).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.locator('[data-chart-kind="cnc"][data-chart-period="week"]').click();
  await expect(page.locator('[data-production-chart="cnc"] [data-chart-total]')).toHaveText("4,200");
  await page.locator('[data-chart-kind="cnc"][data-chart-period="day"]').click();
  await expect(page.locator('[data-production-chart="cnc"] [data-chart-total]')).toHaveText("840");
});

test("failed motion bundle reveals complete SSR production data after its safety timeout", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/_astro/*.js", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveClass(/rem-motion/);
  await expect(page.locator(".monitor-power")).toHaveCSS("opacity", "0");
  await expect(page.locator(consoleRoot)).toHaveAttribute("data-fallback", "true", { timeout: 7000 });
  await expect(page.locator("html")).not.toHaveClass(/rem-motion/);
  await expect(page.locator(".monitor-power")).toHaveCSS("opacity", "1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Production overview");
  await expect(page.locator("[data-machine-row]")).toHaveCount(12);
  await expect(page.locator('[data-production-chart="cnc"] [data-chart-total]')).toHaveText("840");
  await expect(page.locator('[data-production-chart="print"] [data-chart-total]')).toHaveText("369,600");
  await expect(page.locator('[data-machine-row="cnc-01"] [data-cell="output"]')).toHaveText("144 pcs");
  expect(await historyMinutes(page, "cnc-01")).toEqual({ duration: 480, sum: 480, segments: 4 });
  expect((await assemblyState(page)).every((piece) => piece.opacity === 1)).toBe(true);
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
    if (pathname === "/") await enterConsole(page);
    await expect(page.locator("main > .lm-page, main > .rem-experience").first()).toBeVisible();
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
  await expectConsoleReady(page);
  await page.locator("[data-site-menu-toggle]").click();
  await expect(page.getByRole("link", { name: "控制中心" })).toHaveCount(0);

  await context.addCookies([{
    name: "control_hint",
    value: "1",
    domain: "127.0.0.1",
    path: "/",
    sameSite: "Strict",
  }]);
  await page.reload();
  await expectConsoleReady(page);
  await page.locator("[data-site-menu-toggle]").click();
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
