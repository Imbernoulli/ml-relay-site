// One discussion thread per task (ML-Relay's tools/relay_threads.py): a GitHub issue labelled
// task-thread, titled "[change] <task>: ...". Plain comments are discussion (never the agent, no
// approval); "/approve [notes]" by a maintainer or one of the task's developers starts a round of
// agent work; inside a round "/run <text>" asks the agent. Posts written here carry a hidden marker
// so the thread can show what each post is (a change request, a method idea).

export const THREAD_LABEL = "task-thread";
export type PostKind = "comment" | "request" | "method-idea";

const MARKER_RE = /<!--\s*relay-thread-post\s+kind=([a-z-]+)(?:\s+moved-from=(\d+))?/i;

export function postMeta(body: string | null | undefined): { kind: PostKind | "agent"; movedFrom: number | null } {
  const m = MARKER_RE.exec(body ?? "");
  const k = (m?.[1] ?? "comment").toLowerCase();
  const kind = k === "request" || k === "method-idea" || k === "agent" ? k : "comment";
  return { kind, movedFrom: m?.[2] ? Number(m[2]) : null };
}

/** The body posted for a thread comment of this kind (a "/run" must start the comment to reach the agent). */
export function postBody(kind: PostKind | "agent" | "approve", text: string): string {
  const t = text.trim();
  if (kind === "agent") return `/run ${t}`;
  if (kind === "approve") return t ? `/approve ${t}` : "/approve";
  if (kind === "comment") return t;
  return `<!-- relay-thread-post kind=${kind} -->\n${t}`;
}

export const KIND_LABEL: Record<string, string> = {
  request: "change request",
  "method-idea": "method idea",
  agent: "to the agent",
};

/** The title of a new thread (the backend maps the task from the "[change] <task>:" prefix). */
export function threadTitle(task: string, text: string): string {
  let first = text.trim().split("\n")[0].replace(/[#*_`>]/g, "").trim();
  if (first.length > 80) first = `${first.slice(0, 77).trimEnd()}…`;
  return `[change] ${task}: ${first || "discussion"}`;
}

export function titleTask(title: string | null | undefined): string | null {
  const m = /^\s*\[(?:change|relay|maintainer)\]\s*(?:mls-bench__)?([a-z0-9][a-z0-9-]*[a-z0-9])\b/i.exec(title ?? "");
  return m ? m[1].toLowerCase() : null;
}

/** May this login approve rounds on the task's thread? (a maintainer, or one of the task's developers) */
export function canApprove(login: string | null | "", task: string | null, maintainers: string[], developers: Record<string, string[]>): boolean {
  if (!login) return false;
  const me = login.toLowerCase();
  if (maintainers.some((m) => m.toLowerCase() === me)) return true;
  return Boolean(task && (developers[task] ?? []).some((d) => d.toLowerCase() === me));
}
