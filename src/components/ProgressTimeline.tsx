"use client";

import { useEffect, useState } from "react";
import type { ProgressRecord, ProgressStep } from "@/lib/types";

const ICON: Record<string, { ch: string; cls: string; label: string }> = {
  done: { ch: "✓", cls: "bg-emerald-500 text-white", label: "done" },
  running: { ch: "●", cls: "bg-amber-500 text-white animate-pulse", label: "running" },
  waiting: { ch: "⏸", cls: "bg-amber-400 text-white", label: "paused / waiting" },
  failed: { ch: "✕", cls: "bg-red-500 text-white", label: "failed" },
  skipped: { ch: "–", cls: "bg-muted text-muted-foreground", label: "skipped" },
  pending: { ch: "○", cls: "bg-muted text-muted-foreground", label: "pending" },
};

/** Step times come as ISO strings or as Unix seconds. */
function toMs(t?: string | number): number {
  if (t === undefined || t === null || t === "") return NaN;
  if (typeof t === "number") return t < 1e12 ? t * 1000 : t;
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    return n < 1e12 ? n * 1000 : n;
  }
  return Date.parse(t);
}

function elapsed(from: string | number, now: number): string | null {
  const t = toMs(from);
  if (!Number.isFinite(t) || now < t) return null;
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return "just started";
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} d ${h % 24} h`;
  return h > 0 ? `${h} h ${m % 60} m` : `${m} m`;
}

function when(t?: string | number): string | null {
  const ms = toMs(t);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

/** Detailed per-step progress (public fields only); last three steps unless expanded. */
export default function ProgressTimeline({ progress, compact = false }: { progress: ProgressRecord; compact?: boolean }) {
  const [all, setAll] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const steps = progress.steps ?? [];
  if (!steps.length) return null;
  const curIdx =
    typeof progress.current === "number"
      ? progress.current
      : typeof progress.current === "string"
        ? steps.findIndex((s) => s.kind === progress.current || s.label === progress.current)
        : steps.map((s) => s.state).lastIndexOf("running");
  const indexed = steps.map((s, i) => [s, i] as [ProgressStep, number]);
  if (compact) {
    const [s] = indexed[curIdx >= 0 ? curIdx : indexed.length - 1];
    const ic = ICON[s.state] ?? ICON.pending;
    const el = s.state === "running" && s.t && now !== null ? elapsed(s.t, now) : null;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span title={ic.label} className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] ${ic.cls}`}>
          {ic.ch}
        </span>
        <span className="font-medium">{s.label ?? s.kind ?? "step"}</span>
        {s.detail_public && <span className="text-muted-foreground">· {s.detail_public}</span>}
        {el && <span className="text-muted-foreground">· {el}</span>}
      </span>
    );
  }
  // collapsed: the maintainer-approval step (always the first) plus the last three
  const tail = indexed.slice(-3);
  const shown = all ? indexed : [...indexed.filter(([st, i]) => st.kind === "approval" && !tail.some(([, j]) => j === i)), ...tail];
  return (
    <div className="mt-3">
      <ol className="space-y-1.5">
        {shown.map(([s, i]) => {
          const ic = ICON[s.state] ?? ICON.pending;
          const isCur = i === curIdx;
          const el = s.state === "running" && s.t && now !== null ? elapsed(s.t, now) : null;
          return (
            <li key={i} className={`flex items-start gap-2 rounded-md px-2 py-1 text-sm ${isCur ? "bg-amber-500/10 ring-1 ring-amber-500/40" : ""}`}>
              <span title={ic.label} className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${ic.cls}`}>
                {ic.ch}
              </span>
              <div className="min-w-0 flex-1">
                <span className={isCur ? "font-semibold" : ""}>{s.label ?? s.kind ?? "step"}</span>
                {s.detail_public && <span className="text-muted-foreground"> · {s.detail_public}</span>}
                {el && <span className="text-muted-foreground"> · {el}</span>}
              </div>
              {when(s.t) && <span className="shrink-0 text-[11px] text-muted-foreground">{when(s.t)}</span>}
            </li>
          );
        })}
      </ol>
      {(steps.length > shown.length || all) && (
        <button type="button" onClick={() => setAll(!all)} className="mt-1 text-xs underline">
          {all ? "show fewer" : `show all ${steps.length} steps`}
        </button>
      )}
    </div>
  );
}
