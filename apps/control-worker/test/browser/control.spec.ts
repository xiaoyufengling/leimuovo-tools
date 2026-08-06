import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://api4.ipify.org/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("https://api6.ipify.org/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
});

test("owner can sign in and see the quiet status dashboard", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && !request.url().includes("/api/control/login")) posts.push(request.url());
  });

  await page.goto("/control/");
  await expect(page.getByRole("heading", { level: 1, name: "小鱼控制中心" })).toBeVisible();
  await page.getByLabel("用户名").fill("local-owner");
  await page.getByLabel("密码", { exact: true }).fill("local-preview-password");
  await page.getByRole("button", { name: "进入控制中心" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "现在，一目了然。" })).toBeVisible();
  await expect(page.locator('[data-status-card="ipv4"]')).toHaveAttribute("data-state", "up");
  await expect(page.locator('[data-status-card="ipv6"]')).toHaveAttribute("data-state", "up");
  await expect(page.getByText("当前状态平稳")).toBeVisible();
  await expect(page.locator("canvas, [role=img][aria-label*=图表]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  for (const button of await page.locator(".control-header button").all()) {
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect(posts).toEqual([]);
});

test("theme choice persists and reduced motion disables decorative animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/control/");
  const toggle = page.getByRole("button", { name: /切换为.*外观/ });
  await toggle.click();
  const selected = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", selected ?? "dark");
  await expect(page.locator(".lm-skeleton").first()).toHaveCSS("animation-name", "none");
});

test("control center consumes shared form, card and feedback primitives", async ({ page }) => {
  await page.goto("/control/");
  await expect(page.locator(".login-card")).toHaveClass(/lm-card/);
  await expect(page.locator(".form-field").first()).toHaveClass(/lm-field/);
  await expect(page.locator("[data-login-error]")).toHaveClass(/lm-field-error/);
  await expect(page.locator("[data-loading-view] .lm-skeleton")).toHaveCount(4);
});
