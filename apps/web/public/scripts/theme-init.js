(() => {
  try {
    const saved = window.localStorage.getItem("leimuovo-theme");
    if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  } catch {
    // System theme remains available when storage is blocked.
  }
})();
