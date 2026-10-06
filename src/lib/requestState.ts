// One plain-words state per request, for cards and lists: awaiting approval / approved / in progress /
// done / declined / closed.
import type { StatusIssue } from "./types";

export type RequestState = "awaiting approval" | "approved" | "in progress" | "done" | "declined" | "closed";

export function requestState(r: StatusIssue): RequestState {
  const a = r.approval?.state;
  if (a === "rejected") return "declined";
  if (r.pr_state === "merged" || r.stage === "Merged") return "done";
  if (r.state === "closed") return "closed";
  if (a === "waiting" || a === "feedback" || r.stage === "Waiting for maintainer approval") return "awaiting approval";
  if (r.pr || r.phase || r.stage === "Agent working" || r.waiting || r.stage === "PR in review" || r.stage === "Draft PR") return "in progress";
  return "approved";
}

export const STATE_STYLE: Record<RequestState, string> = {
  "awaiting approval": "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  approved: "border-sky-500/50 bg-sky-500/10 text-sky-900 dark:text-sky-200",
  "in progress": "border-emerald-600/50 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200",
  done: "border-violet-500/50 bg-violet-500/10 text-violet-900 dark:text-violet-200",
  declined: "border-red-600/50 bg-red-600/10 text-red-900 dark:text-red-200",
  closed: "border-border bg-muted text-muted-foreground",
};

export const STATE_ORDER: RequestState[] = ["awaiting approval", "in progress", "approved", "done", "declined", "closed"];
