import Link from "next/link";
import { changeUrl, feedbackUrl } from "@/lib/site";

/** Feedback and change-request links: GitHub issues in the private ML-Relay repo. */
export default function IssueButtons({ task }: { task: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <a
          href={feedbackUrl(task)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm font-medium hover:border-foreground/40"
        >
          Give feedback
        </a>
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
        Both open a GitHub issue in the private Imbernoulli/ML-Relay repository; only its collaborators can open them. Feedback is read by the
        team. A change request (label <code>relay-request</code>) starts the relay agent on the task. Proposing a new task explains the new-task form first. GitHub emails you on every reply.
      </p>
    </div>
  );
}
