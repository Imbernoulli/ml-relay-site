"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Tasks" },
  { href: "/proposals/", label: "Proposals" },
  { href: "/me/", label: "My work" },
];

export default function Navbar({ mode = "internal" }: { mode?: "public" | "internal" }) {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="text-base font-semibold tracking-tight">ML-Relay</span>
          {mode === "internal" && (
            <span className="hidden rounded-full border border-warn-border bg-warn-bg px-2 py-0.5 text-[10px] font-medium text-warn-text sm:inline">
              internal
            </span>
          )}
        </Link>
        <div className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" || pathname.startsWith("/tasks") : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/propose/"
            className="ml-1 rounded-md border border-emerald-600/60 bg-emerald-600/10 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:border-emerald-600 dark:text-emerald-200"
          >
            Propose a task
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
