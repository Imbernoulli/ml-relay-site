import fs from "fs";
import path from "path";
import type { IndexData, StatusData, TaskData } from "./types";

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
  return JSON.parse(fs.readFileSync(p, "utf-8"));
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
