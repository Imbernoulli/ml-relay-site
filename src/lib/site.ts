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

export const REQUEST_MODEL =
  "Every request is a GitHub issue; an agent works on it and opens exactly one PR for that issue, which a maintainer reviews and merges.";

/** The change-task issue form, with the task id prefilled (form field id `task`) and in the title. */
export function changeUrl(task: string): string {
  const q = new URLSearchParams({ template: "change-task.yml", task, title: `[change] ${task}: ` });
  return `${ISSUES}?${q.toString()}`;
}

export const NEW_TASK_FORM = "https://github.com/Imbernoulli/ML-Relay/issues/new?template=new-task.yml";
export const PROPOSE_PAGE = "/propose/";

// GitHub sign-in ("My work"). Both are public values, set at build time from
// repository variables (see worker/README.md). Empty = only the token fallback.
export const GH_CLIENT_ID = process.env.NEXT_PUBLIC_GH_CLIENT_ID || "";
export const GH_AUTH_PROXY = process.env.NEXT_PUBLIC_GH_AUTH_PROXY || "";
export const RELAY_REPO = "Imbernoulli/ML-Relay";
