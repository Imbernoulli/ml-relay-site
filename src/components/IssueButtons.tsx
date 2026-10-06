import Link from "next/link";
import { changeUrl, REQUEST_MODEL } from "@/lib/site";

/** The request-a-change entry point: a post in the task's discussion thread (GitHub's form as a fallback). */
export default function IssueButtons({ task, inSite = true }: { task: string; inSite?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        {inSite ? (
          <>
            <Link
              href={`/tasks/${task}/change/`}
              className="rounded-lg border border-emerald-600/50 bg-emerald-600/10 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:border-emerald-600 dark:text-emerald-200"
            >
              Request a change
            </Link>
            <a href="#discussion" className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-foreground/40">
              Discussion
            </a>
          </>
        ) : null}
        <a
          href={changeUrl(task)}
          target="_blank"
          rel="noreferrer"
          className={
            inSite
              ? "text-xs text-muted-foreground underline"
              : "rounded-lg border border-emerald-600/50 bg-emerald-600/10 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:border-emerald-600 dark:text-emerald-200"
          }
        >
          {inSite ? "Prefer GitHub? Open the form there" : "Request a change"}
        </a>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        One discussion thread per task: requests, method ideas and discussion all go there, and everyone on the task is emailed. {REQUEST_MODEL}
      </p>
    </div>
  );
}
