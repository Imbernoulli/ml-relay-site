"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") || "light");
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("mlrelay-theme", next);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
    setTheme(next);
  };
  return (
    <button
      onClick={flip}
      aria-label="Toggle light / dark mode"
      title="Toggle light / dark mode"
      className="ml-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      {theme === "dark" ? "Light" : theme === "light" ? "Dark" : "Theme"}
    </button>
  );
}
