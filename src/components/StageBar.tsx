"use client";

import { useEffect, useState } from "react";
import { computeStages, type Mark, type StageInput } from "@/lib/stages";

// The horizontal stage bar at the top of every request card. Stages come from the
// labels (via the status data: approval, phase, awaiting-go, done) and the PR state;
// the detailed progress steps only refine the current stage (failed / paused).

function elapsed(t: number, now: number): string | null {
  if (!Number.isFinite(t) || now < t) return null;
  const m = Math.floor((now - t) / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} d ${h % 24} h`;
  if (h > 0) return `${h} h ${m % 60} m`;
  return `${Math.max(1, m)} m`;
}

const DOT: Record<Mark, string> = {
  done: "bg-emerald-500 text-white",
  current: "bg-sky-600 text-white ring-4 ring-sky-500/20",
  paused: "bg-amber-400 text-white ring-4 ring-amber-400/25",
  failed: "bg-red-500 text-white ring-4 ring-red-500/20",
  upcoming: "bg-muted text-muted-foreground",
};
const CH: Record<Mark, string> = { done: "✓", current: "●", paused: "⏸", failed: "✕", upcoming: "" };
const BAR: Record<Mark, string> = { done: "bg-emerald-500", current: "bg-sky-600", paused: "bg-amber-400", failed: "bg-red-500", upcoming: "bg-muted" };

export default function StageBar(props: StageInput) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const { names, marks, cur, note, since } = computeStages(props);
  const allDone = marks.every((m) => m === "done");
  const el = !allDone && now !== null ? elapsed(since, now) : null;
  const curMark = marks[cur];
  return (
    <div className="mt-3">
      {/* phones: one line + a thin bar */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span>
            <span className="text-muted-foreground">
              Stage {cur + 1} of {names.length} ·{" "}
            </span>
            <span className="font-semibold">{allDone ? "Merged" : names[cur]}</span>
            {note && !allDone && <span className={curMark === "failed" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-300"}> · {note}</span>}
          </span>
          {el && <span className="shrink-0 text-[11px] text-muted-foreground">{el}</span>}
        </div>
        <div className="mt-1 flex h-1 gap-0.5 overflow-hidden rounded-full">
          {marks.map((m, i) => (
            <span key={i} className={`flex-1 ${BAR[m]}`} />
          ))}
        </div>
      </div>
      {/* wider screens: the stepper */}
      <ol className="hidden items-start sm:flex">
        {names.map((n, i) => {
          const m = marks[i];
          return (
            <li key={n} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {i > 0 && <span className={`absolute right-1/2 top-2.5 h-0.5 w-full -translate-y-1/2 ${marks[i - 1] === "done" ? "bg-emerald-500" : "bg-muted"}`} />}
              <span className={`relative z-10 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${DOT[m]}`}>{CH[m]}</span>
              <span className={`mt-1 px-1 text-[11px] leading-tight ${m === "upcoming" ? "text-muted-foreground" : m === "done" ? "text-foreground/80" : "font-semibold"}`}>{n}</span>
              {i === cur && !allDone && (note || el) && (
                <span className={`px-1 text-[10px] leading-tight ${m === "failed" ? "text-red-600 dark:text-red-400" : m === "paused" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
                  {[note, el].filter(Boolean).join(" · ")}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

