(() => {
  const themeButtons = document.querySelectorAll("[data-theme-toggle]");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function resolvedTheme() {
    return document.documentElement.dataset.theme || (systemDark.matches ? "dark" : "light");
  }

  function syncThemeButtons() {
    const theme = resolvedTheme();
    for (const button of themeButtons) {
      const next = theme === "dark" ? "浅色" : "深色";
      button.setAttribute("aria-label", `切换为${next}外观`);
      button.setAttribute("title", `切换为${next}外观`);
    }
  }

  for (const button of themeButtons) {
    button.addEventListener("click", () => {
      const next = resolvedTheme() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        window.localStorage.setItem("leimuovo-theme", next);
      } catch {
        // Theme still works for this session.
      }
      syncThemeButtons();
    });
  }

  systemDark.addEventListener?.("change", syncThemeButtons);
  syncThemeButtons();

  const hasControlHint = document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === "control_hint=1");
  const siteNav = document.querySelector(".site-nav");
  const themeToggle = siteNav?.querySelector("[data-theme-toggle]");
  if (hasControlHint && siteNav && !siteNav.querySelector("[data-control-entry]")) {
    const controlEntry = document.createElement("a");
    controlEntry.href = "/control/";
    controlEntry.textContent = "控制中心";
    controlEntry.dataset.controlEntry = "";
    siteNav.insertBefore(controlEntry, themeToggle ?? null);
  }

  let installPrompt;
  const installButton = document.querySelector("[data-pwa-install]");
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    if (installButton) installButton.hidden = false;
  });
  installButton?.addEventListener("click", async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    installPrompt = undefined;
    installButton.hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = undefined;
    if (installButton) installButton.hidden = true;
  });
})();
