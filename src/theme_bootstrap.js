(function applySavedTheme() {
  try {
    const stored = JSON.parse(localStorage.getItem("hengce.appearance.v1") || "{}");
    const preference = ["system", "light", "dark"].includes(stored.theme) ? stored.theme : "system";
    const dark = preference === "dark" || (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.themePreference = preference;
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePreference = "system";
  }
})();
