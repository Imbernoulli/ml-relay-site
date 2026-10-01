import Link from "next/link";
import { changeUrl, REQUEST_MODEL } from "@/lib/site";

/** Request-a-change and propose-a-task entry points (GitHub issues in the private ML-Relay repo). */
export default function IssueButtons({ task }: { task: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <a
          href={changeUrl(task)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-emerald-600/50 bg-emerald-600/10 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:border-emerald-600 dark:text-emerald-200"
        >
          Request a change
        </a>
        <Link href="/propose/" className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-foreground/40">
          Propose a new task
        </Link>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {REQUEST_MODEL} Requests go to the private Imbernoulli/ML-Relay repository; only its collaborators can open them, and GitHub emails you on
        every reply.
      </p>
    </div>
  );
}
