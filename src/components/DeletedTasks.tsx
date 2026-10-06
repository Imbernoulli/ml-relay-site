import Link from "next/link";
import type { IndexEntry } from "@/lib/types";
import { DeletedBadge } from "./DeletedBanner";

/** Homepage: tasks removed from ML-Relay. They are not part of the set above, but their pages stay, frozen and marked Deleted. */
export default function DeletedTasks({ tasks, titles = {} }: { tasks: IndexEntry[]; titles?: Record<string, string> }) {
  if (!tasks.length) return null;
  return (
    <section id="deleted" className="mt-10">
      <h2 className="text-lg font-semibold">
        Deleted tasks <span className="text-sm font-normal text-muted-foreground">{tasks.length}</span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Removed from ML-Relay and not counted in the set; each page is kept as the task last shipped.</p>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
        {tasks.map((t) => (
          <li key={t.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="flex shrink-0 items-center gap-2">
              <DeletedBadge />
              <span className="font-mono text-xs text-muted-foreground">{t.deleted?.date}</span>
            </span>
            <span className="min-w-0">
              <Link href={`/tasks/${t.id}/`} className="font-medium hover:underline">
                {t.title ?? t.id}
              </Link>
              {t.deleted?.reason && <span className="text-sm text-muted-foreground"> · {t.deleted.reason}</span>}
              {t.deleted?.replaced_by && (
                <span className="text-sm text-muted-foreground">
                  {" "}
                  Replaced by{" "}
                  <Link href={`/tasks/${t.deleted.replaced_by}/`} className="underline">
                    {titles[t.deleted.replaced_by] ?? t.deleted.replaced_by}
                  </Link>
                  .
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
