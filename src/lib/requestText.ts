"use client";

// What a request says, for signed-in collaborators only (owner decision 2026-10-06): fetched live with the
// visitor's own GitHub token, never part of the public site data. Cleaned with the same rules as ML-Relay's
// tools/site_gen/request_text.py (a line-by-line port; that module's tests pin the rules): HTML comments and
// tags removed, "_No response_" dropped; e-mails, tokens/keys and host-internal paths replaced; bot comments
// (reports, status, cc) and command-only comments dropped; "/run", "/approve <notes>", "/reject <reason>"
// keep their text.
import { getToken } from "./github";
import { RELAY_REPO } from "./site";
import type { RequestDetails, RequestPost } from "./types";

const MAX_BODY = 6000;
const MAX_POST = 3000;
const MAX_POSTS = 60;
const MAX_SUMMARY = 200;

const COMMENT_RE = /<!--[\s\S]*?-->/g;
const TAG_RE = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g;
const NO_RESPONSE_RE = /^\s*_No response_\s*$/gim;

const REDACTIONS: [string, RegExp, string][] = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[private key removed]"],
  ["token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[token removed]"],
  ["token", /\b(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,}|dtn_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|xox[abposr]-[A-Za-z0-9-]{10,}|a[ks]-[A-Za-z0-9]{20,})\b/g, "[token removed]"],
  ["token", /\b(bearer|authorization:)\s+[A-Za-z0-9._~+/=-]{16,}/gi, "$1 [token removed]"],
  ["token", /\b([A-Z0-9_]*(?:TOKEN|SECRET|API_KEY|PASSWORD)[A-Z0-9_]*)\s*[=:]\s*['"]?[^\s'"]{8,}/gi, "$1=[secret removed]"],
  ["email", /\b[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email removed]"],
  [
    "internal path",
    /(?<![\w.:/-])(?:\/(?:srv|home|tmp|data|mnt|scratch|scratch2|nfs|lustre|gpfs|root|var\/lib)\/[^\s`'")\]>]+|~\/[^\s`'")\]>]+|[A-Za-z]:\\[^\s`'")\]>]+)/g,
    "[path removed]",
  ],
];
const COMMAND_ONLY_RE = /^\s*(?:\/(?:status|stop|approve|run|reject|go)|go|go ahead|\/run\s+(?:status|stop))\s*[.!]?\s*$/i;
const CMD_RE = /^\s*\/(run|approve|reject)\b[ \t]*/i;
const POST_KIND_RE = /<!--\s*relay-thread-post\s+kind=([a-z-]+)/i;

export function clean(text: string | null | undefined): string {
  return (text ?? "").replace(COMMENT_RE, "").replace(TAG_RE, "").replace(NO_RESPONSE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function redact(text: string): string {
  let t = text;
  for (const [, rx, repl] of REDACTIONS) t = t.replace(rx, repl);
  return t;
}

const cap = (t: string, n: number) => (t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`);

/** [{label, text}] for an issue-form body ("### <label>" blocks), null for a free-form body. */
export function formFields(body: string | null | undefined, skip = ["task"]): { label: string; text: string }[] | null {
  const b = (body ?? "").replace(COMMENT_RE, "");
  if (!/^###\s+\S/m.test(b)) return null;
  const out: [string, string][] = [];
  let cur: string | null = null;
  let buf: string[] = [];
  for (const line of b.split("\n")) {
    const m = /^###\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (cur !== null) out.push([cur, buf.join("\n")]);
      cur = m[1].trim();
      buf = [];
    } else if (cur !== null) buf.push(line);
    else if (line.trim()) out.push(["", line]);
  }
  if (cur !== null) out.push([cur, buf.join("\n")]);
  return out
    .map(([label, text]) => ({ label, text: clean(text) }))
    .filter((f) => f.text && !skip.includes(f.label.trim().toLowerCase().replace(/[ *]+$/, "")));
}

export function requestText(body: string | null | undefined): RequestDetails["text"] {
  const fields = formFields(body);
  if (fields) return { fields: fields.map((f) => ({ label: redact(f.label.slice(0, 120)), text: redact(cap(f.text, MAX_BODY)) })) };
  const t = redact(cap(clean(body), MAX_BODY));
  return t ? { body: t } : {};
}

interface GhComment {
  body?: string | null;
  created_at?: string;
  user?: { login?: string; type?: string } | null;
}

export function isBot(u: GhComment["user"]): boolean {
  const login = u?.login ?? "";
  return u?.type === "Bot" || login.endsWith("[bot]") || login === "github-actions";
}

export function posts(comments: GhComment[]): RequestPost[] {
  const out: RequestPost[] = [];
  for (const c of comments ?? []) {
    if (isBot(c.user)) continue;
    const raw = c.body ?? "";
    if (raw.includes("relay-thread-cc") || raw.includes("relay-status") || COMMAND_ONLY_RE.test(raw.replace(COMMENT_RE, ""))) continue;
    const m = POST_KIND_RE.exec(raw);
    let kind: RequestPost["kind"] = m && ["request", "method-idea"].includes(m[1].toLowerCase()) ? (m[1].toLowerCase() as RequestPost["kind"]) : "comment";
    let body = raw.replace(COMMENT_RE, "").trim();
    const cm = CMD_RE.exec(body);
    if (cm) {
      kind = ({ run: "agent", approve: "approve", reject: "reject" } as const)[cm[1].toLowerCase() as "run" | "approve" | "reject"];
      body = body.slice(cm[0].length);
    }
    const t = redact(cap(clean(body), MAX_POST));
    if (!t && kind !== "approve") continue;
    out.push({ author: c.user?.login ?? "?", at: c.created_at ?? null, kind, text: t });
  }
  return out.slice(-MAX_POSTS);
}

const plain = (md: string) =>
  md
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_m, a, b) => a ?? b)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[\s>*#-]+/, "")
    .replace(/\s+/g, " ")
    .trim();

/** One line from the agent's latest report: the opening sentence of "What changed", else a bold bullet lead. */
export function reportSummary(comments: GhComment[]): string | null {
  for (let i = (comments ?? []).length - 1; i >= 0; i--) {
    const c = comments[i];
    const body = c.body ?? "";
    if (!isBot(c.user) || !body.includes("relay-report")) continue;
    const sec = body.replace(COMMENT_RE, "").split(/^##\s+/m);
    const part = sec.slice(1).find((s) => /^(what changed|summary|design)/i.test(s)) ?? sec[1] ?? "";
    const lines = part
      .split("\n")
      .slice(1)
      .filter((l) => l.trim() && !/^\s*(@|\||---|```)/.test(l));
    const first = (l: string) => plain(l).split(/(?<=[.!?])\s/)[0];
    const bullet = /^\s*(?:[-*]|\d+[.)])\s+/;
    const cands = [
      ...lines.filter((l) => !bullet.test(l)).map(first),
      ...lines.flatMap((l) => {
        const m = /^\s*[-*]\s+\*\*([^*]+)\*\*/.exec(l);
        return m ? [m[1].trim()] : [];
      }),
      ...lines.filter((l) => bullet.test(l)).map(first),
    ];
    const text = cands.map(plain).find((x) => x.length >= 20 && !x.trimEnd().endsWith(":"));
    return text ? redact(cap(text, MAX_SUMMARY)) : null;
  }
  return null;
}

// ---- live fetch, shared by every card on a page ----------------------------------------------------
export type DetailsState = { s: "loading" } | { s: "ok"; d: RequestDetails } | { s: "noaccess" } | { s: "error" };

const cache = new Map<number, Promise<DetailsState>>();

async function gh<T>(path: string): Promise<{ status: number; body: T | null }> {
  const tok = getToken();
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  });
  return { status: r.status, body: r.ok ? ((await r.json()) as T) : null };
}

/** The request's text, posts and agent one-liner, read live with the visitor's token (cached per page). */
export function requestDetails(issue: number): Promise<DetailsState> {
  let p = cache.get(issue);
  if (!p) {
    p = (async (): Promise<DetailsState> => {
      try {
        const it = await gh<{ body?: string | null }>(`/repos/${RELAY_REPO}/issues/${issue}`);
        if (it.status === 404 || it.status === 403) return { s: "noaccess" };
        if (!it.body) return { s: "error" };
        const comments: GhComment[] = [];
        for (let page = 1; page <= 3; page++) {
          const c = await gh<GhComment[]>(`/repos/${RELAY_REPO}/issues/${issue}/comments?per_page=100&page=${page}`);
          if (!c.body) break;
          comments.push(...c.body);
          if (c.body.length < 100) break;
        }
        return { s: "ok", d: { text: requestText(it.body.body), posts: posts(comments), summary: reportSummary(comments) } };
      } catch {
        return { s: "error" };
      }
    })();
    cache.set(issue, p);
  }
  return p;
}
