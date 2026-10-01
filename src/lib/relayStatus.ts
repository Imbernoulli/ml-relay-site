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
