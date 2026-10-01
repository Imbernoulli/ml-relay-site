"use client";

// Browser-side GitHub access for the "My work" page. Nothing private is in the
// static build: everything below is fetched in the visitor's browser with the
// visitor's own token, so what they see is exactly what GitHub lets them see.
//
// Sign in once, stay signed in: the session (a read-only GitHub App user token
// plus its refresh token) is kept in localStorage on this browser. The access
// token expires after 8 h and is renewed through the sign-in service with the
// refresh token (valid ~6 months), so the visitor only signs in again after
// that or after "Sign out". Tokens are sent only to api.github.com and, for the
// renewal, to the sign-in service. A cross-site HttpOnly cookie is not an option
// here: the site and the service live on different domains.

import { BASE_PATH, GH_AUTH_PROXY, RELAY_REPO } from "./site";

const SESSION_KEY = "mlr-gh-session";
const LEGACY_KEY = "mlr-gh-token";
const STATE_KEY = "mlr-gh-oauth-state";
const API = "https://api.github.com";

interface Session {
  access_token: string;
  expires_at?: number; // epoch ms; absent = does not expire (e.g. a pasted PAT)
  refresh_token?: string;
  refresh_expires_at?: number;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as Session;
    const legacy = sessionStorage.getItem(LEGACY_KEY);
    return legacy ? { access_token: legacy } : null;
  } catch {
    return null;
  }
}

function writeSession(s: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    sessionStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage blocked: the session won't survive a reload */
  }
}

function sessionFrom(body: TokenResponse): Session {
  const now = Date.now();
  return {
    access_token: body.access_token as string,
    expires_at: body.expires_in ? now + body.expires_in * 1000 : undefined,
    refresh_token: body.refresh_token,
    refresh_expires_at: body.refresh_token_expires_in ? now + body.refresh_token_expires_in * 1000 : undefined,
  };
}

/** True when this browser holds a session that is still usable or renewable. */
export function isSignedIn(): boolean {
  const s = readSession();
  if (!s) return false;
  const now = Date.now();
  if (!s.expires_at || s.expires_at > now) return true;
  return Boolean(s.refresh_token && (!s.refresh_expires_at || s.refresh_expires_at > now));
}

export function getToken(): string | null {
  return readSession()?.access_token ?? null;
}

/** A pasted personal access token: no expiry, no refresh. */
export function setToken(token: string): void {
  writeSession({ access_token: token.trim() });
}

export function clearToken(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(LEGACY_KEY);
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* nothing to clear */
  }
}

let refreshing: Promise<boolean> | null = null;

/** Renew the access token with the refresh token; false if it cannot be renewed. */
async function refreshSession(): Promise<boolean> {
  const s = readSession();
  if (!s?.refresh_token || !GH_AUTH_PROXY) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${GH_AUTH_PROXY}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      const body = (await res.json().catch(() => ({}))) as TokenResponse;
      if (!res.ok || !body.access_token) return false;
      writeSession(sessionFrom(body));
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function freshToken(): Promise<string | null> {
  const s = readSession();
  if (!s) return null;
  if (s.expires_at && s.expires_at - 60_000 < Date.now()) {
    if (!(await refreshSession())) return null;
  }
  return getToken();
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
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !body.access_token) throw new Error(body.error || `Sign-in failed (${res.status}).`);
  writeSession(sessionFrom(body));
}

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function gh<T>(path: string, retried = false): Promise<T> {
  const token = await freshToken();
  if (!token) throw new GitHubError(401, "Not signed in.");
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (res.status === 401 && !retried && (await refreshSession())) return gh<T>(path, true);
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
