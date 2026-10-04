"use client";

import Link from "next/link";
import RequestTrack from "@/components/RequestTrack";
import { fromIssue } from "@/lib/stages";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui";
import {
  cachedViewer,
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
import SignInButton from "@/components/SignInButton";
import RequestAccess from "@/components/RequestAccess";
import AccessQueue from "@/components/AccessQueue";
import Skeleton from "@/components/Skeleton";
import MaintainerActions, { isMaintainer } from "@/components/MaintainerActions";
import { getOptimistic } from "@/lib/issueForm";
import { cleanRequestTitle, type TaskTitles } from "@/lib/requestTitle";
import { RELAY_REPO } from "@/lib/site";
import { useLiveStatus } from "@/lib/liveStatus";
import { actionsFor, pendingActions } from "@/lib/actions";

const REASON_STYLE: Record<string, string> = {
  approve: "border-violet-500/50 bg-violet-500/10 text-violet-800 dark:text-violet-200",
  reply: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  go: "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  merge: "border-sky-500/50 bg-sky-500/10 text-sky-800 dark:text-sky-200",
};

const PR_STYLE: Record<string, string> = {
  draft: "border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  open: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  merged: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  closed: "border-border bg-muted text-muted-foreground",
};

function Pill({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function RequestCard({ r, st, known, titles, onPosted }: { r: MyRequest; st: StatusIssue | undefined; known: Set<string>; titles: TaskTitles; onPosted: () => void }) {
  const stage = st?.stage ?? r.stage;
  const appr = st?.approval;
  const awaitingApproval = r.state === "open" && (appr?.state === "waiting" || appr?.state === "feedback");
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Pill cls="border-border bg-muted text-foreground">{r.kind}</Pill>
        {r.state !== "open" && <Pill cls={PR_STYLE.closed}>closed</Pill>}
        {st?.task && known.has(st.task) && (
          <Link href={`/tasks/${st.task}/`} className="ml-auto text-xs underline">
            task page
          </Link>
        )}
      </div>
      <Link href={`/requests/${r.number}/`} className="mt-2 block text-base font-semibold hover:underline">
        #{r.number} {cleanRequestTitle(r.title, titles)}
      </Link>
      <RequestTrack
        input={
          st
            ? fromIssue(st)
            : {
                newTask: r.kind === "new task",
                phase: stage === "Full measurement" ? "C" : stage === "Building & pilot run" ? "B" : null,
                waitingGo: r.waitingForYou && r.state === "open",
                done: stage === "Done",
                closed: r.state !== "open" && r.pr?.state !== "merged",
                prState: r.pr?.state ?? null,
                since: r.created,
              }
        }
        issue={r.number}
        opened={st?.opened ?? r.created}
        requester={st?.requester ?? null}
        approval={st?.approval}
        updated={r.updated}
        pr={r.pr ? { number: r.pr.number, state: r.pr.state } : st ? { number: st.pr, state: st.pr_state } : null}
      />
      {awaitingApproval && appr?.note && (
        <div className="mt-3 rounded-lg border border-violet-500/40 bg-violet-500/5 px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-violet-800 dark:text-violet-200">Maintainer feedback</div>
          <p className="mt-1 text-sm leading-relaxed">{appr.note}</p>
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

export default function MyWork({ status, knownTasks, titles }: { status: StatusData; knownTasks: string[]; titles: TaskTitles }) {
  const [load, setLoad] = useState<Load>({ s: "loading" });
  const live = useLiveStatus();
  // the signed-in login from the session cache, so the page's sections show before any fetch returns
  const [cached, setCached] = useState<Viewer | null>(null);
  useEffect(() => {
    if (isSignedIn()) setCached(cachedViewer());
  }, []);

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

  if (load.s === "loading" && !cached) return <Skeleton lines={3} className="mt-6" />;
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
  const me = load.s === "ok" ? load.me : cached!;
  const items = load.s === "ok" ? load.items : null;
  const maint = isMaintainer(me.login, status.maintainers);
  // everything waiting on this person, live: maintainers see every request whose next step is theirs
  const needs = actionsFor(pendingActions(live, status.issues ?? []), me.login, maint);
  const open = (items ?? []).filter((r) => r.state === "open");
  const closed = (items ?? []).filter((r) => r.state !== "open");
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={me.avatar_url} alt="" className="h-8 w-8 rounded-full" />
        <a href={me.html_url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">
          {me.login}
        </a>
        <button type="button" onClick={() => void refresh()} className="ml-auto rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">
          Refresh
        </button>
        <button type="button" onClick={signOut} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">
          Sign out
        </button>
      </div>
      {maint && (
        <div id="access-requests">
          <AccessQueue />
        </div>
      )}
      <section className="mt-6" id="needs-action">
        <h2 className="text-lg font-semibold">Needs your action ({needs.length})</h2>
        <div className="mt-2 space-y-3">
          {needs.length ? (
            needs.map((x) => {
              const st = byIssue.get(x.issue);
              return (
                <Card key={x.issue}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill cls={REASON_STYLE[x.reason]}>{x.reason}</Pill>
                    <Pill cls="border-border bg-muted text-foreground">{x.type}</Pill>
                    <span className="text-sm text-muted-foreground">{x.note}</span>
                  </div>
                  <Link href={`/requests/${x.issue}/`} className="mt-2 block text-base font-semibold hover:underline">
                    #{x.issue} {cleanRequestTitle(x.title, titles)}
                  </Link>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {st?.task && known.has(st.task) ? (
                      <Link href={`/tasks/${st.task}/`} className="underline">
                        {titles[st.task] ?? st.task}
                      </Link>
                    ) : null}
                    {x.requester && <span> · requested by <span className="font-mono">{x.requester}</span></span>}
                    <Link href={`/requests/${x.issue}/`} className="ml-2 underline">
                      open the request
                    </Link>
                  </div>
                  {x.reason === "approve" && st?.approval?.note && <p className="mt-2 text-sm text-muted-foreground">Last feedback: {st.approval.note}</p>}
                  {x.reason === "approve" && maint && (
                    <MaintainerActions issue={x.issue} approval={st?.approval ?? { state: "waiting", by: null, note: null }} maintainers={status.maintainers} repo={RELAY_REPO} />
                  )}
                </Card>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">Nothing is waiting for you.</p>
          )}
        </div>
      </section>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Your requests{items ? ` (${open.length} open)` : ""}</h2>
        {items === null ? (
          <div className="mt-2 space-y-3">
            <Skeleton lines={4} />
            <Skeleton lines={4} />
          </div>
        ) : items.length === 0 ? (
          <Card className="mt-2">
            <p className="text-sm">You have not opened any requests yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Request a change from any task page, or{" "}
              <Link href="/propose/new/" className="underline">
                propose a new task
              </Link>
              .
            </p>
          </Card>
        ) : (
          <>
            <div className="mt-2 space-y-3">
              {open.length ? open.map((r) => <RequestCard key={r.number} r={r} st={byIssue.get(r.number)} known={known} titles={titles} onPosted={() => void refresh()} />) : <p className="text-sm text-muted-foreground">Nothing open.</p>}
            </div>
            {closed.length > 0 && (
              <>
                <h3 className="mt-8 text-base font-semibold">Closed ({closed.length})</h3>
                <div className="mt-2 space-y-3">
                  {closed.map((r) => (
                    <RequestCard key={r.number} r={r} st={byIssue.get(r.number)} known={known} titles={titles} onPosted={() => void refresh()} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
