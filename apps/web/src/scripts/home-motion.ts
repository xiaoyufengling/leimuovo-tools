import { gsap } from "gsap";

const page = document.querySelector<HTMLElement>(".lm-page--home");

if (page && page.dataset.motionReady !== "true") {
  const revealItems = gsap.utils.toArray<HTMLElement>("[data-home-reveal]", page);
  const revealWithoutMotion = () => {
    page.classList.remove("is-motion-ready");
    delete page.dataset.motionReady;
    revealItems.forEach((item) => {
      item.classList.add("is-visible");
      item.style.removeProperty("opacity");
      item.style.removeProperty("visibility");
      item.style.removeProperty("transform");
      item.style.removeProperty("filter");
      item.style.removeProperty("will-change");
    });
  };

  try {
    page.dataset.motionReady = "true";
    page.classList.add("is-motion-ready");

    const media = gsap.matchMedia();

    media.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
        finePointer: "(hover: hover) and (pointer: fine)",
        desktop: "(min-width: 48rem)",
      },
      (context) => {
      const { reduceMotion, finePointer, desktop } = context.conditions as {
        reduceMotion: boolean;
        finePointer: boolean;
        desktop: boolean;
      };
      const cleanups: Array<() => void> = [];

      if (reduceMotion) {
        revealItems.forEach((item) => item.classList.add("is-visible"));
        gsap.set(revealItems, { autoAlpha: 1, clearProps: "transform,filter" });
        return;
      }

      revealItems.forEach((item) => item.classList.remove("is-visible"));
      gsap.set(revealItems, {
        autoAlpha: 0,
        y: 28,
        scale: 0.985,
        filter: "blur(5px)",
        transformOrigin: "50% 42%",
      });

      const reveal = (item: HTMLElement) => {
        if (item.classList.contains("is-visible")) return;
        const order = Number.parseInt(item.dataset.homeReveal || "0", 10);
        item.classList.add("is-visible");
        item.style.willChange = "transform, opacity, filter";
        gsap.to(item, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.92,
          delay: Math.max(0, order) * 0.075,
          ease: "power3.out",
          overwrite: "auto",
          onComplete: () => {
            item.style.willChange = "";
            gsap.set(item, { clearProps: "transform,opacity,visibility,filter" });
          },
        });
      };

      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              reveal(entry.target as HTMLElement);
              observer.unobserve(entry.target);
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
        );
        revealItems.forEach((item) => observer.observe(item));
        cleanups.push(() => observer.disconnect());
      } else {
        revealItems.forEach(reveal);
      }

      if (finePointer && desktop) {
        const atmosphere = page.querySelector<HTMLElement>(".home-atmosphere");
        const aura = document.createElement("span");
        aura.className = "home-pointer-aura";
        atmosphere?.append(aura);

        const auraX = gsap.quickTo(aura, "x", { duration: 0.7, ease: "power3.out" });
        const auraY = gsap.quickTo(aura, "y", { duration: 0.7, ease: "power3.out" });
        let auraVisible = false;
        const moveAura = (event: PointerEvent) => {
          auraX(event.clientX);
          auraY(event.clientY);
          if (!auraVisible) {
            auraVisible = true;
            gsap.to(aura, { autoAlpha: 0.58, duration: 0.35, overwrite: "auto" });
          }
        };
        const hideAura = () => {
          auraVisible = false;
          gsap.to(aura, { autoAlpha: 0, duration: 0.5, overwrite: "auto" });
        };
        page.addEventListener("pointermove", moveAura, { passive: true });
        page.addEventListener("pointerleave", hideAura, { passive: true });
        cleanups.push(() => {
          page.removeEventListener("pointermove", moveAura);
          page.removeEventListener("pointerleave", hideAura);
          aura.remove();
        });

        const cards = gsap.utils.toArray<HTMLElement>(".studio-card", page);
        cards.forEach((card) => {
          const glow = document.createElement("span");
          glow.className = "studio-card__glow";
          card.prepend(glow);

          const glowX = gsap.quickTo(glow, "x", { duration: 0.42, ease: "power3.out" });
          const glowY = gsap.quickTo(glow, "y", { duration: 0.42, ease: "power3.out" });
          const onMove = (event: PointerEvent) => {
            const rect = card.getBoundingClientRect();
            glowX(event.clientX - rect.left);
            glowY(event.clientY - rect.top);
          };
          const onEnter = (event: PointerEvent) => {
            onMove(event);
            gsap.to(glow, { autoAlpha: 0.72, duration: 0.22, ease: "power1.out", overwrite: "auto" });
          };
          const onLeave = () => {
            gsap.to(glow, { autoAlpha: 0, duration: 0.36, ease: "power1.out", overwrite: "auto" });
          };
          card.addEventListener("pointermove", onMove, { passive: true });
          card.addEventListener("pointerenter", onEnter, { passive: true });
          card.addEventListener("pointerleave", onLeave, { passive: true });
          cleanups.push(() => {
            card.removeEventListener("pointermove", onMove);
            card.removeEventListener("pointerenter", onEnter);
            card.removeEventListener("pointerleave", onLeave);
            glow.remove();
          });
        });

        const hero = page.querySelector<HTMLElement>("[data-home-hero]");
        const heroStudy = hero?.querySelector<HTMLElement>(".signature-study");
        if (hero && heroStudy) {
          const studyX = gsap.quickTo(heroStudy, "x", { duration: 0.75, ease: "power3.out" });
          const studyY = gsap.quickTo(heroStudy, "y", { duration: 0.75, ease: "power3.out" });
          const moveStudy = (event: PointerEvent) => {
            const rect = hero.getBoundingClientRect();
            studyX(((event.clientX - rect.left) / rect.width - 0.5) * 12);
            studyY(((event.clientY - rect.top) / rect.height - 0.5) * 12);
          };
          const resetStudy = () => {
            studyX(0);
            studyY(0);
          };
          hero.addEventListener("pointermove", moveStudy, { passive: true });
          hero.addEventListener("pointerleave", resetStudy, { passive: true });
          cleanups.push(() => {
            hero.removeEventListener("pointermove", moveStudy);
            hero.removeEventListener("pointerleave", resetStudy);
          });
        }

        const magneticTargets = gsap.utils.toArray<HTMLElement>(
          ".portfolio-button, .site-nav a, .site-nav button, .brand-link",
        );
        magneticTargets.forEach((target) => {
          const xTo = gsap.quickTo(target, "x", { duration: 0.38, ease: "power3.out" });
          const yTo = gsap.quickTo(target, "y", { duration: 0.38, ease: "power3.out" });
          const move = (event: PointerEvent) => {
            const rect = target.getBoundingClientRect();
            const x = gsap.utils.clamp(-5, 5, (event.clientX - rect.left - rect.width / 2) * 0.09);
            const y = gsap.utils.clamp(-4, 4, (event.clientY - rect.top - rect.height / 2) * 0.09);
            target.style.willChange = "transform";
            xTo(x);
            yTo(y);
          };
          const reset = () => {
            gsap.to(target, {
              x: 0,
              y: 0,
              duration: 0.45,
              ease: "power3.out",
              overwrite: "auto",
              onComplete: () => {
                target.style.willChange = "";
                gsap.set(target, { clearProps: "transform" });
              },
            });
          };
          target.addEventListener("pointermove", move, { passive: true });
          target.addEventListener("pointerleave", reset, { passive: true });
          cleanups.push(() => {
            target.removeEventListener("pointermove", move);
            target.removeEventListener("pointerleave", reset);
          });
        });
      }

        return () => {
          cleanups.forEach((cleanup) => cleanup());
          gsap.killTweensOf(revealItems);
        };
      },
    );
  } catch (error) {
    revealWithoutMotion();
    console.warn("[home-motion] Motion initialization failed; showing static content.", error);
  }
}
