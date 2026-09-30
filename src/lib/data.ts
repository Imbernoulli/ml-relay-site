import fs from "fs";
import path from "path";
import type { GapsData, IndexData, TaskData } from "./types";

const DATA = path.join(process.cwd(), "src", "data");

export function loadIndex(): IndexData {
  return JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf-8"));
}

export function loadTask(id: string): TaskData | null {
  const p = path.join(DATA, "tasks", `${id}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function loadGaps(): GapsData {
  return JSON.parse(fs.readFileSync(path.join(DATA, "gaps.json"), "utf-8"));
}

export function siteMode(): "public" | "internal" {
  try {
    return loadIndex().mode === "public" ? "public" : "internal";
  } catch {
    return "internal";
  }
}
