(() => {
  const themeButtons = document.querySelectorAll("[data-theme-toggle]");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function resolvedTheme() {
    return document.documentElement.dataset.theme || (systemDark.matches ? "dark" : "light");
  }

  function syncThemeButtons() {
    const theme = resolvedTheme();
    document.querySelector("[data-theme-color]")?.setAttribute(
      "content",
      theme === "light" ? "#F7F7F8" : "#0B0B0D",
    );
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

  // A previous homepage release hid reveal content before its motion bundle
  // was ready. Recover cached copies on slow/mobile connections so a failed
  // animation can never leave the whole page transparent.
  const recoverHiddenHomepage = () => {
    const home = document.querySelector(".lm-page--home");
    const hero = home?.querySelector(".portfolio-hero__copy");
    if (!home || !hero) return;

    const heroStyle = window.getComputedStyle(hero);
    if (heroStyle.opacity !== "0" && heroStyle.visibility !== "hidden") return;

    home.classList.remove("is-motion-ready");
    delete home.dataset.motionReady;
    for (const item of home.querySelectorAll("[data-home-reveal]")) {
      item.classList.add("is-visible");
      item.style.removeProperty("opacity");
      item.style.removeProperty("visibility");
      item.style.removeProperty("transform");
      item.style.removeProperty("filter");
      item.style.removeProperty("will-change");
    }
  };
  window.setTimeout(recoverHiddenHomepage, 1_800);

  // Retire the old navigation cache that can keep serving the transparent
  // homepage when mobile data takes longer than the previous 3-second limit.
  if ("caches" in window) {
    Promise.all(["leimuovo-pages", "leimuovo-pages-v2"].map((cacheName) => window.caches.delete(cacheName))).catch(() => {
      // Cache cleanup is best-effort; the current service worker no longer reads these versions.
    });
  }

  const siteHeader = document.querySelector(".site-header");
  let headerFrame;
  const syncHeader = () => {
    headerFrame = undefined;
    siteHeader?.toggleAttribute("data-scrolled", window.scrollY > 18);
  };
  const requestHeaderSync = () => {
    if (headerFrame) return;
    headerFrame = window.requestAnimationFrame(syncHeader);
  };
  window.addEventListener("scroll", requestHeaderSync, { passive: true });
  syncHeader();

  const catEars = document.querySelector("[data-cat-ears]");
  if (catEars instanceof HTMLButtonElement) {
    let petTimer;
    catEars.dataset.catReady = "";

    catEars.addEventListener("pointermove", (event) => {
      const rect = catEars.getBoundingClientRect();
      const position = (event.clientX - rect.left) / rect.width;
      catEars.style.setProperty("--cat-look", String(Math.min(1, Math.max(-1, position * 2 - 1))));
    }, { passive: true });

    catEars.addEventListener("pointerleave", () => {
      catEars.style.setProperty("--cat-look", "0");
    }, { passive: true });

    catEars.addEventListener("click", () => {
      window.clearTimeout(petTimer);
      catEars.classList.remove("is-petted");
      void catEars.offsetWidth;
      catEars.classList.add("is-petted");
      catEars.setAttribute("aria-pressed", "true");
      petTimer = window.setTimeout(() => {
        catEars.classList.remove("is-petted");
        catEars.setAttribute("aria-pressed", "false");
      }, 1_800);
    });
  }

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

  const controlGesture = document.querySelector("[data-control-gesture]");
  if (controlGesture instanceof HTMLAnchorElement) {
    let gestureClicks = 0;
    let gestureTimer;

    const openPrivacyPage = () => {
      gestureClicks = 0;
      window.location.assign(controlGesture.href);
    };

    controlGesture.addEventListener("click", (event) => {
      const isPlainPointerClick = event.button === 0
        && event.detail > 0
        && !event.altKey
        && !event.ctrlKey
        && !event.metaKey
        && !event.shiftKey;
      if (!isPlainPointerClick) return;

      event.preventDefault();
      gestureClicks += 1;
      window.clearTimeout(gestureTimer);

      if (gestureClicks >= 5) {
        gestureClicks = 0;
        window.location.assign("/control/");
        return;
      }

      gestureTimer = window.setTimeout(openPrivacyPage, gestureClicks === 1 ? 500 : 1_200);
    });
  }

})();
