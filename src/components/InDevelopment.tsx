"use client";

import Link from "next/link";
import { useLiveStatus } from "@/lib/liveStatus";
import { cleanRequestTitle } from "@/lib/requestTitle";
import type { DevTask } from "@/lib/types";

const STAGE: Record<string, string> = {
  idea: "Idea",
  design: "Design review",
  pilot: "Building & pilot run",
  measurement: "Full measurement",
  gate3: "Final checks",
};
const PHASE_STAGE: Record<string, DevTask["stage"]> = { A: "design", B: "pilot", C: "measurement" };

export function InDevelopmentBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-sky-600/50 bg-sky-600/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
      In development
    </span>
  );
}

/** Homepage: tasks being built. Not part of the set above: not counted, not featured, no change requests.
 *  A proposal's phase follows the live status (labels newtask-phase-a/b/c); one that ships or closes drops out. */
export default function InDevelopment({ tasks }: { tasks: DevTask[] }) {
  const live = useLiveStatus();
  const rows = tasks
    .map((t) => {
      if (t.kind !== "proposal" || !t.issue) return t;
      const r = live?.[String(t.issue)];
      if (!r) return t;
      if (r.state === "closed" || r.pr_state === "merged" || (r.labels ?? []).includes("newtask-done")) return null;
      const ph = (r.labels ?? []).find((l) => l.startsWith("newtask-phase-"))?.slice(-1).toUpperCase();
      return ph && PHASE_STAGE[ph] ? { ...t, phase: ph, stage: PHASE_STAGE[ph] } : t;
    })
    .filter((t): t is DevTask => t !== null);
  if (!rows.length) return null;
  return (
    <section id="in-development" className="mt-10">
      <h2 className="text-lg font-semibold">
        In development <span className="text-sm font-normal text-muted-foreground">{rows.length}</span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tasks being built: proposals the agent is designing or measuring, and tasks built in-house. They are not part of the set until they ship.
      </p>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
        {rows.map((t) => (
          <li key={t.issue ? `i${t.issue}` : t.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="flex shrink-0 items-center gap-2">
              <InDevelopmentBadge />
              <span className="text-xs text-muted-foreground">
                {t.phase ? `Phase ${t.phase} · ` : ""}
                {STAGE[t.stage] ?? t.stage}
              </span>
            </span>
            <span className="min-w-0">
              {t.page ? (
                <Link href={`/tasks/${t.page}/`} className="font-medium hover:underline">
                  {t.kind === "proposal" ? cleanRequestTitle(t.title) : t.title}
                </Link>
              ) : t.kind === "proposal" && t.issue ? (
                <Link href={`/requests/${t.issue}/`} className="font-medium hover:underline">
                  {cleanRequestTitle(t.title)}
                </Link>
              ) : (
                <span className="font-medium">{t.title}</span>
              )}
              {t.kind === "proposal" && t.requester && (
                <span className="text-sm text-muted-foreground">
                  {" "}
                  · proposed by <span className="font-mono">{t.requester}</span> ·{" "}
                  <a href={`https://github.com/Imbernoulli/ML-Relay/issues/${t.issue}`} target="_blank" rel="noreferrer" className="underline" title="Private repository: GitHub shows 404 unless you are a collaborator.">
                    issue #{t.issue}
                  </a>
                </span>
              )}
              {t.kind === "internal" && t.blurb && <span className="block text-sm text-muted-foreground">{t.blurb}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
