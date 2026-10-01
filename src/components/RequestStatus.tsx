import Link from "next/link";
import type { StatusData, StatusEntry } from "@/lib/types";

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

/** Top-of-page status: a banner for a replacement, a compact list for other requests. */
export default function RequestStatus({ task, status }: { task: string; status: StatusData }) {
  const entries = status.tasks[task] ?? [];
  if (!entries.length) return null;
  const repl = entries.filter((e) => e.type === "replacement");
  const other = entries.filter((e) => e.type !== "replacement");
  return (
    <div className="mt-4 space-y-3">
      {repl.map((e) => (
        <div key={e.issue} className="rounded-xl border-2 border-amber-500/60 bg-amber-500/10 px-4 py-3">
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Being rebuilt: this task is being replaced by <span className="font-mono">{e.replacement}</span>
            {e.pr_state === "merged" ? "" : `, blocked on the build of ${e.replacement}`}.
          </div>
          <div className="mt-1 text-sm">{e.title}</div>
          <div className="mt-2">
            <Links e={e} repo={status.repo} />
          </div>
        </div>
      ))}
      {other.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status: open requests</div>
          <ul className="mt-2 space-y-2">
            {other.map((e) => (
              <li key={e.issue} className="flex flex-wrap items-center gap-2 text-sm">
                <Pill cls="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300">{e.state === "running" ? "agent running" : "change requested"}</Pill>
                <span>{e.title}</span>
                <Links e={e} repo={status.repo} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Issue and PR links go to the private Imbernoulli/ML-Relay repository and show 404 to non-collaborators.</p>
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
            <Pill cls="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              {proposalStage(e)}
            </Pill>
            <span>{e.title}</span>
            <Links e={e} repo={status.repo} />
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
