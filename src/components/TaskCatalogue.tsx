"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { IndexEntry, StatusData } from "@/lib/types";
import { statusBadge } from "./RequestStatus";
import { fmtScore } from "@/lib/format";
import { Badge } from "./ui";
import { gpuLabel } from "@/lib/site";
import TaskImage from "./TaskImage";

// Filter chips group by the top-level area (the part before " / ").
const topArea = (a?: string | null) => (a ? a.split(" / ")[0].trim() : "—");

export default function TaskCatalogue({ tasks, status }: { tasks: IndexEntry[]; status?: StatusData }) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState<string>("");
  const areas = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) m.set(topArea(t.area), (m.get(topArea(t.area)) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [tasks]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (area && topArea(t.area) !== area) return false;
      if (!s) return true;
      const hay = [
        t.id, t.title, t.area, t.question, t.repo, t.oracle, t.oracle_name,
        ...t.settings.flatMap((x) => [x.name, x.display]),
        ...t.baselines.flatMap((b) => [b.slug, b.name]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return s.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [tasks, q, area]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, question, method, dataset, model…"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-foreground/40 sm:max-w-md"
          aria-label="Search tasks"
        />
        <span className="text-xs text-muted-foreground">
          {shown.length} of {tasks.length} tasks
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button onClick={() => setArea("")} className={`rounded-full border px-2.5 py-1 text-xs ${area === "" ? "border-foreground/40 bg-muted font-medium" : "border-border text-muted-foreground"}`}>
          All areas
        </button>
        {areas.map(([a, n]) => (
          <button
            key={a}
            onClick={() => setArea(a === area ? "" : a)}
            className={`rounded-full border px-2.5 py-1 text-xs ${a === area ? "border-foreground/40 bg-muted font-medium" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {a} <span className="text-muted-foreground">{n}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-3">
        {shown.map((t) => (
          <Link key={t.id} href={`/tasks/${t.id}/`} className="group block rounded-xl border border-border bg-card p-4 transition hover:border-foreground/30 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
            <div>
              <TaskImage image={t.image} title={t.title ?? t.id} area={t.area} variant="thumb" />
            </div>
            <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">#{t.n}</span>
                  <span className="break-anywhere font-mono">{t.id}</span>
                  <span>·</span>
                  <span>{t.area ?? "—"}</span>
                </div>
                <h3 className="mt-1 text-base font-semibold leading-snug group-hover:underline">{t.title ?? t.id}</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {statusBadge(status?.tasks[t.id]) && <Badge tone="warn">{statusBadge(status?.tasks[t.id])}</Badge>}
                {gpuLabel(t.gpus) && <Badge>{gpuLabel(t.gpus)}</Badge>}
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.question ?? "—"}</p>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-[6.5rem_1fr]">
              <span className="text-muted-foreground">Settings</span>
              <span className="flex flex-wrap gap-1">
                {t.settings.map((s) => (
                  <span key={s.name} title={s.name} className="rounded border border-border px-1.5 py-0.5 text-[11px]">
                    {s.display ?? s.name}
                  </span>
                ))}
              </span>
              <span className="text-muted-foreground">Baselines</span>
              <span className="flex flex-wrap gap-1">
                {t.baselines.map((b) => (
                  <span
                    key={b.slug}
                    title={b.name ?? ""}
                    className={`rounded border px-1.5 py-0.5 text-[11px] ${b.role === "oracle" ? "border-emerald-600/60 bg-emerald-600/10 font-semibold" : "border-border"}`}
                  >
                    {b.name ?? b.slug}
                  </span>
                ))}
              </span>
              {t.oracle !== undefined ? (
                <>
                  <span className="text-muted-foreground">Oracle</span>
                  <span className="break-anywhere">
                    <span className="font-mono">{t.oracle ?? "—"}</span>
                    {t.oracle_name && <span className="text-muted-foreground"> · {t.oracle_name}</span>}
                    <span className="text-muted-foreground"> · task score at the 0.1 anchor {fmtScore(t.oracle_score)}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">Best baseline</span>
                  <span className="font-mono">{fmtScore(t.best_score)}</span>
                </>
              )}
            </div>
            </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
