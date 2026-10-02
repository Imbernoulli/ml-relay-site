import fs from "fs";
import path from "path";
import type { IndexData, StatusData, TaskData } from "./types";
import { cleanRequestTitle, type TaskTitles } from "./requestTitle";
import { withApproval } from "./approval";

const DATA = path.join(process.cwd(), "src", "data");

export function loadIndex(): IndexData {
  return JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf-8"));
}

export function loadTask(id: string): TaskData | null {
  const p = path.join(DATA, "tasks", `${id}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

/** Live request status written by the sync job (absent locally until it runs). */
export function loadStatus(): StatusData {
  const p = path.join(DATA, "status.json");
  if (!fs.existsSync(p)) return { generated: null, repo: "Imbernoulli/ML-Relay", tasks: {}, new_tasks: [] };
  const st: StatusData = JSON.parse(fs.readFileSync(p, "utf-8"));
  // request titles are shown without their issue-title type tags
  const titles = taskTitles();
  // ... and with the maintainer-approval step first in their timeline
  const clean = <T extends { title: string; progress?: import("./types").ProgressRecord | null; approval?: import("./types").Approval | null }>(e: T): T => ({
    ...e,
    title: cleanRequestTitle(e.title, titles),
    progress: withApproval(e.progress, e.approval),
  });
  return {
    ...st,
    tasks: Object.fromEntries(Object.entries(st.tasks ?? {}).map(([k, v]) => [k, v.map(clean)])),
    new_tasks: (st.new_tasks ?? []).map(clean),
    issues: st.issues?.map(clean),
  };
}

/** task id -> human title, for request titles. */
export function taskTitles(): TaskTitles {
  try {
    return Object.fromEntries(loadIndex().tasks.map((t) => [t.id, t.title ?? t.id]));
  } catch {
    return {};
  }
}

export function siteMode(): "public" | "internal" {
  try {
    return loadIndex().mode === "public" ? "public" : "internal";
  } catch {
    return "internal";
  }
}

/** ML-Relay's issue forms, copied by the sync job (absent until it runs). */
export function loadForms(): import("./issueForm").FormsData {
  const p = path.join(DATA, "forms.json");
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export interface Contributor { login: string; avatar_url: string; html_url: string }
/** Public contributors list written by the sync job (collaborators, requesters, approvers). */
export function loadContributors(): Contributor[] {
  const p = path.join(DATA, "contributors.json");
  if (!fs.existsSync(p)) return [];
  try {
    return (JSON.parse(fs.readFileSync(p, "utf-8")).contributors ?? []) as Contributor[];
  } catch {
    return [];
  }
}
