// Base path of the static export (GitHub Pages serves the site under /<repo>).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function asset(rel: string): string {
  return `${BASE_PATH}/${rel.replace(/^\/+/, "")}`;
}

/** "3 GPUs", "1 GPU", "0.25 GPU", "CPU only"; null when unknown (render nothing). */
export function gpuLabel(v: unknown): string | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v === 0) return "CPU only";
  return `${v} GPU${v === 1 || v < 1 ? "" : "s"}`;
}

const ISSUES = "https://github.com/Imbernoulli/ML-Relay/issues/new";

export function feedbackUrl(task: string): string {
  const body = [
    "<!-- Feedback on an ML-Relay task. This does NOT start the relay agent. -->",
    "",
    `**Task:** ${task}`,
    "",
    "**What's wrong:**",
    "",
    "",
    "**Where (page section, file, line, setting or baseline):**",
    "",
    "",
    "**Suggestion:**",
    "",
  ].join("\n");
  const q = new URLSearchParams({ title: `[feedback] ${task}: `, labels: "feedback", body });
  return `${ISSUES}?${q.toString()}`;
}

export function changeUrl(task: string): string {
  // Mirrors the relay-request issue form, so the relay backend reads it the same way.
  const body = [
    "### What should happen?",
    "",
    "Something else (describe below)",
    "",
    "### Task",
    "",
    task,
    "",
    "### Agent for GPU runs",
    "",
    "oracle",
    "",
    "### Details",
    "",
    "**What to change:**",
    "",
    "",
    "**Why:**",
    "",
    "",
    "**Acceptance (how we will know it is done):**",
    "",
  ].join("\n");
  const q = new URLSearchParams({ title: `[change] ${task}: `, labels: "relay-request", body });
  return `${ISSUES}?${q.toString()}`;
}
