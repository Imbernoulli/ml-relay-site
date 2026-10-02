"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { IndexEntry, StatusData } from "@/lib/types";
import { statusBadge } from "./RequestStatus";
import { Badge } from "./ui";
import { gpuLabel } from "@/lib/site";
import TaskImage from "./TaskImage";
import StarButton from "./StarButton";
import { areaCounts, splitArea } from "@/lib/areas";
import { currentApprovals, useReviews } from "@/lib/reviews";

// Filter chips group by the top-level area (the part before " / "), in the taxonomy's fixed order.
const topArea = (a?: string | null) => splitArea(a).area;

export default function TaskCatalogue({ tasks, status }: { tasks: IndexEntry[]; status?: StatusData }) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState<string>("");
  const [appr, setAppr] = useState<"" | "yes" | "no">("");
  const { reviews } = useReviews();
  const nApproved = (t: IndexEntry) => currentApprovals(reviews?.[t.id], t.version).length;
  const areas = useMemo(() => areaCounts(tasks.map((t) => t.area)), [tasks]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (area && topArea(t.area) !== area) return false;
      if (appr && reviews && (appr === "yes") !== currentApprovals(reviews[t.id], t.version).length > 0) return false;
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
  }, [tasks, q, area, appr, reviews]);

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
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {(
          [
            ["", "Any review state"],
            ["yes", "✓ Approved"],
            ["no", "Not yet approved"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setAppr(k)}
            disabled={k !== "" && !reviews}
            className={`rounded-full border px-2.5 py-1 ${appr === k ? "border-foreground/40 bg-muted font-medium" : "border-border text-muted-foreground hover:text-foreground"} disabled:opacity-50`}
          >
            {label}
            {k === "yes" && reviews ? <span className="ml-1 text-muted-foreground">{tasks.filter((t) => nApproved(t) > 0).length}</span> : null}
            {k === "no" && reviews ? <span className="ml-1 text-muted-foreground">{tasks.filter((t) => nApproved(t) === 0).length}</span> : null}
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
                  <span>{topArea(t.area)}</span>
                </div>
                <h3 className="mt-1 text-base font-semibold leading-snug group-hover:underline">{t.title ?? t.id}</h3>
                {splitArea(t.area).topic && <div className="mt-0.5 text-xs text-muted-foreground">{splitArea(t.area).topic}</div>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <StarButton id={t.id} />
                {nApproved(t) > 0 && (
                  <span
                    title={`Approved by ${currentApprovals(reviews?.[t.id], t.version).map((m) => m.login).join(", ")}`}
                    className="inline-flex items-center rounded-full border border-emerald-600/50 bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200"
                  >
                    ✓ {nApproved(t)}
                  </span>
                )}
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
            </div>
            </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
