import { loadStatus, taskTitles } from "@/lib/data";
import LiveRequests from "@/components/LiveRequests";
import RequestGroups from "@/components/RequestGroups";

export const metadata = { title: "ML-Relay · Modifications" };

/** Every change request and maintainer change, grouped by state (awaiting approval, in progress, done, declined),
 *  each card showing what the requester asked for. */
export default function ModificationsPage() {
  const status = loadStatus();
  const titles = taskTitles();
  const mods = (status.issues ?? []).filter((r) => r.type === "change" || r.type === "maintenance");
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Modifications</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Every request to change a task: the ones waiting for a maintainer, the ones being worked on, and the finished and declined ones.
        Collaborators who sign in with GitHub also see what each requester asked for and the discussion.
      </p>
      <LiveRequests kind="modifications" known={(status.issues ?? []).map((r) => r.issue)} titles={titles} maintainers={status.maintainers} repo={status.repo} />
      <RequestGroups issues={mods} titles={titles} showTask maintainers={status.maintainers} repo={status.repo} empty="No change requests yet." />
    </div>
  );
}
