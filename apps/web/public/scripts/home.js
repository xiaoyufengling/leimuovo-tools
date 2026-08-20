(() => {
  const page = document.querySelector(".lm-page--home");
  if (!page) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const revealItems = [...page.querySelectorAll("[data-reveal]")];

  for (const item of revealItems) {
    const order = Number.parseInt(item.dataset.reveal || "0", 10);
    item.style.setProperty("--reveal-delay", `${Math.max(0, order) * 90}ms`);
  }

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -6% 0px",
    });

    revealItems.forEach((item) => revealObserver.observe(item));
  }

  if (reducedMotion.matches) return;

  const hero = page.querySelector("[data-home-hero]");
  const heroCopy = page.querySelector("[data-hero-copy]");
  const heroVisual = page.querySelector("[data-hero-visual]");
  const scrollHint = page.querySelector("[data-scroll-hint]");
  const story = page.querySelector("[data-scroll-story]");
  const storyScene = page.querySelector("[data-story-scene]");
  const storySteps = [...page.querySelectorAll("[data-story-step]")];
  const storyCards = [
    page.querySelector('[data-story-card="source"]'),
    page.querySelector('[data-story-card="process"]'),
    page.querySelector('[data-story-card="result"]'),
  ];
  const parallaxItems = [...page.querySelectorAll("[data-parallax]")];
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const range = (value, start, end) => clamp((value - start) / (end - start));
  const smoothstep = (value) => value * value * (3 - 2 * value);
  const anchors = [0, 0.5, 1];
  let frame = 0;

  const render = () => {
    frame = 0;
    const viewportHeight = window.innerHeight;

    if (hero && heroCopy && heroVisual) {
      const rect = hero.getBoundingClientRect();
      const progress = smoothstep(clamp(-rect.top / Math.max(rect.height * 0.72, 1)));
      heroCopy.style.transform = `translate3d(0, ${(-progress * 32).toFixed(2)}px, 0)`;
      heroCopy.style.opacity = String(1 - progress * 0.42);
      heroVisual.style.transform = `translate3d(0, ${(-progress * 52).toFixed(2)}px, 0) scale(${(1 - progress * 0.035).toFixed(4)})`;
      heroVisual.style.opacity = String(1 - progress * 0.55);
      if (scrollHint) scrollHint.style.opacity = String(1 - range(progress, 0.02, 0.22));
    }

    if (story && storyScene && window.innerWidth >= 1024) {
      const rect = story.getBoundingClientRect();
      const headerHeight = document.querySelector(".site-header")?.offsetHeight || 0;
      const travel = Math.max(rect.height - (viewportHeight - headerHeight), 1);
      const progress = smoothstep(clamp((headerHeight - rect.top) / travel));
      storyScene.style.setProperty("--story-progress", progress.toFixed(4));
      storyScene.style.setProperty("--scan-progress", String(0.15 + range(progress, 0.18, 0.68) * 0.85));

      const stepEmphasis = [
        1 - smoothstep(range(progress, 0.18, 0.32)),
        smoothstep(range(progress, 0.26, 0.38)) * (1 - smoothstep(range(progress, 0.62, 0.74))),
        smoothstep(range(progress, 0.68, 0.82)),
      ];
      storySteps.forEach((step, index) => {
        step.style.setProperty("--step-opacity", stepEmphasis[index].toFixed(4));
        step.style.setProperty("--step-y", `${((anchors[index] - progress) * 30).toFixed(2)}px`);
      });

      storyCards.forEach((card, index) => {
        if (!card) return;
        const distance = Math.abs(progress - anchors[index]);
        const emphasis = clamp(1 - distance * 2);
        card.style.setProperty("--card-opacity", String(0.2 + emphasis * 0.8));
        card.style.setProperty("--card-scale", String(0.94 + emphasis * 0.06));
        card.style.setProperty("--card-y", `${((anchors[index] - progress) * 30).toFixed(2)}px`);
      });
    }

    for (const item of parallaxItems) {
      const parent = item.parentElement;
      if (!parent) continue;
      const rect = parent.getBoundingClientRect();
      if (rect.bottom < -80 || rect.top > viewportHeight + 80) continue;
      const distanceFromCenter = (rect.top + rect.height / 2 - viewportHeight / 2) / viewportHeight;
      const amplitude = Number.parseFloat(item.dataset.parallax || "16");
      item.style.transform = `translate3d(0, ${(-distanceFromCenter * amplitude).toFixed(2)}px, 0)`;
    }
  };

  const scheduleRender = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(render);
  };

  window.addEventListener("scroll", scheduleRender, { passive: true });
  window.addEventListener("resize", scheduleRender, { passive: true });
  window.addEventListener("orientationchange", scheduleRender, { passive: true });
  document.fonts?.ready.then(scheduleRender);
  scheduleRender();
})();
