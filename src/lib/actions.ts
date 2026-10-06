// What each open request is waiting for, and whose move it is ("My work" and the navbar badge).
// Computed from the live status (pushed by the backend the moment a step changes; SSE on the site),
// falling back to the static status.json for issues the live service has no record of.
import type { ProgressStep, StatusIssue } from "./types";
import type { LiveRecord } from "./liveStatus";
import { activeBlock } from "./stages";

export type ActionReason = "approve" | "reply" | "go" | "merge";

export interface PendingAction {
  issue: number;
  title: string;
  requester: string | null;
  type: string;
  reason: ActionReason;
  /** one line for the row: what to do */
  note: string;
  /** whose move: the maintainers always, the requester for replies and go */
  forRequester: boolean;
  /** the task (change requests) and whether the issue is the task's discussion thread */
  task?: string | null;
  thread?: boolean;
}

const NOTE: Record<ActionReason, string> = {
  approve: "approve, give feedback or reject",
  reply: "the agent asked questions: reply on the request",
  go: "phase finished: reply go, or reply with changes",
  merge: "work done: review and merge the PR",
};

function fromSteps(steps: ProgressStep[], labels: string[]): ActionReason | null {
  if (labels.includes("awaiting-approval")) return "approve";
  const b = activeBlock(steps);
  if (b && b.state === "waiting") {
    const l = b.label ?? "";
    if (b.kind === "approval" || /maintainer approval/i.test(l)) return "approve";
    if (/your go/i.test(l)) return "go";
    if (/your answers|your reply/i.test(l)) return "reply";
    if (/maintainer review/i.test(l)) return "merge";
  }
  if (labels.includes("newtask-awaiting-go")) return "go";
  return null;
}

/** Every open request whose next step is a person's, from the live records + the static fallback. */
export function pendingActions(live: Record<string, LiveRecord> | null, staticIssues: StatusIssue[]): PendingAction[] {
  const out: PendingAction[] = [];
  const seen = new Set<number>();
  for (const r of Object.values(live ?? {})) {
    if (!r || r.state === "closed") continue;
    const labels = r.labels ?? [];
    if (labels.includes("relay-test") || labels.includes("relay-maintainer")) continue;
    seen.add(r.issue);
    if (labels.includes("relay-running")) continue; // the agent is working on it right now
    const reason = fromSteps(r.steps ?? [], labels);
    if (!reason) continue;
    out.push({
      issue: r.issue,
      title: r.title,
      requester: r.requester || null,
      type: /new/i.test(r.type) ? "new task" : "change",
      reason,
      note: NOTE[reason],
      forRequester: reason === "reply" || reason === "go",
      task: r.task || null,
      thread: labels.includes("task-thread"),
    });
  }
  for (const s of staticIssues) {
    if (seen.has(s.issue) || s.state !== "open") continue;
    let reason: ActionReason | null = null;
    if (s.approval?.state === "waiting" || s.approval?.state === "feedback") reason = "approve";
    else if (s.waiting) reason = "go";
    else if (s.progress?.steps) reason = fromSteps(s.progress.steps, []);
    if (!reason) continue;
    out.push({ issue: s.issue, title: s.title, requester: s.requester, type: s.type, reason, note: NOTE[reason], forRequester: reason === "reply" || reason === "go", task: s.task, thread: Boolean(s.thread) });
  }
  return out.sort((a, b) => b.issue - a.issue);
}

/** The actions for this viewer: all of them for a maintainer; else replies / go on their own requests, plus
 *  approving rounds on the discussion threads of the tasks they developed. */
export function actionsFor(
  all: PendingAction[],
  login: string | null | undefined,
  maintainer: boolean,
  developers: Record<string, string[]> = {},
): PendingAction[] {
  if (maintainer) return all;
  const me = (login ?? "").toLowerCase();
  if (!me) return [];
  return all.filter(
    (a) =>
      (a.forRequester && (a.requester ?? "").toLowerCase() === me) ||
      (a.reason === "approve" && a.thread && a.task && (developers[a.task] ?? []).some((d) => d.toLowerCase() === me)),
  );
}
