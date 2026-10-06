import Link from "next/link";
import type { DeletedInfo } from "@/lib/types";

/** The small "Deleted" pill used in lists and on the page header. */
export function DeletedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-red-600/50 bg-red-600/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 dark:text-red-200">
      Deleted
    </span>
  );
}

/** Banner on the page of a task removed from ML-Relay: when, why, and what replaced it. The page below is frozen at its last shipped version. */
export default function DeletedBanner({ info, titles = {} }: { info: DeletedInfo; titles?: Record<string, string> }) {
  return (
    <div role="note" className="mt-3 rounded-xl border-2 border-red-600/40 bg-red-600/5 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <DeletedBadge />
        <span className="font-medium">Removed from ML-Relay on {info.date}</span>
        {info.pr ? <span className="text-muted-foreground">(ML-Relay PR #{info.pr})</span> : null}
      </div>
      {info.reason && <p className="mt-2 text-sm">{info.reason}</p>}
      {info.replaced_by && (
        <p className="mt-1 text-sm">
          Replaced by{" "}
          <Link href={`/tasks/${info.replaced_by}/`} className="font-medium underline">
            {titles[info.replaced_by] ?? info.replaced_by}
          </Link>
          .
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        This page is kept as the task last shipped: description, code, baselines, results, people and its discussion stay readable. It no longer takes
        requests and is not counted in the set.
      </p>
    </div>
  );
}
