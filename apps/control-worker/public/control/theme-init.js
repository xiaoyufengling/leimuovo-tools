(() => {
  try {
    const stored = window.localStorage.getItem("leimuovo-theme");
    if (stored === "light" || stored === "dark") document.documentElement.dataset.theme = stored;
  } catch {
    // The system preference remains the fallback when storage is unavailable.
  }
})();
