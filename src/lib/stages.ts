// Request stages (the horizontal bar) and step helpers, shared by server and client code.
// Stages come from the labels (via the status data: approval, phase, awaiting-go, done)
// and the PR state; the detailed progress steps refine the current stage.
import type { Approval, ProgressRecord, ProgressStep, StatusEntry, StatusIssue } from "./types";

export interface StageInput {
  newTask: boolean;
  approval?: Approval | null;
  phase?: string | null;
  waitingGo?: boolean;
  running?: boolean;
  done?: boolean;
  closed?: boolean;
  prState?: "draft" | "open" | "merged" | "closed" | null;
  progress?: ProgressRecord | null;
  since?: string | number | null;
}

export type Mark = "done" | "current" | "paused" | "failed" | "upcoming";

const NEW_TASK = ["Created", "Maintainer approval", "Design review", "Build & pilot", "Full measurement", "Merged"];
const CHANGE = ["Created", "Maintainer approval", "Agent working", "PR open", "Merged"];

export function toMs(t?: string | number | null): number {
  if (t === undefined || t === null || t === "") return NaN;
  if (typeof t === "number") return t < 1e12 ? t * 1000 : t;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t) < 1e12 ? Number(t) * 1000 : Number(t);
  return Date.parse(t);
}

const RESTART_RE = /\b(started|queued|gate passed|retrying now|resumed|restarted)\b/i;
export const GO_RE = /requester'?s go|your go|waiting for (the )?requester/i;

/** A failed or paused step is superseded once a later attempt starts (or a later step runs). */
export function supersededSet(steps: ProgressStep[]): Set<number> {
  const out = new Set<number>();
  steps.forEach((s, i) => {
    if (s.kind === "approval" || s.kind === "created") return;
    if (s.state !== "failed" && s.state !== "waiting") return;
    if (steps.slice(i + 1).some((t) => t.state === "running" || (t.state === "done" && RESTART_RE.test(t.label ?? "")))) out.add(i);
  });
  return out;
}

/** The step that currently holds the request up (the last failed / paused step not superseded). */
export function activeBlock(steps: ProgressStep[]): ProgressStep | null {
  const sup = supersededSet(steps);
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.kind === "approval" || s.kind === "created" || sup.has(i)) continue;
    if (s.state === "failed" || s.state === "waiting") return s;
    if (s.state === "running") return null;
  }
  return null;
}

export function computeStages(x: StageInput): { names: string[]; marks: Mark[]; cur: number; note: string | null; since: number } {
  const names = [...(x.newTask ? NEW_TASK : CHANGE)];
  const last = names.length - 1;
  let cur: number;
  let curMark: Mark = "current";
  let note: string | null = null;
  const a = x.approval;
  if (x.prState === "merged" || (x.newTask && x.done)) cur = last + 1;
  else if (a && (a.state === "waiting" || a.state === "feedback")) {
    cur = 1;
    curMark = "paused";
    note = a.state === "feedback" ? "Maintainer feedback" : "Waiting for maintainer approval";
  } else if (a?.state === "rejected") {
    cur = 1;
    curMark = "failed";
    note = "Rejected";
  } else if (x.newTask) cur = x.phase === "C" ? 4 : x.phase === "B" ? 3 : 2;
  else cur = x.prState === "open" ? 3 : 2;
  const steps = x.progress?.steps ?? [];
  const block = activeBlock(steps);
  if (cur > 1 && cur <= last) {
    if (x.waitingGo || (block && block.state === "waiting" && GO_RE.test(block.label ?? ""))) {
      curMark = "paused";
      note = "Waiting for your go";
    } else if (block?.state === "waiting") {
      curMark = "paused";
      note = block.label ?? "Paused";
    } else if (block?.state === "failed") {
      curMark = "failed";
      note = block.label ?? "Failed";
    }
  }
  if (x.closed && cur <= last) {
    curMark = "failed";
    note = note ?? "Closed";
  }
  const marks: Mark[] = names.map((_, i) => (i < cur ? "done" : i === cur ? curMark : "upcoming"));
  const lastStep = steps.length ? steps[steps.length - 1] : null;
  return { names, marks, cur: Math.min(cur, last), note, since: toMs(lastStep?.t ?? x.since ?? null) };
}

/** The "Request created by @login" step first (unless the record already has it). */
export function withCreated(progress: ProgressRecord | null | undefined, opened: string | null | undefined, by: string | null | undefined): ProgressRecord | null {
  if (!opened) return progress ?? null;
  const steps = progress?.steps ?? [];
  const own = steps.findIndex((s) => s.kind === "created" || /request created/i.test(s.label ?? ""));
  const step: ProgressStep = own >= 0 ? steps[own] : { kind: "created", state: "done", label: by ? `Request created by @${by}` : "Request created", t: opened };
  const rest = steps.filter((_, i) => i !== own);
  let current = progress?.current ?? null;
  if (typeof current === "number") current = own >= 0 ? (current === own ? 0 : current < own ? current + 1 : current) : current + 1;
  return { current, steps: [step, ...rest] };
}

/** Stage input from a status entry (task status block, Proposals, homepage). */
export function fromEntry(e: StatusEntry): StageInput {
  return {
    newTask: e.type === "new task",
    approval: e.approval,
    phase: e.phase,
    waitingGo: e.state === "awaiting reply",
    running: e.state === "running",
    done: e.done,
    closed: e.state === "closed" && e.pr_state !== "merged" && !e.done,
    prState: e.pr_state,
    progress: e.progress,
    since: e.opened ?? e.updated,
  };
}

/** Stage input from an issue record (Modifications, My work). */
export function fromIssue(r: StatusIssue): StageInput {
  return {
    newTask: r.type === "new task",
    approval: r.approval,
    phase: r.phase,
    waitingGo: r.waiting && r.state === "open",
    running: r.stage === "Agent working",
    done: r.stage === "Merged",
    closed: r.state === "closed" && r.pr_state !== "merged",
    prState: r.pr_state,
    progress: r.progress,
    since: r.opened ?? r.updated,
  };
}

// ---- the agent's live status comment (signed-in visitors) ----
/** Rows of the status comment's table "| time (UTC) | state | step | details |" -> steps. */
export function parseStatusTable(body: string, updatedIso: string): ProgressStep[] {
  const year = new Date(Date.parse(updatedIso) || Date.now()).getUTCFullYear();
  const steps: ProgressStep[] = [];
  for (const line of body.split("\n")) {
    const m = /^\|\s*(\d{2})-(\d{2}) (\d{2}):(\d{2})\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*(.*?)\s*\|?\s*$/.exec(line);
    if (!m) continue;
    const [, mo, d, h, mi, rawState, label, details] = m;
    const st = rawState.toLowerCase();
    const state = st.startsWith("fail") ? "failed" : ["done", "running", "waiting", "pending", "skipped"].includes(st) ? st : "pending";
    const iso = new Date(Date.UTC(year, Number(mo) - 1, Number(d), Number(h), Number(mi))).toISOString();
    steps.push({
      t: iso,
      state,
      label,
      kind: /approv|reject|maintainer feedback/i.test(label) ? "approval" : /request created/i.test(label) ? "created" : undefined,
      ...(details.trim() ? { detail_public: details.trim() } : {}),
    });
  }
  return steps;
}

// ---- what the timeline shows: milestones, waits, PR events, failures and pauses ----
const ROUTINE_RE = /^(gate passed|queued for the orchestrator|orchestrator (started|finished))\b/i;
const BOOKKEEPING_RE = /\b(git push|pushed (the )?branch|branch (created|pushed|updated)|labels? (added|removed|set|updated)|relabell?ed)\b/i;

export function isRoutine(s: ProgressStep): boolean {
  if (s.visibility === "internal") return true;
  if (s.state === "failed" || s.state === "waiting") return false;
  return ROUTINE_RE.test(s.label ?? "") || BOOKKEEPING_RE.test(s.label ?? "");
}

/** The steps to display: routine ones dropped, superseded attempts flagged (decided on the full list). */
export function displayProgress(p: ProgressRecord | null): ProgressRecord | null {
  if (!p) return null;
  const sup = supersededSet(p.steps);
  const steps = p.steps.map((s, i) => ({ ...s, superseded: sup.has(i) })).filter((s) => !isRoutine(s));
  return { current: null, steps };
}
