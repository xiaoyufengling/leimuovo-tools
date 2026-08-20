(() => {
  const page = document.querySelector("[data-xiaoyugan]");
  if (!page) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const revealItems = [...page.querySelectorAll("[data-reveal]")];

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    revealItems.forEach((item) => observer.observe(item));
  }

  if (reducedMotion.matches) return;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let frame = 0;

  const render = () => {
    frame = 0;
    currentX += (targetX - currentX) * 0.075;
    currentY += (targetY - currentY) * 0.075;
    page.style.setProperty("--xyg-px", currentX.toFixed(4));
    page.style.setProperty("--xyg-py", currentY.toFixed(4));

    const hero = page.querySelector("[data-hero]");
    const stage = page.querySelector("[data-stage]");
    if (hero && stage) {
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height * 0.82, 1)));
      stage.style.opacity = String(1 - progress * 0.68);
      stage.style.transform = `translate3d(0, ${(-progress * 54).toFixed(2)}px, 0) scale(${(1 - progress * 0.045).toFixed(4)})`;
    }

    if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) schedule();
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(render);
  };

  if (finePointer.matches) {
    window.addEventListener("pointermove", (event) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      page.style.setProperty("--xyg-x", `${event.clientX}px`);
      page.style.setProperty("--xyg-y", `${event.clientY}px`);
      schedule();
    }, { passive: true });

    window.addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
      schedule();
    });

    for (const card of page.querySelectorAll("[data-tilt]")) {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.classList.add("is-active");
        card.style.setProperty("--tilt-x", `${(x * 8).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${(-y * 8).toFixed(2)}deg`);
      }, { passive: true });
      card.addEventListener("pointerleave", () => {
        card.classList.remove("is-active");
        card.style.removeProperty("--tilt-x");
        card.style.removeProperty("--tilt-y");
      });
    }
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  schedule();
})();
