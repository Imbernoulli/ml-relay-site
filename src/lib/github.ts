"use client";

// Browser-side GitHub access for the "My work" page. Nothing private is in the
// static build: everything below is fetched in the visitor's browser with the
// visitor's own token, so what they see is exactly what GitHub lets them see.
// The token lives in sessionStorage only and is sent to api.github.com only.

import { BASE_PATH, GH_AUTH_PROXY, RELAY_REPO } from "./site";

const TOKEN_KEY = "mlr-gh-token";
const STATE_KEY = "mlr-gh-oauth-state";
const API = "https://api.github.com";

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token.trim());
  } catch {
    /* storage blocked: the session simply won't persist across reloads */
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export const oauthConfigured = Boolean(GH_AUTH_PROXY);

function callbackUrl(): string {
  return `${window.location.origin}${BASE_PATH}/auth/callback/`;
}

/** Step 1 of the web flow: send the visitor to GitHub with a one-time state.
 *  The client id is read from the sign-in service, so the site needs no rebuild
 *  when the GitHub App is (re)created. */
export async function startOAuth(): Promise<void> {
  let clientId = "";
  try {
    const r = await fetch(`${GH_AUTH_PROXY}/client-id`);
    clientId = ((await r.json()) as { client_id?: string }).client_id || "";
  } catch {
    /* handled below */
  }
  if (!clientId) {
    window.alert("GitHub sign-in is not set up yet. Use a personal access token for now.");
    return;
  }
  const state = crypto.randomUUID();
  try {
    sessionStorage.setItem(STATE_KEY, state);
  } catch {
    /* the callback will refuse without a stored state */
  }
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: callbackUrl(), state });
  window.location.assign(`https://github.com/login/oauth/authorize?${q.toString()}`);
}

/** Step 2: trade the code for a token through the proxy (it holds the client secret). */
export async function finishOAuth(code: string, state: string): Promise<void> {
  let expected: string | null = null;
  try {
    expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* handled below */
  }
  if (!expected || expected !== state) throw new Error("Sign-in state did not match; please try again.");
  const res = await fetch(`${GH_AUTH_PROXY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: callbackUrl() }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !body.access_token) throw new Error(body.error || `Sign-in failed (${res.status}).`);
  setToken(body.access_token);
}

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function gh<T>(path: string): Promise<T> {
  const token = getToken();
  if (!token) throw new GitHubError(401, "Not signed in.");
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!res.ok) throw new GitHubError(res.status, `GitHub API ${res.status} for ${path}`);
  return (await res.json()) as T;
}

export interface Viewer {
  login: string;
  avatar_url: string;
  html_url: string;
}

interface RawLabel {
  name: string;
}
interface RawIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: RawLabel[];
  pull_request?: unknown;
}
interface RawPull {
  number: number;
  html_url: string;
  state: string;
  draft: boolean;
  merged_at: string | null;
}
interface RawComment {
  user: { login: string; type: string } | null;
  body: string;
  created_at: string;
  html_url: string;
}

export type RequestKind = "change" | "new task" | "maintenance" | "other";

export interface MyRequest {
  number: number;
  title: string;
  url: string;
  state: string;
  kind: RequestKind;
  stage: string | null;
  waitingForYou: boolean;
  created: string;
  updated: string;
  pr: { number: number; url: string; state: "draft" | "open" | "merged" | "closed" } | null;
  lastAgent: { excerpt: string; when: string; url: string } | null;
}

const STAGE_LABELS: [string, string][] = [
  ["newtask-done", "Done"],
  ["newtask-phase-c", "Full measurement"],
  ["newtask-phase-b", "Building & pilot run"],
  ["newtask-phase-a", "Design review"],
];

function kindOf(labels: string[]): RequestKind {
  if (labels.includes("relay-newtask")) return "new task";
  if (labels.includes("relay-request")) return "change";
  if (labels.includes("relay-maintainer")) return "maintenance";
  return "other";
}

/** Plain-text excerpt: markdown punctuation stripped, never rendered as HTML. */
function excerpt(md: string, n = 280): string {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

export async function viewer(): Promise<Viewer> {
  return gh<Viewer>("/user");
}

async function linkedPull(issue: number): Promise<MyRequest["pr"]> {
  const [owner] = RELAY_REPO.split("/");
  for (const head of [`relay/${issue}`, `relay-request/${issue}`]) {
    const pulls = await gh<RawPull[]>(`/repos/${RELAY_REPO}/pulls?state=all&head=${owner}:${encodeURIComponent(head)}&per_page=5`);
    if (pulls.length) {
      const p = pulls[0];
      const state = p.merged_at ? "merged" : p.state === "closed" ? "closed" : p.draft ? "draft" : "open";
      return { number: p.number, url: p.html_url, state };
    }
  }
  return null;
}

async function lastAgentComment(issue: number): Promise<MyRequest["lastAgent"]> {
  const comments = await gh<RawComment[]>(`/repos/${RELAY_REPO}/issues/${issue}/comments?per_page=100`);
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (c.user?.type === "Bot" || c.user?.login === "github-actions[bot]") {
      return { excerpt: excerpt(c.body), when: c.created_at, url: c.html_url };
    }
  }
  return null;
}

/** Everything the signed-in visitor opened on the relay repo, newest first. */
export async function myRequests(login: string): Promise<MyRequest[]> {
  const issues = await gh<RawIssue[]>(
    `/repos/${RELAY_REPO}/issues?creator=${encodeURIComponent(login)}&state=all&sort=updated&per_page=50`,
  );
  const own = issues.filter((i) => !i.pull_request && !i.labels.some((l) => l.name === "relay-test"));
  return Promise.all(
    own.map(async (i): Promise<MyRequest> => {
      const labels = i.labels.map((l) => l.name);
      const stage = STAGE_LABELS.find(([l]) => labels.includes(l))?.[1] ?? null;
      const [pr, lastAgent] = await Promise.all([linkedPull(i.number), lastAgentComment(i.number)]);
      return {
        number: i.number,
        title: i.title,
        url: i.html_url,
        state: i.state,
        kind: kindOf(labels),
        stage,
        waitingForYou: i.state === "open" && labels.includes("newtask-awaiting-go"),
        created: i.created_at,
        updated: i.updated_at,
        pr,
        lastAgent,
      };
    }),
  );
}
