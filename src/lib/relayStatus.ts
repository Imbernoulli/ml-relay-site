"use client";
// Signed-in only: the agent's living status comment on an issue (it carries the
// private progress details). Read live from GitHub with the visitor's own token;
// never part of the static build.
import { getToken } from "./github";
import { RELAY_REPO } from "./site";

// The backend marks its single, edited-in-place status comment with this.
export const STATUS_MARKER = "<!-- relay-status";

export class NoAccessError extends Error {}

export async function statusComment(issue: number): Promise<{ body: string; url: string; updated: string } | null> {
  const token = getToken();
  if (!token) return null;
  const r = await fetch(`https://api.github.com/repos/${RELAY_REPO}/issues/${issue}/comments?per_page=100`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (r.status === 404) throw new NoAccessError("no access to the private repository");
  if (!r.ok) return null;
  const comments: { body?: string; html_url: string; updated_at: string }[] = await r.json();
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if ((c.body ?? "").includes(STATUS_MARKER)) {
      const body = (c.body ?? "").replace(/<!--[\s\S]*?-->/g, "").trim();
      return { body, url: c.html_url, updated: c.updated_at };
    }
  }
  return null;
}

// ---- the agent's latest report (signed-in) ----
export interface ThreadComment {
  body?: string | null;
  html_url: string;
  updated_at: string;
  created_at?: string;
  user?: { login: string; type?: string } | null;
}
export interface AgentReport {
  body: string;
  url: string;
  updated: string;
  kind: string | null;
  readyForGo: "yes" | "no" | null;
}

const REPORT_MARK = /<!--\s*relay-report\b([^>]*)-->/;
const STATUS_REPLY = /^\s*(@\S+\s*)?#{1,4}\s*Relay status for\b/i;
const isBotUser = (u?: { login: string; type?: string } | null) => Boolean(u && (u.type === "Bot" || /\[bot\]$/.test(u.login)));

function attr(s: string, k: string): string | null {
  const m = new RegExp(`\\b${k}=([\\w-]+)`).exec(s);
  return m ? m[1] : null;
}

/** Newest agent report: the newest relay-report comment (a design draft while
 *  `preferDesign`), else the newest bot comment that is neither the status comment
 *  nor a /status reply. Markers are stripped; raw HTML is never rendered. */
export function pickReport(comments: ThreadComment[], preferDesign = false): AgentReport | null {
  // interim notes ("run ended early") are never the main report
  const marked = comments.filter((c) => REPORT_MARK.test(c.body ?? "") && attr(REPORT_MARK.exec(c.body ?? "")![1], "kind") !== "interim");
  const interim = comments.filter((c) => REPORT_MARK.test(c.body ?? "") && attr(REPORT_MARK.exec(c.body ?? "")![1], "kind") === "interim");
  let pick: ThreadComment | undefined;
  if (marked.length) {
    if (preferDesign) pick = [...marked].reverse().find((c) => attr(REPORT_MARK.exec(c.body ?? "")![1], "kind") === "design-draft");
    pick = pick ?? marked[marked.length - 1];
  } else {
    pick = [...comments]
      .reverse()
      .find((c) => isBotUser(c.user) && !interim.includes(c) && !(c.body ?? "").includes(STATUS_MARKER) && !STATUS_REPLY.test(c.body ?? ""));
  }
  if (!pick) return null;
  const m = REPORT_MARK.exec(pick.body ?? "");
  const rfg = m ? attr(m[1], "ready-for-go") : null;
  return {
    body: (pick.body ?? "").replace(/<!--[\s\S]*?-->/g, "").trim(),
    url: pick.html_url,
    updated: pick.updated_at,
    kind: m ? attr(m[1], "kind") : null,
    readyForGo: rfg === "yes" || rfg === "no" ? rfg : null,
  };
}

/** One fetch: the living status comment and the latest agent report. */
export async function agentThread(issue: number): Promise<{ status: { body: string; url: string; updated: string } | null; report: AgentReport | null; open: boolean }> {
  const token = getToken();
  if (!token) return { status: null, report: null, open: true };
  const h = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const r = await fetch(`https://api.github.com/repos/${RELAY_REPO}/issues/${issue}/comments?per_page=100`, { headers: h, cache: "no-store" });
  if (r.status === 404) throw new NoAccessError("no access to the private repository");
  if (!r.ok) return { status: null, report: null, open: true };
  const comments: ThreadComment[] = await r.json();
  let status = null;
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if ((c.body ?? "").includes(STATUS_MARKER)) {
      status = { body: (c.body ?? "").replace(/<!--[\s\S]*?-->/g, "").trim(), url: c.html_url, updated: c.updated_at };
      break;
    }
  }
  return { status, report: pickReport(comments), open: true };
}
