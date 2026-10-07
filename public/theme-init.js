// Applies a saved light/dark override before first paint to avoid a flash.
// Kept tiny and dependency-free; the app re-applies the theme after loading.
(function () {
  try {
    var theme = localStorage.getItem("theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
  } catch {
    // Storage unavailable: follow the system theme.
  }
})();
