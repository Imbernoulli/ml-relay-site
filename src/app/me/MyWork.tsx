"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import type { StatusData, StatusIssue } from "@/lib/types";
import { NEW_TASK_FORM, RELAY_REPO } from "@/lib/site";
import AgentReplies from "./AgentReplies";

// "My work" needs no sign-in: it lists the visitor's requests from the public
// status.json (numbers, titles, stages, PR states), keyed by a GitHub username
// the visitor types once (localStorage) or passes as ?user=<login>.
const USER_KEY = "mlrelay-gh-user";
const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

const PR_STYLE: Record<string, string> = {
  draft: "border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  open: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  merged: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  closed: "border-border bg-muted text-muted-foreground",
};
const PRIVATE_TIP = "Opens the private Imbernoulli/ML-Relay repository: GitHub shows 404 unless you are a collaborator.";

function Pill({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

const NEW_TASK_STAGES = ["Design review", "Building & pilot run", "Full measurement", "Merged"];
const CHANGE_STAGES = ["Requested", "Agent working", "PR in review", "Merged"];

function stageIndex(r: StatusIssue, stages: string[]): number {
  if (r.pr_state === "merged") return stages.length - 1;
  if (r.type === "new task") return Math.max(0, stages.indexOf(r.stage));
  if (r.pr_state === "open") return 2;
  if (r.pr_state === "draft" || r.stage === "Agent working") return 1;
  return 0;
}

function Timeline({ r }: { r: StatusIssue }) {
  const stages = r.type === "new task" ? NEW_TASK_STAGES : CHANGE_STAGES;
  const cur = stageIndex(r, stages);
  const last = stages.length - 1;
  const stopped = r.state === "closed" && r.pr_state !== "merged";
  return (
    <ol className="mt-3 grid grid-cols-4 gap-1">
      {stages.map((s, i) => {
        const done = i < cur || (i === cur && i === last);
        const active = i === cur && i !== last && !stopped;
        return (
          <li key={s} className="min-w-0">
            <div className={`h-1.5 rounded-full ${done ? "bg-emerald-500" : active ? "bg-amber-500" : "bg-muted"}`} />
            <div className={`mt-1 text-[11px] leading-tight ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s}</div>
          </li>
        );
      })}
    </ol>
  );
}

function RequestCard({ r, repo, known }: { r: StatusIssue; repo: string; known: Set<string> }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Pill cls="border-border bg-muted text-foreground">{r.type}</Pill>
        <Pill cls="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300">{r.stage}</Pill>
        {r.waiting && r.state === "open" && (
          <Pill cls="border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200">waiting for your reply</Pill>
        )}
        <span className="ml-auto text-xs text-muted-foreground">updated {r.updated.slice(0, 10)}</span>
      </div>
      <a href={`https://github.com/${repo}/issues/${r.issue}`} target="_blank" rel="noreferrer" title={PRIVATE_TIP} className="mt-2 block text-base font-semibold hover:underline">
        #{r.issue} {r.title}
      </a>
      <Timeline r={r} />
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {r.pr !== null ? (
          <>
            <a href={`https://github.com/${repo}/pull/${r.pr}`} target="_blank" rel="noreferrer" title={PRIVATE_TIP} className="font-mono underline">
              PR #{r.pr}
            </a>
            {r.pr_state && <Pill cls={PR_STYLE[r.pr_state] ?? PR_STYLE.closed}>PR {r.pr_state}</Pill>}
          </>
        ) : (
          <span className="text-muted-foreground">no PR yet</span>
        )}
        {r.task && known.has(r.task) && (
          <Link href={`/tasks/${r.task}/`} className="underline">
            task page
          </Link>
        )}
        <a href={`https://github.com/${repo}/issues/${r.issue}`} target="_blank" rel="noreferrer" title={PRIVATE_TIP} className="underline">
          reply on GitHub
        </a>
      </div>
    </Card>
  );
}

export default function MyWork({ status, knownTasks }: { status: StatusData; knownTasks: string[] }) {
  const [user, setUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("user");
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(USER_KEY);
    } catch {}
    const u = q && LOGIN_RE.test(q) ? q : saved && LOGIN_RE.test(saved) ? saved : null;
    if (q && u === q) {
      try {
        localStorage.setItem(USER_KEY, q);
      } catch {}
    }
    setUser(u);
    setReady(true);
  }, []);

  const save = (u: string) => {
    const v = u.trim().replace(/^@/, "");
    if (!LOGIN_RE.test(v)) return;
    try {
      localStorage.setItem(USER_KEY, v);
    } catch {}
    setUser(v);
    setEditing(false);
    const url = new URL(window.location.href);
    url.searchParams.set("user", v);
    window.history.replaceState(null, "", url.toString());
  };

  if (!ready) return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;

  if (!user || editing) {
    return (
      <Card className="mt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(draft);
          }}
        >
          <label htmlFor="ghuser" className="text-sm font-semibold">
            Your GitHub username
          </label>
          <p className="mt-1 text-xs text-muted-foreground">Remembered in this browser. No sign-in needed.</p>
          <div className="mt-2 flex gap-2">
            <input
              id="ghuser"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="octocat"
              autoComplete="username"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm"
            />
            <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              Show my requests
            </button>
          </div>
        </form>
      </Card>
    );
  }

  const known = new Set(knownTasks);
  const mine = (status.issues ?? []).filter((r) => (r.requester ?? "").toLowerCase() === user.toLowerCase());
  const open = mine.filter((r) => r.state === "open");
  const closed = mine.filter((r) => r.state !== "open");
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          Requests by <span className="font-mono font-semibold">{user}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setDraft(user);
            setEditing(true);
          }}
          className="text-xs underline"
        >
          change
        </button>
        {status.generated && <span className="ml-auto text-xs text-muted-foreground">as of {status.generated.slice(0, 16).replace("T", " ")} UTC</span>}
      </div>

      {mine.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm">No requests by {user} yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Request a change from any task page, or{" "}
            <a href={NEW_TASK_FORM} target="_blank" rel="noreferrer" className="underline">
              propose a new task
            </a>
            .
          </p>
        </Card>
      ) : (
        <>
          <h2 className="mt-6 text-lg font-semibold">Open ({open.length})</h2>
          <div className="mt-2 space-y-3">
            {open.length ? open.map((r) => <RequestCard key={r.issue} r={r} repo={status.repo} known={known} />) : <p className="text-sm text-muted-foreground">None.</p>}
          </div>
          {closed.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Closed ({closed.length})</h2>
              <div className="mt-2 space-y-3">
                {closed.map((r) => (
                  <RequestCard key={r.issue} r={r} repo={status.repo} known={known} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <details className="group mt-10 rounded-xl border border-border bg-card">
        <summary className="flex items-center gap-2 px-4 py-3 text-sm font-medium">
          <span className="chev text-muted-foreground">▸</span>
          Show the agent&apos;s latest replies (sign in)
        </summary>
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Optional. Reading reply excerpts needs read access to the private {RELAY_REPO} repository, so it uses your own GitHub access in this browser.
          </p>
          <AgentReplies />
        </div>
      </details>
    </div>
  );
}
