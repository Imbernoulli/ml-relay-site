import Link from "next/link";
import { loadIndex, loadStatus } from "@/lib/data";
import type { StatusEntry } from "@/lib/types";
import ProgressTimeline from "@/components/ProgressTimeline";
import PrivateStatus from "@/components/PrivateStatus";

export const metadata = { title: "ML-Relay · Proposed tasks" };

const STAGES = ["Design review", "Building & pilot run", "Full measurement", "Merged"];
const PRIVATE_TIP = "Opens the private Imbernoulli/ML-Relay repository: GitHub shows 404 unless you are a collaborator.";

function stageIndex(e: StatusEntry): number {
  if (e.pr_state === "merged") return 3;
  if (e.phase === "C") return 2;
  if (e.phase === "B") return 1;
  return 0;
}

function day(iso?: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

function Timeline({ e }: { e: StatusEntry }) {
  const cur = stageIndex(e);
  const closedUnmerged = e.state === "closed" && e.pr_state !== "merged";
  return (
    <ol className="mt-3 grid grid-cols-4 gap-1">
      {STAGES.map((s, i) => {
        const done = i < cur || (i === cur && i === 3);
        const active = i === cur && i !== 3 && !closedUnmerged;
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

function ProposalCard({ e, repo, known }: { e: StatusEntry; repo: string; known: Set<string> }) {
  const opened = day(e.opened);
  const merged = e.pr_state === "merged";
  const statusText = merged
    ? "merged"
    : e.state === "closed"
      ? "closed"
      : e.state === "awaiting reply"
        ? "Waiting for requester"
        : e.state === "running"
          ? "agent working"
          : "in progress";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-snug">{e.title}</h2>
        <span className="whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {statusText}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {e.requester ? (
          <>
            proposed by <span className="font-mono">{e.requester}</span>
          </>
        ) : (
          "proposed"
        )}
        {opened && <> · opened {opened}</>}
      </div>
      {e.progress?.steps?.length ? <ProgressTimeline progress={e.progress} /> : <Timeline e={e} />}
      <PrivateStatus issue={e.issue} />
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <a href={`https://github.com/${repo}/issues/${e.issue}`} target="_blank" rel="noreferrer" title={PRIVATE_TIP} className="font-mono underline">
          issue #{e.issue}
        </a>
        {e.pr !== null ? (
          <a href={`https://github.com/${repo}/pull/${e.pr}`} target="_blank" rel="noreferrer" title={PRIVATE_TIP} className="font-mono underline">
            PR #{e.pr}
            {e.pr_state ? ` (${e.pr_state})` : ""}
          </a>
        ) : (
          <span className="text-muted-foreground">no PR yet</span>
        )}
        {merged && e.task && known.has(e.task) && (
          <Link href={`/tasks/${e.task}/`} className="font-medium underline">
            Open the task page
          </Link>
        )}
      </div>
    </div>
  );
}

export default function ProposalsPage() {
  const status = loadStatus();
  const known = new Set(loadIndex().tasks.map((t) => t.id));
  const open = status.new_tasks.filter((e) => e.state !== "closed");
  const finished = status.new_tasks.filter((e) => e.state === "closed");
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Proposed tasks</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        New tasks proposed through the new-task form. Each proposal goes through design review, a pilot build, and full measurement, and joins
        the set when its pull request is merged; links open the private GitHub repo (collaborators only).
      </p>
      <div className="mt-4">
        <Link
          href="/propose/new/"
          className="rounded-lg border border-emerald-600/60 bg-emerald-600/15 px-4 py-2 text-sm font-semibold text-emerald-800 hover:border-emerald-600 dark:text-emerald-200"
        >
          Propose a new task
        </Link>
      </div>
      <h2 className="mt-8 text-lg font-semibold">In progress</h2>
      {open.length ? (
        <div className="mt-3 space-y-3">
          {open.map((e) => (
            <ProposalCard key={e.issue} e={e} repo={status.repo} known={known} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No proposals in progress.</p>
      )}
      {finished.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Finished</h2>
          <div className="mt-3 space-y-3">
            {finished.map((e) => (
              <ProposalCard key={e.issue} e={e} repo={status.repo} known={known} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
