import fs from "fs";
import path from "path";
import type { IndexData, IndexEntry, StatusData, TaskData } from "./types";
import { cleanRequestTitle, type TaskTitles } from "./requestTitle";
import { withApproval } from "./approval";
import { FEATURED_ORDER } from "./featured";

const DATA = path.join(process.cwd(), "src", "data");

/** The index in display order (FEATURED_ORDER first, the rest in sync order), numbered 1..N in that order. */
export function loadIndex(): IndexData {
  const idx: IndexData = JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf-8"));
  const rank = new Map(FEATURED_ORDER.map((id, i) => [id, i]));
  const tasks = idx.tasks
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (rank.get(a.t.id) ?? FEATURED_ORDER.length + a.i) - (rank.get(b.t.id) ?? FEATURED_ORDER.length + b.i))
    .map(({ t }, i) => ({ ...t, n: i + 1 }));
  return { ...idx, tasks };
}

/** Tasks in development (approved proposals in flight + tasks built without an issue); empty until the sync writes them. */
export function loadInDevelopment(): import("./types").DevTask[] {
  const p = path.join(DATA, "in_development.json");
  if (!fs.existsSync(p)) return [];
  try {
    return (JSON.parse(fs.readFileSync(p, "utf-8")).tasks ?? []) as import("./types").DevTask[];
  } catch {
    return [];
  }
}

/** Ids of the in-development tasks that have a page. */
export function devPageIds(): string[] {
  return loadInDevelopment().flatMap((t) => (t.page ? [t.page] : []));
}

/** Tasks removed from ML-Relay (frozen pages, newest first); empty until the sync writes them. */
export function loadDeleted(): IndexEntry[] {
  try {
    const idx: IndexData = JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf-8"));
    return (idx.deleted_tasks ?? []).filter((t) => t.status === "deleted");
  } catch {
    return [];
  }
}

/** Ids of the deleted tasks (no request actions on them; their threads stay readable). */
export function deletedIds(): string[] {
  return loadDeleted().map((t) => t.id);
}

export function loadTask(id: string): TaskData | null {
  const p = path.join(DATA, "tasks", `${id}.json`);
  if (!fs.existsSync(p)) return null;
  const t: TaskData = JSON.parse(fs.readFileSync(p, "utf-8"));
  const n = loadIndex().tasks.find((x) => x.id === id)?.n;
  return n === undefined ? t : { ...t, n };
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
    return Object.fromEntries([...loadDeleted(), ...loadIndex().tasks].map((t) => [t.id, t.title ?? t.id]));
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

/** Per-task People card data (developers + contributors), written by the sync job; empty locally until it runs. */
export function loadPeople(): Record<string, import("./types").TaskPeopleData> {
  const p = path.join(DATA, "people.json");
  if (!fs.existsSync(p)) return {};
  try {
    return (JSON.parse(fs.readFileSync(p, "utf-8")).tasks ?? {}) as Record<string, import("./types").TaskPeopleData>;
  } catch {
    return {};
  }
}

/** task id -> logins of its listed developers (they may approve rounds on their task's thread). */
export function taskDevelopers(): Record<string, string[]> {
  return Object.fromEntries(Object.entries(loadPeople()).map(([t, p]) => [t, (p.developers ?? []).map((d) => d.login)]));
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
