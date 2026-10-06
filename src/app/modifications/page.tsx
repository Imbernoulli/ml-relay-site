import Link from "next/link";
import RequestTrack from "@/components/RequestTrack";
import { fromIssue } from "@/lib/stages";
import { loadDeleted, loadIndex, loadStatus, taskTitles } from "@/lib/data";
import LiveRequests from "@/components/LiveRequests";
import type { StatusIssue } from "@/lib/types";
import MaintainerActions from "@/components/MaintainerActions";

export const metadata = { title: "ML-Relay · Modifications" };


function Pill({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function Entry({ r, repo, titles, maintainers }: { r: StatusIssue; repo: string; titles: Map<string, string>; maintainers?: string[] }) {
  const taskTitle = r.task ? titles.get(r.task) : undefined;
  return (
    <li id={`issue-${r.issue}`} className="scroll-mt-20 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {r.task && taskTitle ? (
          <Link href={`/tasks/${r.task}/`} className="text-base font-semibold hover:underline">
            {taskTitle}
          </Link>
        ) : (
          <span className="text-base font-semibold">{r.task ?? "—"}</span>
        )}
        <Pill cls="border-border bg-muted text-foreground">{r.type === "maintenance" ? "maintainer change" : "change request"}</Pill>
      </div>
      <div className="mt-1 text-sm">
        {r.title}
        {r.requester && (
          <span className="text-xs text-muted-foreground">
            {" "}
            · requested by <span className="font-mono">{r.requester}</span>
          </span>
        )}
      </div>
      {r.replacement && (
        <div className="mt-1 text-sm text-amber-800 dark:text-amber-200">
          Being replaced by <span className="font-mono">{r.replacement}</span>.
        </div>
      )}
      <MaintainerActions issue={r.issue} approval={r.approval} maintainers={maintainers} repo={repo} />
      <RequestTrack input={fromIssue(r)} issue={r.issue} opened={r.opened} requester={r.requester} approval={r.approval} updated={r.updated} pr={{ number: r.pr, state: r.pr_state }} />
    </li>
  );
}

export default function ModificationsPage() {
  const status = loadStatus();
  const titles = new Map([...loadDeleted(), ...loadIndex().tasks].map((t) => [t.id, t.title ?? t.id]));
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
      <LiveRequests kind="modifications" known={(status.issues ?? []).map((r) => r.issue)} titles={taskTitles()} maintainers={status.maintainers} repo={status.repo} />
      {active.length ? (
        <ul className="mt-3 space-y-3">
          {active.map((r) => (
            <Entry key={r.issue} r={r} repo={status.repo} titles={titles} maintainers={status.maintainers} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No task is being changed right now.</p>
      )}
      <h2 className="mt-10 text-lg font-semibold">Recently merged</h2>
      {merged.length ? (
        <ul className="mt-3 space-y-3">
          {merged.map((r) => (
            <Entry key={r.issue} r={r} repo={status.repo} titles={titles} maintainers={status.maintainers} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nothing merged yet.</p>
      )}
    </div>
  );
}
