// Maintainer approval: every proposal and change request first waits for a maintainer
// (labels awaiting-approval -> approved; "/approve [notes]", "/reject <reason>", any
// other maintainer comment is feedback). It is the first step of every request timeline.
import type { Approval, ProgressRecord, ProgressStep } from "./types";

export function approvalLabel(a: Approval): string {
  if (a.state === "approved") return a.by ? `Approved by @${a.by}` : "Approved by a maintainer";
  if (a.state === "rejected") return "Rejected";
  if (a.state === "feedback") return "Maintainer feedback";
  return "Waiting for maintainer approval";
}

export function approvalStep(a: Approval): ProgressStep {
  const state = a.state === "approved" ? "done" : a.state === "rejected" ? "failed" : "waiting";
  return { kind: "approval", state, label: approvalLabel(a), ...(a.note ? { detail_public: a.note } : {}) };
}

/** The progress record with the approval step first: the record's own approval
 *  step (as the backend labelled it) moved to the front, else one synthesised from the labels. */
export function withApproval(progress: ProgressRecord | null | undefined, a: Approval | null | undefined): ProgressRecord | null {
  const steps = progress?.steps ?? [];
  const own = steps.findIndex((s) => s.kind === "approval");
  if (own < 0 && !a) return progress ?? null;
  const step = own >= 0 ? steps[own] : approvalStep(a!);
  const rest = steps.filter((_, i) => i !== own);
  let current = progress?.current ?? null;
  if (typeof current === "number") current = own >= 0 ? (current === own ? 0 : current < own ? current + 1 : current) : current + 1;
  if (current === null && !rest.length) current = 0;
  return { current, steps: [step, ...rest] };
}
