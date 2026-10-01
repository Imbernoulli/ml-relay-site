"use client";

import { useEffect, useState } from "react";
import { getShortlist, onShortlistChange, toggleShortlist } from "@/lib/shortlist";

/** ☆/★ toggle for the shortlist (kept in this browser only). */
export default function StarButton({ id, withLabel = false }: { id: string; withLabel?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(getShortlist().includes(id));
    sync();
    return onShortlistChange(sync);
  }, [id]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleShortlist(id);
      }}
      aria-pressed={on}
      title={on ? "Remove from your shortlist" : "Add to your shortlist (kept in this browser)"}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm leading-none transition-colors ${
        on ? "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-300" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <span aria-hidden>{on ? "★" : "☆"}</span>
      {withLabel && <span className="text-xs">{on ? "Shortlisted" : "Shortlist"}</span>}
    </button>
  );
}
