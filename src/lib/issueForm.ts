// GitHub issue forms (from ML-Relay's .github/ISSUE_TEMPLATE, copied by the sync
// job into src/data/forms.json) and the issue body GitHub itself would write.

export interface FormField {
  type: "markdown" | "input" | "textarea" | "dropdown" | "checkboxes";
  id?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  value?: string;
  options?: string[];
  required?: boolean;
}
export interface IssueForm {
  file: string;
  name: string;
  description: string;
  title: string;
  labels: string[];
  fields: FormField[];
}
export type FormsData = Partial<Record<"new-task" | "change-task", IssueForm>>;

/** The body GitHub writes for an issue form: "### <label>\n\n<value>" blocks, "_No response_" when empty. */
export function buildIssueBody(form: IssueForm, values: Record<string, string>): string {
  const parts: string[] = [];
  for (const f of form.fields) {
    if (f.type === "markdown" || !f.id) continue;
    const v = (values[f.id] ?? "").trim();
    parts.push(`### ${f.label ?? f.id}\n\n${v || "_No response_"}`);
  }
  return parts.join("\n\n");
}

/** The GitHub issue title: the form's type tag (and, for a change request, the
 *  task id) the backend maps requests by, then the visitor's title. The site
 *  never shows the tag; a blank title falls back to the first answer. */
export function issueTitle(form: IssueForm, title: string, values: Record<string, string> = {}, task?: string): string {
  const prefix = (form.title ?? "").trim();
  let t = title.trim();
  if (prefix && t.toLowerCase().startsWith(prefix.toLowerCase())) t = t.slice(prefix.length).trim();
  if (task && t.toLowerCase().startsWith(`${task.toLowerCase()}:`)) t = t.slice(task.length + 1).trim();
  if (!t) {
    const first = form.fields.find((f) => f.type !== "markdown" && f.id && f.id !== "task" && (values[f.id] ?? "").trim());
    t = first ? (values[first.id!] ?? "").trim().split("\n")[0] : "";
    if (t.length > 90) t = `${t.slice(0, 87).trimEnd()}…`;
  }
  return [prefix, task ? `${task}:` : "", t].filter(Boolean).join(" ");
}

/** The GitHub form itself (fallback). */
export function githubFormUrl(repo: string, form: IssueForm, prefill: Record<string, string> = {}): string {
  const q = new URLSearchParams({ template: form.file, ...prefill });
  return `https://github.com/${repo}/issues/new?${q.toString()}`;
}

// ---- the backend's cheap structural checks (tools/relay_newtask.py), shown as hints ----
const URL_RE = /https?:\/\/\S+/;

export function countItems(text: string): number {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const table = lines.filter((l) => l.startsWith("|") && !/^\|[\s:|-]+\|$/.test(l));
  if (table.length >= 2) return table.length - 1;
  const bullets = lines.filter((l) => /^([-*+]|\d+[.)])\s+/.test(l));
  return bullets.length ? bullets.length : lines.length;
}

export function newTaskHints(v: Record<string, string>): Record<string, string[]> {
  const h: Record<string, string[]> = {};
  const add = (k: string, m: string) => (h[k] = [...(h[k] ?? []), m]);
  const papers = (v.papers ?? "").trim();
  if (papers && !URL_RE.test(papers) && !/\b\d{4}\.\d{4,5}\b|10\.\d{4,}\//.test(papers)) add("papers", "An arXiv id, DOI or link helps the agent find the paper.");
  const code = (v.codebase ?? "").trim();
  if (code && !URL_RE.test(code)) add("codebase", "A repository URL helps.");
  if (code && !/(@|commit|branch|tag|\b[0-9a-f]{7,40}\b)/i.test(code)) add("codebase", "If you know it, pin a commit, branch or tag (repo@commit).");
  const settings = (v.settings ?? "").trim();
  if (settings) {
    const n = countItems(settings);
    if (n < 3) add("settings", `${n} setting${n === 1 ? "" : "s"} listed; a task scores at least 3, so the agent will propose the rest.`);
    if (!/\b(higher|lower|maximi[sz]e|minimi[sz]e)\b|↑|↓/i.test(settings)) add("settings", "Saying whether higher or lower is better helps.");
  }
  const bl = (v.baselines ?? "").trim();
  if (bl) {
    if (countItems(bl) < 2) add("baselines", "A task usually has 2 or more published methods; the agent can add more.");
    if (!/\b(starter|default)\b/i.test(bl)) add("baselines", "If you have a preference, say which one is the starter.");
    if (!URL_RE.test(bl)) add("baselines", "Code links help.");
  }
  const cb = (v.compute ?? "").trim();
  if (cb && !/\d/.test(cb)) add("compute", "Numbers help: GPUs and wall time per setting.");
  return h;
}

// ---- requests submitted from the site, shown in My work before GitHub lists them ----
const OPT_KEY = "mlrelay-optimistic";
export interface OptimisticRequest {
  number: number;
  title: string;
  url: string;
  kind: "change" | "new task";
  created: string;
}
export function addOptimistic(r: OptimisticRequest) {
  try {
    const cur: OptimisticRequest[] = JSON.parse(localStorage.getItem(OPT_KEY) || "[]");
    localStorage.setItem(OPT_KEY, JSON.stringify([r, ...cur.filter((x) => x.number !== r.number)].slice(0, 20)));
  } catch {}
}
export function getOptimistic(): OptimisticRequest[] {
  try {
    const v = JSON.parse(localStorage.getItem(OPT_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ---- where to come back to after the GitHub sign-in redirect ----
export const RETURN_KEY = "mlrelay-return-to";
