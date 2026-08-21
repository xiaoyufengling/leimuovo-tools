(() => {
  const page = document.querySelector(".lm-page--home");
  if (!page) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const revealItems = [...page.querySelectorAll("[data-home-reveal]")];

  for (const item of revealItems) {
    const order = Number.parseInt(item.dataset.homeReveal || "0", 10);
    item.style.setProperty("--home-reveal-delay", `${Math.max(0, order) * 110}ms`);
  }

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -5% 0px",
    });

    revealItems.forEach((item) => observer.observe(item));
  }

  if (reducedMotion.matches || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const hero = page.querySelector("[data-home-hero]");
  const showcase = page.querySelector("[data-hero-shift]");
  if (!hero || !showcase) return;

  let frame = 0;
  let targetX = 0;
  let targetY = 0;

  const render = () => {
    frame = 0;
    showcase.style.setProperty("--hero-x", targetX.toFixed(2));
    showcase.style.setProperty("--hero-y", targetY.toFixed(2));
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(render);
  };

  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 10;
    targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 10;
    schedule();
  }, { passive: true });

  hero.addEventListener("pointerleave", () => {
    targetX = 0;
    targetY = 0;
    schedule();
  }, { passive: true });
})();
