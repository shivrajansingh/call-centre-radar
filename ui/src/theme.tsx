import { useCallback, useEffect, useState } from "react";

const KEY = "radar_theme";
const DARK = "dark";
const LIGHT = "light";

function initial(): string {
  const saved = localStorage.getItem(KEY);
  if (saved === LIGHT || saved === DARK) return saved;
  return DARK;
}

export function useTheme() {
  const [theme, setTheme] = useState<string>(initial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(t => (t === DARK ? LIGHT : DARK));
  }, []);

  return { theme, toggle };
}

export function usePageTitle(page: string | null) {
  useEffect(() => {
    document.title = page ? `${page} · Call-Centre Radar` : "Call-Centre Radar";
    return () => { document.title = "Call-Centre Radar"; };
  }, [page]);
}