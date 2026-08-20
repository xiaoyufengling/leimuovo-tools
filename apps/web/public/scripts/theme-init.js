(() => {
  document.documentElement.classList.add("has-js");
  try {
    const saved = window.localStorage.getItem("leimuovo-theme");
    document.documentElement.dataset.theme = saved === "light" || saved === "dark" ? saved : "dark";
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
  const themeColor = document.querySelector("[data-theme-color]");
  themeColor?.setAttribute(
    "content",
    document.documentElement.dataset.theme === "light" ? "#F7F7F8" : "#0B0B0D",
  );
})();
