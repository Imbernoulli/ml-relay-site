"use client";

// In-site access requests (sign-in service) and the maintainer's invitation
// (GitHub API with the maintainer's own token). Every call carries the user's token.
import { getToken } from "./github";
import { GH_AUTH_PROXY, RELAY_REPO } from "./site";

const SVC = GH_AUTH_PROXY || "https://mletask--ml-relay-auth-web.modal.run";
export const INVITATIONS_URL = `https://github.com/${RELAY_REPO}/invitations`;
export const COLLAB_SETTINGS_URL = `https://github.com/${RELAY_REPO}/settings/access`;

export interface AccessRequest {
  login: string;
  avatar_url?: string;
  html_url?: string;
  note?: string;
  at?: string | null;
  state: "none" | "pending" | "approved" | "denied" | "has-access";
  decided_at?: string;
  decided_by?: string;
}

export class HttpError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

async function svc<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const tok = getToken();
  if (!tok) throw new HttpError(401, "Not signed in.");
  const r = await fetch(`${SVC}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${tok}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const body = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new HttpError(r.status, (body as { error?: string }).error || `access ${r.status}`);
  return body;
}

export const requestAccess = (note: string) => svc<AccessRequest>("/access-requests", { method: "POST", body: { note } });
export const myAccessRequest = () => svc<AccessRequest>("/access-requests/me");
export const listAccessRequests = () => svc<{ requests: AccessRequest[] }>("/access-requests").then((d) => d.requests ?? []);
export const decideAccess = (login: string, decision: "approved" | "denied") =>
  svc<AccessRequest>("/access-requests/decide", { method: "POST", body: { login, decision } });

/** Invite a collaborator with the maintainer's token. 403: the session lacks Administration write. */
export async function inviteCollaborator(login: string, permission: "push" | "triage"): Promise<void> {
  const tok = getToken();
  if (!tok) throw new HttpError(401, "Not signed in.");
  const r = await fetch(`https://api.github.com/repos/${RELAY_REPO}/collaborators/${encodeURIComponent(login)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: JSON.stringify({ permission }),
  });
  if (r.status !== 201 && r.status !== 204) throw new HttpError(r.status, `GitHub ${r.status}`);
}

/** Can the signed-in visitor see the private repository? */
export async function hasRepoAccess(): Promise<boolean | null> {
  const tok = getToken();
  if (!tok) return null;
  const r = await fetch(`https://api.github.com/repos/${RELAY_REPO}`, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (r.ok) return true;
  return r.status === 404 ? false : null;
}
