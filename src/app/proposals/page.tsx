import Link from "next/link";
import { loadIndex, loadStatus, taskTitles } from "@/lib/data";
import LiveRequests from "@/components/LiveRequests";
import RequestGroups from "@/components/RequestGroups";

export const metadata = { title: "ML-Relay · Proposed tasks" };


export default function ProposalsPage() {
  const status = loadStatus();
  const known = new Set(loadIndex().tasks.map((t) => t.id));
  const shipped = status.new_tasks.filter((e) => e.pr_state === "merged" && e.task && known.has(e.task));
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
      <LiveRequests kind="proposals" known={status.new_tasks.map((e) => e.issue)} titles={taskTitles()} maintainers={status.maintainers} repo={status.repo} />
      <RequestGroups
        issues={(status.issues ?? []).filter((r) => r.type === "new task")}
        titles={taskTitles()}
        maintainers={status.maintainers}
        repo={status.repo}
        empty="No proposals yet."
      />
      {shipped.length > 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Shipped from a proposal:{" "}
          {shipped.map((e, i) => (
            <span key={e.issue}>
              {i ? ", " : ""}
              <Link href={`/tasks/${e.task}/`} className="underline">
                {taskTitles()[e.task as string] ?? e.task}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
