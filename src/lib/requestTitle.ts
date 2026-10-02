// Request titles as shown on the site: the issue-title type tags ("[new task] ",
// "[change] <task-id>: ", any other leading bracketed tag) are dropped, because
// the type is already shown as a badge. A replacement "[change] A → B" reads
// "Replace <title of A> with <title of B>".

const TAG_RE = /^\s*\[[^\]]*\]\s*/;
const TASK = "[a-z0-9][a-z0-9-]*[a-z0-9]";
const REPLACE_RE = new RegExp(`^(${TASK})\\s*(?:→|->|=>)\\s*(${TASK})(?![a-z0-9-])`, "i");
const TASK_PREFIX_RE = new RegExp(`^(${TASK})\\s*:\\s*`, "i");

export type TaskTitles = Record<string, string>;

function stripTags(t: string): string {
  let prev: string;
  do {
    prev = t;
    t = t.replace(TAG_RE, "");
  } while (t !== prev);
  return t;
}

export function cleanRequestTitle(raw: string | null | undefined, titles: TaskTitles = {}): string {
  const original = (raw ?? "").trim();
  let t = stripTags(original);
  const rm = REPLACE_RE.exec(t);
  if (rm) return `Replace ${titles[rm[1]] ?? rm[1]} with ${titles[rm[2]] ?? rm[2]}`;
  const cm = TASK_PREFIX_RE.exec(t);
  if (cm && (cm[1] in titles || cm[1].includes("-"))) t = stripTags(t.slice(cm[0].length));
  t = t.trim();
  return t || "Untitled request";
}
