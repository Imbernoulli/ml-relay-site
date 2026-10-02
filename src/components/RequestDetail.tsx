"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getToken, isSignedIn, oauthConfigured } from "@/lib/github";
import { pickReport, STATUS_MARKER } from "@/lib/relayStatus";
import { cleanRequestTitle, type TaskTitles } from "@/lib/requestTitle";
import { approvalOf } from "@/lib/approval";
import { liveRecord, useLiveStatus } from "@/lib/liveStatus";
import { fromIssue, type StageInput } from "@/lib/stages";
import { RETURN_KEY } from "@/lib/issueForm";
import type { Approval, StatusIssue } from "@/lib/types";
import MarkdownContent from "./MarkdownContent";
import RequestTrack from "./RequestTrack";
import ReplyBox from "./ReplyBox";
import MaintainerActions, { isMaintainer, useLogin } from "./MaintainerActions";
import SignInButton from "./SignInButton";
import RequestAccess from "./RequestAccess";
import Spinner from "./Spinner";

interface GhUser {
  login: string;
  avatar_url: string;
  type?: string;
}
interface GhIssue {
  number: number;
  title: string;
  body: string | null;
  user: GhUser;
  labels: { name: string }[];
  state: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}
interface GhComment {
  id: number;
  body: string | null;
  user: GhUser;
  created_at: string;
  updated_at: string;
  html_url: string;
}
interface GhPr {
  number: number;
  title: string;
  state: string;
  draft?: boolean;
  merged_at: string | null;
  html_url: string;
  head: { ref: string };
}
interface GhFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}


async function gh<T>(path: string): Promise<T> {
  const tok = getToken();
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  });
  if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status}`), { status: r.status });
  return (await r.json()) as T;
}

/** Visible text of a comment: HTML comments (markers) removed; raw HTML is never rendered. */
const clean = (b: string | null) => (b ?? "").replace(/<!--[\s\S]*?-->/g, "").trim();
const isBot = (u: GhUser) => u.type === "Bot" || /\[bot\]$/.test(u.login);
const fmt = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC";

function kindOf(type: string | undefined, labels: string[]): StatusIssue["type"] {
  if (type === "new task" || labels.includes("relay-newtask")) return "new task";
  if (type === "maintenance" || labels.includes("relay-maintainer")) return "maintenance";
  return "change";
}

export default function RequestDetail({
  n,
  st,
  titles,
  maintainers = [],
  repo,
}: {
  n: number;
  st: StatusIssue | null;
  titles: TaskTitles;
  maintainers?: string[];
  repo: string;
}) {
  const login = useLogin();
  const rec = liveRecord(useLiveStatus(), n);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [issue, setIssue] = useState<GhIssue | null>(null);
  const [comments, setComments] = useState<GhComment[]>([]);
  const [pr, setPr] = useState<GhPr | null>(null);
  const [files, setFiles] = useState<GhFile[] | null>(null);
  const [err, setErr] = useState<"noaccess" | "other" | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isSignedIn()) return setSignedIn(false);
    setSignedIn(true);
    setLoading(true);
    try {
      const it = await gh<GhIssue>(`/repos/${repo}/issues/${n}`);
      const cs: GhComment[] = [];
      for (let page = 1; page <= 5; page++) {
        const batch = await gh<GhComment[]>(`/repos/${repo}/issues/${n}/comments?per_page=100&page=${page}`);
        cs.push(...batch);
        if (batch.length < 100) break;
      }
      setIssue(it);
      setComments(cs);
      let p: GhPr | null = null;
      if (st?.pr) p = await gh<GhPr>(`/repos/${repo}/pulls/${st.pr}`).catch(() => null);
      if (!p) {
        const owner = repo.split("/")[0];
        for (const ref of [`relay/${n}`, `relay-request/${n}`]) {
          const ps = await gh<GhPr[]>(`/repos/${repo}/pulls?state=all&head=${owner}:${encodeURIComponent(ref)}`).catch(() => []);
          if (ps.length) {
            p = ps[0];
            break;
          }
        }
      }
      setPr(p);
      if (p) setFiles(await gh<GhFile[]>(`/repos/${repo}/pulls/${p.number}/files?per_page=100`).catch(() => null));
    } catch (e) {
      setErr((e as { status?: number }).status === 404 ? "noaccess" : "other");
    } finally {
      setLoading(false);
    }
  }, [n, repo, st?.pr]);

  useEffect(() => {
    void load();
    const f = () => void load();
    window.addEventListener("mlrelay-auth", f);
    return () => window.removeEventListener("mlrelay-auth", f);
  }, [load]);

  const labels = issue?.labels.map((l) => l.name) ?? [];
  const type = kindOf(st?.type, labels);
  const liveApproval: Approval | null = issue ? approvalOf(labels, issue.user.login, maintainers).a : null;
  const approval = st?.approval ?? liveApproval;
  const title = cleanRequestTitle(issue?.title ?? st?.title ?? (rec?.title || `Request #${n}`), titles);
  const requester = issue?.user.login ?? st?.requester ?? (rec?.requester || null);
  const opened = issue?.created_at ?? st?.opened ?? null;
  const input: StageInput = st
    ? fromIssue(st)
    : {
        newTask: type === "new task",
        approval,
        phase: (labels.find((l) => l.startsWith("newtask-phase-")) ?? "").slice(-1).toUpperCase() || null,
        waitingGo: labels.includes("newtask-awaiting-go"),
        done: labels.includes("newtask-done"),
        closed: issue?.state === "closed",
        prState: pr ? (pr.merged_at ? "merged" : pr.state === "closed" ? "closed" : pr.draft ? "draft" : "open") : null,
        since: opened,
      };
  if (!st && issue) input.approval = approval;

  const statusC = comments.find((c) => (c.body ?? "").includes(STATUS_MARKER));
  const thread = comments.filter((c) => c !== statusC);
  const inDesign = type === "new task" && !input.phase && !input.done;
  const report = pickReport(thread, inDesign);
  const maint = isMaintainer(login, maintainers);
  const canReply = Boolean(login) && (maint || (requester && String(login).toLowerCase() === requester.toLowerCase()));
  const task = st?.task ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href={type === "new task" ? "/proposals/" : "/modifications/"} className="hover:text-foreground">
          {type === "new task" ? "Proposals" : "Modifications"}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">#{n}</span>
      </nav>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium">{type === "maintenance" ? "maintainer change" : type === "new task" ? "new-task proposal" : "change request"}</span>
        {requester && (
          <span className="text-muted-foreground">
            by <span className="font-mono">{requester}</span>
          </span>
        )}
        {opened && <span className="text-muted-foreground">· opened {fmt(opened)}</span>}
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {task && (
        <p className="mt-1 text-sm">
          Task:{" "}
          <Link href={`/tasks/${task}/`} className="underline">
            {titles[task] ?? task}
          </Link>
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <a href={`https://github.com/${repo}/issues/${n}`} target="_blank" rel="noreferrer" className="font-mono underline">
          issue #{n}
        </a>
        {(pr || st?.pr) && (
          <a href={pr?.html_url ?? `https://github.com/${repo}/pull/${st?.pr}`} target="_blank" rel="noreferrer" className="font-mono underline">
            PR #{pr?.number ?? st?.pr}
          </a>
        )}
      </div>

      {!st && !rec && !issue ? (
        <p className="mt-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {signedIn ? (loading ? "Loading…" : "No request with this number is known.") : "This request is not in the published status yet; sign in to see it live."}
        </p>
      ) : (
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <RequestTrack input={input} issue={n} opened={opened} requester={requester} approval={approval} updated={issue?.updated_at ?? st?.updated ?? null} noDetails noLink />
        <MaintainerActions issue={n} approval={approval} maintainers={maintainers} repo={repo} />
      </div>
      )}

      {signedIn === false && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 text-sm">
          <p>Sign in with GitHub to read the agent&apos;s reports and the discussion, and to reply.</p>
          {oauthConfigured && (
            <span
              className="mt-3 inline-block"
              onClickCapture={() => {
                try {
                  sessionStorage.setItem(RETURN_KEY, window.location.pathname);
                } catch {}
              }}
            >
              <SignInButton label="Sign in to read the discussion" />
            </span>
          )}
        </div>
      )}
      {err === "noaccess" && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 text-sm">
          <p>The discussion is in the private Imbernoulli/ML-Relay repository; you need to be a collaborator to read it.</p>
          <div className="mt-2">
            <RequestAccess />
          </div>
        </div>
      )}
      {err === "other" && <p className="mt-6 text-sm text-muted-foreground">The discussion could not be loaded right now.</p>}
      {loading && !issue && (
        <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading the discussion…
        </p>
      )}

      {issue && (
        <>
          {report && (
            <section className="mt-6 rounded-xl border-2 border-emerald-600/40 bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-emerald-600/50 bg-emerald-600/10 px-2 py-0.5 font-semibold text-emerald-800 dark:text-emerald-200">
                  {report.kind === "design-draft" ? "Design draft" : report.kind === "pilot-report" ? "Pilot report" : report.kind === "results" ? "Results" : report.kind === "final" ? "Final report" : "Latest agent report"}
                </span>
                <span>{fmt(report.updated)}</span>
                <a href={report.url} target="_blank" rel="noreferrer" className="ml-auto underline">
                  on GitHub
                </a>
              </div>
              <div className="prose prose-sm mt-3 max-w-none dark:prose-invert">
                <MarkdownContent content={report.body} />
              </div>
            </section>
          )}

          {canReply && issue.state === "open" && (
            <div className="mt-6">
              <ReplyBox
                issue={n}
                url={issue.html_url}
                onPosted={() => void load()}
                go={report?.readyForGo === "yes"}
                title={report?.readyForGo === "no" ? "Answer the agent's questions" : report?.readyForGo === "yes" ? "The agent is waiting for your go" : "Reply on this request"}
              />
            </div>
          )}

          {pr && (
            <section className="mt-6 rounded-xl border border-border bg-card p-4">
              <h2 className="text-base font-semibold">
                Pull request{" "}
                <a href={pr.html_url} target="_blank" rel="noreferrer" className="font-mono underline">
                  #{pr.number}
                </a>{" "}
                <span className="text-sm font-normal text-muted-foreground">· {pr.merged_at ? "merged" : pr.state === "closed" ? "closed" : pr.draft ? "draft" : "open"}</span>
              </h2>
              <p className="mt-1 text-sm">{pr.title}</p>
              {files && (
                <ul className="mt-2 max-h-72 space-y-0.5 overflow-auto font-mono text-xs">
                  {files.map((f) => (
                    <li key={f.filename} className="flex gap-2">
                      <span className="w-14 shrink-0 text-muted-foreground">{f.status}</span>
                      <span className="break-anywhere">{f.filename}</span>
                      <span className="ml-auto shrink-0 text-emerald-700 dark:text-emerald-300">+{f.additions}</span>
                      <span className="shrink-0 text-red-700 dark:text-red-300">−{f.deletions}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="mt-6">
            <h2 className="text-lg font-semibold">Conversation</h2>
            <ol className="mt-3 space-y-3">
              <Item user={issue.user} at={issue.created_at} url={issue.html_url} body={clean(issue.body)} first />
              {thread.map((c) => (
                <Item key={c.id} user={c.user} at={c.created_at} url={c.html_url} body={clean(c.body)} />
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}

function Item({ user, at, url, body, first = false }: { user: GhUser; at: string; url: string; body: string; first?: boolean }) {
  return (
    <li className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${user.avatar_url}${user.avatar_url.includes("?") ? "&" : "?"}s=48`} alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
        <span className="font-mono font-medium">{user.login}</span>
        {isBot(user) && <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">agent</span>}
        <span className="text-muted-foreground">{first ? "opened the request" : "commented"} · {fmt(at)}</span>
        <a href={url} target="_blank" rel="noreferrer" className="ml-auto text-muted-foreground underline">
          GitHub
        </a>
      </div>
      <div className="prose prose-sm max-w-none px-3 py-2 dark:prose-invert">{body ? <MarkdownContent content={body} /> : <p className="text-muted-foreground">(empty)</p>}</div>
    </li>
  );
}
