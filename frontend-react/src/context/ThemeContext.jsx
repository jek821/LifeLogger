import { createContext, useContext, useEffect, useState } from "react";

const THEMES = ["dark", "evening", "light"];
const ICONS = { dark: "🌑", evening: "🌆", light: "☀️" };
const PIE_HOLE = { dark: "#252119", evening: "#585248", light: "#faf7f2" };

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("tl_theme") || "dark");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "evening", "light");
    if (theme !== "dark") root.classList.add(theme);
    localStorage.setItem("tl_theme", theme);
  }, [theme]);

  function cycleTheme() {
    setTheme((t) => {
      const idx = THEMES.indexOf(t);
      return THEMES[(idx + 1) % THEMES.length];
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, cycleTheme, icon: ICONS[theme], pieHole: PIE_HOLE[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
