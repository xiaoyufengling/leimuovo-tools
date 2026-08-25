import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface LabSnapshot {
  visitor: { label: string; count: number };
  totalPets: number;
  participantCount: number;
  leaders: Array<{ label: string; count: number }>;
}

const VISITOR_KEY = "xiaoyugan-anonymous-visitor-v1";
const LOCAL_COUNT_KEY = "xiaoyugan-local-pets-v1";
const VISITOR_ID_PATTERN = /^xyg_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function createVisitorId(): string {
  if (typeof crypto.randomUUID === "function") return `xyg_${crypto.randomUUID()}`;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `xyg_${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function readStoredVisitor(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && VISITOR_ID_PATTERN.test(existing)) return existing;
    const created = createVisitorId();
    window.localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return createVisitorId();
  }
}

function readLocalCount(): number {
  try {
    return Math.max(0, Number(window.localStorage.getItem(LOCAL_COUNT_KEY)) || 0);
  } catch {
    return 0;
  }
}

function storeLocalCount(count: number): void {
  try {
    window.localStorage.setItem(LOCAL_COUNT_KEY, String(count));
  } catch {
    // The interaction remains available for this page view.
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, value));
}

function mountPetCounter(page: HTMLElement): void {
  const button = page.querySelector<HTMLButtonElement>("[data-pet-button]");
  const card = page.querySelector<HTMLElement>("[data-pet-card]");
  const ownCounts = page.querySelectorAll<HTMLElement>("[data-own-count]");
  const totalCount = page.querySelector<HTMLElement>("[data-total-count]");
  const participantCount = page.querySelector<HTMLElement>("[data-participant-count]");
  const visitorLabel = page.querySelector<HTMLElement>("[data-visitor-label]");
  const connection = page.querySelector<HTMLElement>("[data-connection]");
  const leaderboard = page.querySelector<HTMLOListElement>("[data-leaderboard]");
  const recent = page.querySelector<HTMLOListElement>("[data-recent-pets]");
  const announcement = page.querySelector<HTMLElement>("[data-pet-announcement]");
  if (!button || !card || ownCounts.length === 0 || !totalCount || !participantCount || !visitorLabel || !connection || !leaderboard || !recent) return;

  const remArtwork = button.querySelector<HTMLElement>("[data-rem-artwork]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const visitor = readStoredVisitor();
  let localCount = readLocalCount();
  let snapshot: LabSnapshot = {
    visitor: { label: `匿名小鱼 · ${visitor.slice(-4).toUpperCase()}`, count: localCount },
    totalPets: localCount,
    participantCount: localCount > 0 ? 1 : 0,
    leaders: [],
  };
  let pendingClicks = 0;
  let sending = false;
  let hasInteracted = false;
  let recentTimes: Date[] = [];
  let petSide = 0;
  let petTimeline: ReturnType<typeof gsap.timeline> | null = null;
  let petResetTimer = 0;
  let lastPointerReleaseAt = Number.NEGATIVE_INFINITY;
  let pulseFrame = 0;
  let pulseTimer = 0;

  const setConnection = (state: "loading" | "online" | "local") => {
    connection.dataset.state = state;
    connection.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
    connection.append(document.createTextNode(state === "online" ? "全站记录已连接" : state === "loading" ? "正在连接记录" : "暂存于这台设备"));
  };

  const renderLeaderboard = () => {
    leaderboard.replaceChildren();
    const rows = snapshot.leaders.length > 0 ? snapshot.leaders : [{ label: "还没有全站记录", count: 0 }];
    rows.forEach((row, index) => {
      const item = document.createElement("li");
      const rank = document.createElement("span");
      const name = document.createElement("strong");
      const count = document.createElement("em");
      rank.textContent = String(index + 1).padStart(2, "0");
      name.textContent = row.label;
      count.textContent = row.count > 0 ? `${formatNumber(row.count)} 次` : "等待第一次点击";
      item.append(rank, name, count);
      leaderboard.append(item);
    });
  };

  const render = () => {
    ownCounts.forEach((element) => { element.textContent = formatNumber(snapshot.visitor.count); });
    totalCount.textContent = formatNumber(snapshot.totalPets);
    participantCount.textContent = formatNumber(snapshot.participantCount);
    visitorLabel.textContent = snapshot.visitor.label;
    renderLeaderboard();
  };

  const renderRecent = () => {
    recent.replaceChildren();
    if (recentTimes.length === 0) {
      const empty = document.createElement("li");
      empty.className = "is-empty";
      empty.textContent = "点一下猫耳，这里会留下当前会话的时间记录。";
      recent.append(empty);
      return;
    }
    recentTimes.slice(0, 5).forEach((date, index) => {
      const item = document.createElement("li");
      const order = document.createElement("span");
      const description = document.createElement("strong");
      const time = document.createElement("time");
      order.textContent = String(index + 1).padStart(2, "0");
      description.textContent = "蕾姆猫耳收到一次摸摸";
      time.textContent = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      item.append(order, description, time);
      recent.append(item);
    });
  };

  const readPetSide = (event: PointerEvent | MouseEvent): number => {
    if (event.clientX <= 0) return petSide;
    const rect = button.getBoundingClientRect();
    return Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
  };

  const clearPetPose = () => {
    window.clearTimeout(petResetTimer);
    petResetTimer = 0;
    button.classList.remove("is-pet-active");
    if (remArtwork) gsap.set(remArtwork, { clearProps: "transform,transformOrigin" });
  };

  const pressPet = (event: PointerEvent) => {
    lastPointerReleaseAt = Number.NEGATIVE_INFINITY;
    if (reducedMotion.matches || !remArtwork) return;
    petSide = readPetSide(event);

    petTimeline?.kill();
    window.clearTimeout(petResetTimer);
    gsap.killTweensOf(remArtwork);
    button.classList.add("is-pet-active");
    gsap.to(remArtwork, {
      y: 4,
      rotation: petSide * 1.2,
      scaleX: 1.035,
      scaleY: 0.925,
      transformOrigin: `${50 + petSide * 10}% 68%`,
      duration: 0.06,
      ease: "power2.out",
      overwrite: true,
    });
  };

  const playPetBounce = (event: PointerEvent | MouseEvent) => {
    if (reducedMotion.matches || !remArtwork) return;
    petSide = readPetSide(event);

    petTimeline?.kill();
    window.clearTimeout(petResetTimer);
    gsap.killTweensOf(remArtwork);
    button.classList.add("is-pet-active");
    petTimeline = gsap.timeline({
      defaults: { overwrite: "auto" },
      onComplete: clearPetPose,
    });
    petTimeline
      .addLabel("release", 0)
      .to(remArtwork, {
        y: -6,
        rotation: petSide * -4.2,
        scaleX: 0.965,
        scaleY: 1.065,
        transformOrigin: `${50 + petSide * 10}% 68%`,
        duration: 0.14,
        ease: "back.out(3.2)",
      }, "release")
      .to(remArtwork, {
        y: 2,
        rotation: petSide * 2.1,
        scaleX: 1.025,
        scaleY: 0.98,
        duration: 0.13,
        ease: "power2.inOut",
      }, "release+=0.14")
      .to(remArtwork, {
        y: -1,
        rotation: petSide * -0.7,
        scaleX: 0.995,
        scaleY: 1.01,
        duration: 0.12,
        ease: "sine.inOut",
      }, "release+=0.28")
      .to(remArtwork, {
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        duration: 0.15,
        ease: "sine.out",
      }, "release+=0.39");

    // Mobile browsers can pause a GSAP completion callback while a touch page
    // changes its rendering cadence. Keep a native-timer safety net so the
    // exact composite image always returns after the interaction.
    petResetTimer = window.setTimeout(() => {
      petTimeline?.kill();
      petTimeline = null;
      clearPetPose();
    }, 680);
  };

  async function flushClicks(): Promise<void> {
    if (sending || pendingClicks === 0) return;
    sending = true;
    while (pendingClicks > 0) {
      pendingClicks -= 1;
      try {
        const response = await fetch("/api/lab/pets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitor }),
        });
        if (!response.ok) throw new Error("pet counter unavailable");
        const remoteSnapshot = await response.json() as LabSnapshot;
        snapshot = pendingClicks > 0
          ? {
              ...remoteSnapshot,
              visitor: { ...remoteSnapshot.visitor, count: localCount },
              totalPets: remoteSnapshot.totalPets + pendingClicks,
            }
          : remoteSnapshot;
        if (pendingClicks === 0) localCount = remoteSnapshot.visitor.count;
        storeLocalCount(localCount);
        setConnection("online");
        render();
      } catch {
        pendingClicks = 0;
        setConnection("local");
      }
    }
    sending = false;
  }

  const preventNativeArtworkAction = (event: Event) => event.preventDefault();
  button.addEventListener("contextmenu", preventNativeArtworkAction);
  button.addEventListener("dragstart", preventNativeArtworkAction);
  button.addEventListener("selectstart", preventNativeArtworkAction);

  button.addEventListener("pointerdown", pressPet, { passive: true });
  button.addEventListener("pointerup", (event) => {
    lastPointerReleaseAt = performance.now();
    playPetBounce(event);
  }, { passive: true });
  button.addEventListener("pointercancel", () => {
    lastPointerReleaseAt = Number.NEGATIVE_INFINITY;
    petTimeline?.kill();
    window.clearTimeout(petResetTimer);
    if (!remArtwork) return;
    gsap.to(remArtwork, {
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 0.16,
      ease: "power2.out",
      onComplete: clearPetPose,
    });
  }, { passive: true });

  button.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches) return;
    const rect = button.getBoundingClientRect();
    const look = (event.clientX - rect.left) / rect.width - 0.5;
    button.style.setProperty("--ear-look", String(Math.max(-1, Math.min(1, look * 2))));
  }, { passive: true });
  button.addEventListener("pointerleave", () => button.style.setProperty("--ear-look", "0"), { passive: true });

  button.addEventListener("click", (event) => {
    hasInteracted = true;
    localCount += 1;
    storeLocalCount(localCount);
    snapshot = {
      ...snapshot,
      visitor: { ...snapshot.visitor, count: localCount },
      totalPets: snapshot.totalPets + 1,
      participantCount: Math.max(snapshot.participantCount, 1),
    };
    recentTimes = [new Date(), ...recentTimes].slice(0, 5);
    pendingClicks += 1;
    if (performance.now() - lastPointerReleaseAt > 250) playPetBounce(event);
    card.classList.remove("is-petted");
    window.cancelAnimationFrame(pulseFrame);
    window.clearTimeout(pulseTimer);
    pulseFrame = window.requestAnimationFrame(() => {
      card.classList.add("is-petted");
      pulseTimer = window.setTimeout(() => card.classList.remove("is-petted"), 720);
    });
    render();
    renderRecent();
    announcement?.replaceChildren(document.createTextNode(`这是你的第 ${localCount} 次摸摸`));
    navigator.vibrate?.(8);
    void flushClicks();
  });

  render();
  renderRecent();
  setConnection("loading");
  fetch(`/api/lab/pets?visitor=${encodeURIComponent(visitor)}`, { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error("pet counter unavailable");
      return response.json() as Promise<LabSnapshot>;
    })
    .then((remoteSnapshot) => {
      if (hasInteracted) return;
      snapshot = remoteSnapshot;
      localCount = remoteSnapshot.visitor.count;
      storeLocalCount(localCount);
      setConnection("online");
      render();
    })
    .catch(() => setConnection("local"));
}

function mountMotion(page: HTMLElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.from(page.querySelectorAll(".xyg-intro > *"), {
    y: 18,
    duration: 0.72,
    stagger: 0.07,
    ease: "power3.out",
    clearProps: "transform",
  });

  gsap.utils.toArray<HTMLElement>("[data-xyg-reveal]", page).forEach((item) => {
    gsap.fromTo(item, {
      y: window.innerWidth >= 768 ? 34 : 20,
      scale: window.innerWidth >= 768 ? 0.985 : 1,
      filter: window.innerWidth >= 768 ? "blur(7px)" : "none",
    }, {
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      duration: 0.86,
      ease: "power3.out",
      clearProps: "transform,filter",
      immediateRender: false,
      scrollTrigger: { trigger: item, start: "top 88%", once: true },
    });
  });

  gsap.to(".xyg-orbit--one", { yPercent: 16, rotation: 14, ease: "none", scrollTrigger: { trigger: page, start: "top top", end: "bottom bottom", scrub: 1.2 } });
  gsap.to(".xyg-orbit--two", { yPercent: -12, rotation: -10, ease: "none", scrollTrigger: { trigger: page, start: "top top", end: "bottom bottom", scrub: 1.4 } });

  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  gsap.utils.toArray<HTMLElement>("[data-tilt]", page).forEach((card) => {
    const xTo = gsap.quickTo(card, "rotationY", { duration: 0.45, ease: "power3.out" });
    const yTo = gsap.quickTo(card, "rotationX", { duration: 0.45, ease: "power3.out" });
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--pointer-x", `${(x + 0.5) * 100}%`);
      card.style.setProperty("--pointer-y", `${(y + 0.5) * 100}%`);
      xTo(x * 2.2);
      yTo(y * -1.6);
    }, { passive: true });
    card.addEventListener("pointerleave", () => { xTo(0); yTo(0); }, { passive: true });
  });
}

const page = document.querySelector<HTMLElement>("[data-xiaoyugan]");
if (page) {
  mountPetCounter(page);
  mountMotion(page);
}
