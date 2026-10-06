import type { StatusIssue } from "@/lib/types";
import type { TaskTitles } from "@/lib/requestTitle";
import { requestState, STATE_ORDER, type RequestState } from "@/lib/requestState";
import RequestCard from "./RequestCard";

const HEADING: Record<RequestState, string> = {
  "awaiting approval": "Awaiting approval",
  "in progress": "In progress",
  approved: "Approved, not started",
  done: "Done",
  declined: "Declined",
  closed: "Closed",
};

/** Requests grouped by state, each as a card with what the requester asked for. */
export default function RequestGroups({
  issues,
  titles,
  showTask = false,
  maintainers,
  repo,
  empty,
}: {
  issues: StatusIssue[];
  titles: TaskTitles;
  showTask?: boolean;
  maintainers?: string[];
  repo: string;
  empty: string;
}) {
  if (!issues.length) return <p className="mt-2 text-sm text-muted-foreground">{empty}</p>;
  const groups = STATE_ORDER.map((s) => [s, issues.filter((r) => requestState(r) === s)] as const).filter(([, rs]) => rs.length);
  return (
    <div className="mt-4 space-y-8">
      {groups.map(([s, rs]) => (
        <section key={s}>
          <h2 className="text-lg font-semibold">
            {HEADING[s]} <span className="text-sm font-normal text-muted-foreground">{rs.length}</span>
          </h2>
          <ul className="mt-3 space-y-3">
            {rs.map((r) => (
              <RequestCard key={r.issue} r={r} titles={titles} showTask={showTask} maintainers={maintainers} repo={repo} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
