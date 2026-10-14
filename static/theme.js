(() => {
  const storageKey = "nexus-theme";
  const root = document.documentElement;
  const toggleButtons = document.querySelectorAll("[data-theme-toggle]");
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const storedTheme = (() => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  })();
  const systemPrefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;

  function applyTheme(theme, savePreference = false) {
    const isDark = theme === "dark";
    const nextTheme = isDark ? "light" : "dark";
    root.dataset.theme = isDark ? "dark" : "light";
    root.style.colorScheme = isDark ? "dark" : "light";
    themeColor?.setAttribute("content", isDark ? "#151b18" : "#ffffff");

    toggleButtons.forEach((button) => {
      const label = button.querySelector(".theme-toggle-label");
      const icon = button.querySelector(".theme-toggle-icon");
      const actionLabel = `Switch to ${nextTheme} mode`;
      if (label) label.textContent = `${nextTheme === "dark" ? "Dark" : "Light"} mode`;
      if (icon) icon.textContent = nextTheme === "dark" ? "☾" : "☀";
      button.setAttribute("aria-label", actionLabel);
      button.setAttribute("title", actionLabel);
    });

    if (savePreference) {
      try {
        localStorage.setItem(storageKey, isDark ? "dark" : "light");
      } catch {
        // The current page can still use the chosen theme if storage is unavailable.
      }
    }
  }

  const initialTheme = storedTheme === "dark" || storedTheme === "light"
    ? storedTheme
    : systemPrefersDark ? "dark" : "light";
  applyTheme(initialTheme);

  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
    });
  });
})();
