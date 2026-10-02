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

/** The progress record with the approval step first (synthesised from the labels when the record has none). */
export function withApproval(progress: ProgressRecord | null | undefined, a: Approval | null | undefined): ProgressRecord | null {
  if (!a) return progress ?? null;
  const steps = progress?.steps ?? [];
  const own = steps.findIndex((s) => s.kind === "approval");
  const step = { ...(own >= 0 ? steps[own] : {}), ...approvalStep(a) } as ProgressStep;
  if (own >= 0 && steps[own].detail_public && !a.note) step.detail_public = steps[own].detail_public;
  const rest = steps.filter((_, i) => i !== own);
  let current = progress?.current ?? null;
  if (typeof current === "number") current = own >= 0 ? (current === own ? 0 : current < own ? current + 1 : current) : current + 1;
  if (current === null && !rest.length) current = 0;
  return { current, steps: [step, ...rest] };
}
