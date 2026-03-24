const THEMES = ["dark", "evening", "light"];
const THEME_CURRENT_ICONS = { dark: "🌑", evening: "🌆", light: "☀️" };

export function setAdminNav(isAdmin) {
  const el = document.getElementById("admin-link");
  if (el) el.style.display = isAdmin ? "" : "none";
}

export function applyTheme(theme) {
  document.documentElement.classList.remove("light", "evening");
  if (theme === "light") document.documentElement.classList.add("light");
  if (theme === "evening") document.documentElement.classList.add("evening");
  const icon = THEME_CURRENT_ICONS[theme] || "🌑";
  const appBtn = document.getElementById("theme-btn");
  if (appBtn) appBtn.textContent = icon;
  const loginBtn = document.getElementById("login-theme-btn");
  if (loginBtn) loginBtn.textContent = icon;
}

export function cycleTheme() {
  const current = localStorage.getItem("tl_theme") || "dark";
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  localStorage.setItem("tl_theme", next);
  applyTheme(next);
}
