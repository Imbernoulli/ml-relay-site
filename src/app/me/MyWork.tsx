"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui";
import {
  clearToken,
  GitHubError,
  isSignedIn,
  myRequests,
  oauthConfigured,
  setToken,
  viewer,
  warmUpSignIn,
  type MyRequest,
  type Viewer,
} from "@/lib/github";
import type { StatusData, StatusIssue } from "@/lib/types";
import ProgressTimeline from "@/components/ProgressTimeline";
import PrivateStatus from "@/components/PrivateStatus";
import SignInButton from "@/components/SignInButton";
import RequestAccess from "@/components/RequestAccess";
import ReplyBox from "@/components/ReplyBox";
import { getOptimistic } from "@/lib/issueForm";
import { NEW_TASK_FORM, RELAY_REPO } from "@/lib/site";

const PR_STYLE: Record<string, string> = {
  draft: "border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  open: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  merged: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  closed: "border-border bg-muted text-muted-foreground",
};

function Pill({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

const NEW_TASK_STAGES = ["Design review", "Building & pilot run", "Full measurement", "Merged"];
const CHANGE_STAGES = ["Requested", "Agent working", "PR in review", "Merged"];

function Timeline({ r, stage }: { r: MyRequest; stage: string | null }) {
  const isNew = r.kind === "new task";
  const stages = isNew ? NEW_TASK_STAGES : CHANGE_STAGES;
  const last = stages.length - 1;
  let cur = 0;
  if (r.pr?.state === "merged") cur = last;
  else if (isNew) cur = Math.max(0, stages.indexOf(stage ?? ""));
  else if (r.pr?.state === "open") cur = 2;
  else if (r.pr?.state === "draft" || stage === "Agent working") cur = 1;
  const stopped = r.state !== "open" && r.pr?.state !== "merged";
  return (
    <ol className="mt-3 grid grid-cols-4 gap-1">
      {stages.map((s, i) => {
        const done = i < cur || (i === cur && i === last);
        const active = i === cur && i !== last && !stopped;
        return (
          <li key={s} className="min-w-0">
            <div className={`h-1.5 rounded-full ${done ? "bg-emerald-500" : active ? "bg-amber-500" : "bg-muted"}`} />
            <div className={`mt-1 text-[11px] leading-tight ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s}</div>
          </li>
        );
      })}
    </ol>
  );
}

function RequestCard({ r, st, known, onPosted }: { r: MyRequest; st: StatusIssue | undefined; known: Set<string>; onPosted: () => void }) {
  const stage = st?.stage ?? r.stage;
  const waiting = r.waitingForYou || Boolean(st?.waiting && st.state === "open");
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Pill cls="border-border bg-muted text-foreground">{r.kind}</Pill>
        {stage && <Pill cls="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300">{stage}</Pill>}
        {waiting && <Pill cls="border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200">waiting for your reply</Pill>}
        <Pill cls={r.state === "open" ? PR_STYLE.open : PR_STYLE.closed}>{r.state}</Pill>
        <span className="ml-auto text-xs text-muted-foreground">updated {r.updated.slice(0, 10)}</span>
      </div>
      <a href={r.url} target="_blank" rel="noreferrer" className="mt-2 block text-base font-semibold hover:underline">
        #{r.number} {r.title}
      </a>
      {st?.progress?.steps?.length ? <ProgressTimeline progress={st.progress} /> : <Timeline r={r} stage={stage} />}
      <PrivateStatus issue={r.number} />
      {waiting && r.state === "open" && <ReplyBox issue={r.number} url={r.url} onPosted={onPosted} />}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {r.pr ? (
          <>
            <a href={r.pr.url} target="_blank" rel="noreferrer" className="font-mono underline">
              PR #{r.pr.number}
            </a>
            <Pill cls={PR_STYLE[r.pr.state]}>PR {r.pr.state}</Pill>
          </>
        ) : (
          <span className="text-muted-foreground">no PR yet</span>
        )}
        {st?.task && known.has(st.task) && (
          <Link href={`/tasks/${st.task}/`} className="underline">
            task page
          </Link>
        )}
        <span className="text-muted-foreground">opened {r.created.slice(0, 10)}</span>
      </div>
      {r.lastAgent && (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Latest agent reply · {r.lastAgent.when.slice(0, 10)}</div>
          <p className="mt-1 text-sm leading-relaxed">{r.lastAgent.excerpt}</p>
          <a href={r.lastAgent.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">
            Read and reply on GitHub
          </a>
        </div>
      )}
    </Card>
  );
}

function SignedOut({ onToken, message }: { onToken: () => void; message?: string }) {
  const [showPat, setShowPat] = useState(false);
  const [pat, setPat] = useState("");
  return (
    <Card className="mt-6">
      {message && <p className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">{message}</p>}
      {oauthConfigured ? (
        <SignInButton />
      ) : (
        <p className="text-sm text-muted-foreground">GitHub sign-in is not available right now.</p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        One click, read-only. Only collaborators on the private {RELAY_REPO} repository see anything.
      </p>
      <button type="button" onClick={() => setShowPat(!showPat)} className="mt-4 text-xs text-muted-foreground underline">
        Trouble signing in? Use a token
      </button>
      {showPat && (
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pat.trim()) return;
            setToken(pat);
            setPat("");
            onToken();
          }}
        >
          <p className="text-xs leading-relaxed text-muted-foreground">
            A{" "}
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" className="underline">
              fine-grained token
            </a>{" "}
            with access to {RELAY_REPO} only and read-only Issues and Pull requests.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="password"
              autoComplete="off"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="github_pat_…"
              aria-label="GitHub token"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm"
            />
            <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              Use token
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

type Load =
  | { s: "loading" }
  | { s: "signed-out"; msg?: string }
  | { s: "error"; msg: string; noAccess?: boolean }
  | { s: "ok"; me: Viewer; items: MyRequest[] };

export default function MyWork({ status, knownTasks }: { status: StatusData; knownTasks: string[] }) {
  const [load, setLoad] = useState<Load>({ s: "loading" });

  const refresh = useCallback(async () => {
    if (!isSignedIn()) {
      setLoad({ s: "signed-out" });
      return;
    }
    setLoad({ s: "loading" });
    try {
      const me = await viewer();
      const items = await myRequests(me.login);
      // Requests just filed from the site appear at once, before GitHub's list catches up.
      const have = new Set(items.map((x) => x.number));
      const fresh = getOptimistic()
        .filter((o) => !have.has(o.number) && Date.now() - Date.parse(o.created) < 86400000)
        .map(
          (o): MyRequest => ({
            number: o.number,
            title: o.title,
            url: o.url,
            state: "open",
            kind: o.kind,
            stage: o.kind === "new task" ? "Design review" : "Requested",
            waitingForYou: false,
            created: o.created,
            updated: o.created,
            pr: null,
            lastAgent: null,
          }),
        );
      setLoad({ s: "ok", me, items: [...fresh, ...items] });
    } catch (e) {
      if (e instanceof GitHubError && e.status === 401) {
        clearToken();
        window.dispatchEvent(new Event("mlrelay-auth"));
        setLoad({ s: "signed-out", msg: "Your GitHub session expired. Please sign in again." });
      } else if (e instanceof GitHubError && e.status === 404) {
        setLoad({ s: "error", msg: `You need to be a collaborator on ${RELAY_REPO} to see requests.`, noAccess: true });
      } else if (e instanceof GitHubError && e.status === 403) {
        setLoad({ s: "error", msg: "GitHub refused the request (missing read access or rate limit). Try again later." });
      } else {
        setLoad({ s: "error", msg: e instanceof Error ? e.message : "Could not load your requests." });
      }
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn()) warmUpSignIn();
    void refresh();
  }, [refresh]);

  const signOut = () => {
    clearToken();
    window.dispatchEvent(new Event("mlrelay-auth"));
    setLoad({ s: "signed-out" });
  };

  if (load.s === "loading") return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;
  if (load.s === "signed-out") return <SignedOut onToken={() => void refresh()} message={load.msg} />;
  if (load.s === "error")
    return (
      <div className="mt-6">
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm">{load.msg}</p>
        {load.noAccess && (
          <div className="mt-3">
            <RequestAccess />
          </div>
        )}
        <button type="button" onClick={signOut} className="mt-3 rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">
          Sign out
        </button>
      </div>
    );

  const byIssue = new Map((status.issues ?? []).map((x) => [x.issue, x]));
  const known = new Set(knownTasks);
  const open = load.items.filter((r) => r.state === "open");
  const closed = load.items.filter((r) => r.state !== "open");
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={load.me.avatar_url} alt="" className="h-8 w-8 rounded-full" />
        <a href={load.me.html_url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">
          {load.me.login}
        </a>
        <button type="button" onClick={() => void refresh()} className="ml-auto rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">
          Refresh
        </button>
        <button type="button" onClick={signOut} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">
          Sign out
        </button>
      </div>
      {load.items.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm">You have not opened any requests yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Request a change from any task page, or{" "}
            <a href={NEW_TASK_FORM} target="_blank" rel="noreferrer" className="underline">
              propose a new task
            </a>
            .
          </p>
        </Card>
      ) : (
        <>
          <h2 className="mt-6 text-lg font-semibold">Open ({open.length})</h2>
          <div className="mt-2 space-y-3">
            {open.length ? open.map((r) => <RequestCard key={r.number} r={r} st={byIssue.get(r.number)} known={known} onPosted={() => void refresh()} />) : <p className="text-sm text-muted-foreground">None.</p>}
          </div>
          {closed.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Closed ({closed.length})</h2>
              <div className="mt-2 space-y-3">
                {closed.map((r) => (
                  <RequestCard key={r.number} r={r} st={byIssue.get(r.number)} known={known} onPosted={() => void refresh()} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
