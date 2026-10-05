(() => {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('rem-motion');
  setTimeout(() => {
    const root = document.querySelector('[data-rem-experience]');
    if (root && root.dataset.ready !== 'true') {
      document.documentElement.classList.remove('rem-motion');
      root.dataset.fallback = 'true';
    }
  }, 3500);
})();
