import Link from "next/link";
import RequestTrack from "./RequestTrack";
import { fromEntry } from "@/lib/stages";
import type { StatusData, StatusEntry, StatusIssue } from "@/lib/types";
import RequestCard from "./RequestCard";
import { requestState, STATE_ORDER } from "@/lib/requestState";
import MaintainerActions from "./MaintainerActions";

const PRIVATE_TIP = "Opens the private Imbernoulli/ML-Relay repository: GitHub shows 404 unless you are a collaborator.";

function issueUrl(repo: string, n: number) {
  return `https://github.com/${repo}/issues/${n}`;
}
function prUrl(repo: string, n: number) {
  return `https://github.com/${repo}/pull/${n}`;
}

const PR_STYLE: Record<string, string> = {
  draft: "border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  open: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  merged: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  closed: "border-border bg-muted text-muted-foreground",
};

function Pill({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function Links({ e, repo }: { e: StatusEntry; repo: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <a href={issueUrl(repo, e.issue)} target="_blank" rel="noreferrer" title={PRIVATE_TIP} className="font-mono text-xs underline">
        issue #{e.issue}
      </a>
      {e.pr !== null ? (
        <>
          <a href={prUrl(repo, e.pr)} target="_blank" rel="noreferrer" title={PRIVATE_TIP} className="font-mono text-xs underline">
            PR #{e.pr}
          </a>
          {e.pr_state && <Pill cls={PR_STYLE[e.pr_state] ?? PR_STYLE.closed}>PR {e.pr_state}</Pill>}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">no PR yet</span>
      )}
    </span>
  );
}

/** Plain-words stage of a new-task proposal. */
export function proposalStage(e: StatusEntry): string {
  if (e.pr_state === "merged") return "Merged";
  if (e.state === "awaiting reply") return "Waiting for requester";
  if (e.phase === "C") return "Full measurement";
  if (e.phase === "B") return "Building & pilot run";
  return "Design review";
}

export function statusBadge(entries: StatusEntry[] | undefined): string | null {
  if (!entries?.length) return null;
  if (entries.some((e) => e.type === "replacement")) return "being replaced";
  return "change in progress";
}

/** Every request on one task, as cards with what the requester asked for: the open ones (awaiting
 *  approval, approved, in progress) shown, the finished ones (done, declined, closed) folded below. */
export function TaskRequests({ task, status }: { task: string; status: StatusData }) {
  const all = (status.issues ?? []).filter((r) => r.task === task && !(r.replacement && r.state === "open"));
  if (!all.length) return null;
  const order = (r: StatusIssue) => STATE_ORDER.indexOf(requestState(r));
  const open = all.filter((r) => ["awaiting approval", "approved", "in progress"].includes(requestState(r))).sort((a, b) => order(a) - order(b));
  const past = all.filter((r) => !open.includes(r));
  return (
    <section id="requests" className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">Requests on this task</h2>
        <span className="text-xs text-muted-foreground">
          {open.length} open{past.length ? ` · ${past.length} earlier` : ""}
        </span>
      </div>
      {open.length > 0 && (
        <ul className="mt-2 space-y-2">
          {open.map((r) => (
            <RequestCard key={r.issue} r={r} maintainers={status.maintainers} repo={status.repo} />
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            {past.length} earlier request{past.length === 1 ? "" : "s"} (done, declined or closed)
          </summary>
          <ul className="mt-2 space-y-2">
            {past.map((r) => (
              <RequestCard key={r.issue} r={r} maintainers={status.maintainers} repo={status.repo} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Top-of-page status: a banner for a replacement, then every request on the task as a card. */
export default function RequestStatus({ task, status }: { task: string; status: StatusData }) {
  const entries = status.tasks[task] ?? [];
  const repl = entries.filter((e) => e.type === "replacement");
  if (!repl.length && !(status.issues ?? []).some((r) => r.task === task)) return null;
  return (
    <div className="mt-4 space-y-3">
      {repl.map((e) => (
        <div key={e.issue} className="rounded-xl border-2 border-amber-500/60 bg-amber-500/10 px-4 py-3">
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Being rebuilt: this task is being replaced by <span className="font-mono">{e.replacement}</span>
            {e.pr_state === "merged" ? "" : `, blocked on the build of ${e.replacement}`}.
          </div>
          <div className="mt-1 text-sm">{e.title}</div>
          <MaintainerActions issue={e.issue} approval={e.approval} maintainers={status.maintainers} repo={status.repo} />
          <RequestTrack input={fromEntry(e)} issue={e.issue} opened={e.opened} requester={e.requester} approval={e.approval} updated={e.updated} pr={{ number: e.pr, state: e.pr_state }} />
        </div>
      ))}
      <TaskRequests task={task} status={status} />
    </div>
  );
}

/** Index: open new-task proposals and their phase. */
export function NewTaskProposals({ status }: { status: StatusData }) {
  const open = status.new_tasks.filter((e) => e.state !== "closed");
  if (!open.length) return null;
  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-4">
      <h2 className="text-base font-semibold">In progress: proposed new tasks</h2>
      <ul className="mt-2 space-y-2">
        {open.map((e) => (
          <li key={e.issue} className="flex flex-wrap items-center gap-2 text-sm">
<span>{e.title}</span>
            <Links e={e} repo={status.repo} />
            <div className="w-full">
              <RequestTrack input={fromEntry(e)} issue={e.issue} opened={e.opened} requester={e.requester} approval={e.approval} updated={e.updated} compact />
            </div>
            <div className="w-full">
              <MaintainerActions issue={e.issue} approval={e.approval} maintainers={status.maintainers} repo={status.repo} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Each proposal goes through design review, a pilot build, and full measurement; links open the private GitHub repo (collaborators
        only).{" "}
        <Link href="/proposals/" className="underline">
          All proposals
        </Link>
      </p>
    </div>
  );
}
