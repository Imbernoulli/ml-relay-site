"use client";

import Link from "next/link";
import RequestTrack from "./RequestTrack";
import { useEffect, useState } from "react";
import { getToken, isSignedIn } from "@/lib/github";
import { useLiveStatus } from "@/lib/liveStatus";
import { toMs } from "@/lib/stages";
import { cleanRequestTitle, type TaskTitles } from "@/lib/requestTitle";
import { approvalOf, approvalStep } from "@/lib/approval";
import type { Approval, ProgressRecord } from "@/lib/types";
import MaintainerActions from "./MaintainerActions";

// For signed-in visitors: open relay issues fetched live from the GitHub API with their
// own token, so a request shows the moment it is filed. Issues the static status data
// already has are left to it; the rest are shown here, marked "syncing".

const EXCLUDE = new Set(["relay-test", "relay-allow-shared"]);
const TASK = "[a-z0-9][a-z0-9-]*[a-z0-9]";
const CHANGE_RE = new RegExp(`^\\s*\\[(?:change|relay|maintainer)\\]\\s*(${TASK})`, "i");
const FORM_TASK_RE = new RegExp(`^###\\s*Task\\s*\\n+\\s*(${TASK})\\s*$`, "mi");

interface RawIssue {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  body?: string | null;
  user?: { login: string } | null;
  labels: { name: string }[];
  pull_request?: unknown;
}

interface Live {
  number: number;
  title: string;
  url: string;
  opened: string;
  requester: string | null;
  task: string | null;
  approval: Approval;
  auto: boolean;
}

export default function LiveRequests({
  kind,
  known,
  titles,
  maintainers = [],
  repo,
}: {
  kind: "proposals" | "modifications";
  known: number[];
  titles: TaskTitles;
  maintainers?: string[];
  repo: string;
}) {
  const [items, setItems] = useState<Live[]>([]);
  useEffect(() => {
    if (!isSignedIn()) return;
    const tok = getToken();
    if (!tok) return;
    const labels = kind === "proposals" ? ["relay-newtask"] : ["relay-request", "relay-maintainer"];
    const have = new Set(known);
    let live = true;
    Promise.all(
      labels.map((l) =>
        fetch(`https://api.github.com/repos/${repo}/issues?state=open&labels=${l}&per_page=50&sort=created&direction=desc`, {
          headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json" },
          cache: "no-store",
        }).then((r) => (r.ok ? (r.json() as Promise<RawIssue[]>) : [])),
      ),
    )
      .then((lists) => {
        if (!live) return;
        const seen = new Set<number>();
        const out: Live[] = [];
        for (const it of lists.flat()) {
          if (it.pull_request || seen.has(it.number) || have.has(it.number)) continue;
          seen.add(it.number);
          const ls = it.labels.map((x) => x.name);
          if (ls.some((x) => EXCLUDE.has(x))) continue;
          let task: string | null = null;
          if (kind === "modifications") {
            const m = CHANGE_RE.exec(it.title) ?? FORM_TASK_RE.exec(it.body ?? "");
            task = m && m[1] in titles ? m[1] : null;
            if (!task) continue; // not tied to exactly one task: never shown
          }
          const author = it.user?.login ?? null;
          const { a, auto } = approvalOf(ls, author, maintainers);
          out.push({ number: it.number, title: cleanRequestTitle(it.title, titles), url: it.html_url, opened: it.created_at, requester: author, task, approval: a, auto });
        }
        setItems(out.sort((x, y) => y.number - x.number));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [kind, known, titles, maintainers, repo]);

  // requests the backend has pushed live (works signed out too)
  const liveAll = useLiveStatus();
  const have = new Set([...known, ...items.map((x) => x.number)]);
  const pushed: Live[] = [];
  for (const r of Object.values(liveAll ?? {})) {
    if (!r || have.has(r.issue) || r.state === "closed") continue;
    const ls = r.labels ?? [];
    if (ls.some((x) => EXCLUDE.has(x))) continue;
    const isNew = ls.includes("relay-newtask") || /new/i.test(r.type);
    if ((kind === "proposals") !== isNew) continue;
    const task = kind === "modifications" ? (r.task && r.task in titles ? r.task : null) : null;
    if (kind === "modifications" && !task) continue;
    const { a, auto } = approvalOf(ls, r.requester || null, maintainers);
    pushed.push({ number: r.issue, title: cleanRequestTitle(r.title, titles), url: `https://github.com/${repo}/issues/${r.issue}`, opened: Number.isFinite(toMs(r.steps?.[0]?.t)) ? new Date(toMs(r.steps?.[0]?.t)).toISOString() : r.updated, requester: r.requester || null, task, approval: a, auto });
  }
  const all = [...items, ...pushed].sort((x, y) => y.number - x.number);
  if (!all.length) return null;
  return (
    <div className="mt-3 space-y-3">
      {all.map((x) => {
        const step = approvalStep(x.approval);
        if (x.auto) step.label = "Auto-approved (opened by a maintainer)";
        const progress: ProgressRecord = { current: 0, steps: [step] };
        return (
          <div key={x.number} id={`issue-${x.number}`} className="scroll-mt-20 rounded-xl border border-dashed border-sky-500/60 bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-base font-semibold leading-snug">
                {x.task ? (
                  <>
                    <Link href={`/tasks/${x.task}/`} className="hover:underline">
                      {titles[x.task] ?? x.task}
                    </Link>
                    <span className="font-normal text-muted-foreground"> · {x.title}</span>
                  </>
                ) : (
                  x.title
                )}
              </h2>
              <span
                title="Filed moments ago: the published status catches up after the next sync (a few minutes)"
                className="whitespace-nowrap rounded-full border border-sky-500/50 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-200"
              >
                syncing
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {x.requester ? (
                <>
                  {kind === "proposals" ? "proposed" : "requested"} by <span className="font-mono">{x.requester}</span>
                </>
              ) : null}{" "}
              · opened {x.opened.slice(0, 10)}
            </div>
            <RequestTrack input={{ newTask: kind === "proposals", approval: x.approval, progress, since: x.opened }} issue={x.number} opened={x.opened} requester={x.requester} approval={x.approval} updated={x.opened} />
            <MaintainerActions issue={x.number} approval={x.approval} maintainers={maintainers} repo={repo} />
            <div className="mt-3 text-xs">
              <a href={x.url} target="_blank" rel="noreferrer" className="font-mono underline">
                issue #{x.number}
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
