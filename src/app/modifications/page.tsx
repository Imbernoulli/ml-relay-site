import Link from "next/link";
import { loadIndex, loadStatus } from "@/lib/data";
import type { StatusIssue } from "@/lib/types";

export const metadata = { title: "ML-Relay · Modifications" };

const PRIVATE_TIP = "Opens the private Imbernoulli/ML-Relay repository: GitHub shows 404 unless you are a collaborator.";
const PR_STYLE: Record<string, string> = {
  draft: "border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  open: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  merged: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  closed: "border-border bg-muted text-muted-foreground",
};

function Pill({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function Entry({ r, repo, titles }: { r: StatusIssue; repo: string; titles: Map<string, string> }) {
  const taskTitle = r.task ? titles.get(r.task) : undefined;
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {r.task && taskTitle ? (
          <Link href={`/tasks/${r.task}/`} className="text-base font-semibold hover:underline">
            {taskTitle}
          </Link>
        ) : (
          <span className="text-base font-semibold">{r.task ?? "—"}</span>
        )}
        <Pill cls="border-border bg-muted text-foreground">{r.type === "maintenance" ? "maintainer change" : "change request"}</Pill>
        <Pill cls="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300">{r.stage}</Pill>
        <span className="ml-auto text-xs text-muted-foreground">updated {r.updated.slice(0, 10)}</span>
      </div>
      <div className="mt-1 text-sm">{r.title}</div>
      {r.replacement && (
        <div className="mt-1 text-sm text-amber-800 dark:text-amber-200">
          Being replaced by <span className="font-mono">{r.replacement}</span>.
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {r.requester && (
          <span className="text-muted-foreground">
            requested by <span className="font-mono">{r.requester}</span>
          </span>
        )}
        <a href={`https://github.com/${repo}/issues/${r.issue}`} target="_blank" rel="noreferrer" title={PRIVATE_TIP} className="font-mono underline">
          issue #{r.issue}
        </a>
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
      </div>
    </li>
  );
}

export default function ModificationsPage() {
  const status = loadStatus();
  const titles = new Map(loadIndex().tasks.map((t) => [t.id, t.title ?? t.id]));
  const mods = (status.issues ?? []).filter((r) => r.type === "change" || r.type === "maintenance");
  const active = mods.filter((r) => r.state === "open");
  const merged = mods.filter((r) => r.state === "closed" && r.pr_state === "merged").slice(0, 20);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Modifications</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Tasks currently being changed, through a change request or a maintainer change. Links open the private GitHub repo (collaborators only).
      </p>
      <h2 className="mt-8 text-lg font-semibold">In progress ({active.length})</h2>
      {active.length ? (
        <ul className="mt-3 space-y-3">
          {active.map((r) => (
            <Entry key={r.issue} r={r} repo={status.repo} titles={titles} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No task is being changed right now.</p>
      )}
      <h2 className="mt-10 text-lg font-semibold">Recently merged</h2>
      {merged.length ? (
        <ul className="mt-3 space-y-3">
          {merged.map((r) => (
            <Entry key={r.issue} r={r} repo={status.repo} titles={titles} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nothing merged yet.</p>
      )}
    </div>
  );
}
