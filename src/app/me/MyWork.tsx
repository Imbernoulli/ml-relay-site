"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui";
import {
  clearToken,
  getToken,
  GitHubError,
  myRequests,
  oauthConfigured,
  setToken,
  startOAuth,
  viewer,
  type MyRequest,
  type Viewer,
} from "@/lib/github";
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

function day(iso: string): string {
  return iso.slice(0, 10);
}

function SignIn({ onToken }: { onToken: () => void }) {
  const [pat, setPat] = useState("");
  return (
    <Card className="mt-6">
      {oauthConfigured && (
        <>
          <button
            type="button"
            onClick={startOAuth}
            className="rounded-md border border-foreground/30 bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Sign in with GitHub
          </button>
          <p className="mt-2 text-xs text-muted-foreground">Read-only access to issues and pull requests of {RELAY_REPO}.</p>
          <div className="my-4 border-t border-border" />
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pat.trim()) return;
          setToken(pat);
          setPat("");
          onToken();
        }}
      >
        <label htmlFor="pat" className="text-sm font-semibold">
          {oauthConfigured ? "Or use a personal access token" : "Sign in with a personal access token"}
        </label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Create a{" "}
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" className="underline">
            fine-grained token
          </a>{" "}
          with repository access to {RELAY_REPO} only and read-only permission for Issues and Pull requests. It is kept for this browser tab only and
          sent nowhere except api.github.com.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            id="pat"
            type="password"
            autoComplete="off"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="github_pat_…"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm"
          />
          <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            Use token
          </button>
        </div>
      </form>
    </Card>
  );
}

function RequestCard({ r }: { r: MyRequest }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Pill cls="border-border bg-muted text-foreground">{r.kind}</Pill>
        {r.stage && <Pill cls="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300">{r.stage}</Pill>}
        {r.waitingForYou && <Pill cls="border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200">waiting for your reply</Pill>}
        <Pill cls={r.state === "open" ? PR_STYLE.open : PR_STYLE.closed}>{r.state}</Pill>
        <span className="ml-auto text-xs text-muted-foreground">updated {day(r.updated)}</span>
      </div>
      <a href={r.url} target="_blank" rel="noreferrer" className="mt-2 block text-base font-semibold hover:underline">
        #{r.number} {r.title}
      </a>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
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
        <span className="text-muted-foreground">opened {day(r.created)}</span>
      </div>
      {r.lastAgent && (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Latest agent reply · {day(r.lastAgent.when)}
          </div>
          <p className="mt-1 text-sm leading-relaxed">{r.lastAgent.excerpt}</p>
          <a href={r.lastAgent.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">
            Read and reply on GitHub
          </a>
        </div>
      )}
    </Card>
  );
}

type Load =
  | { s: "signed-out" }
  | { s: "loading" }
  | { s: "error"; msg: string }
  | { s: "ok"; me: Viewer; items: MyRequest[] };

export default function MyWork() {
  const [load, setLoad] = useState<Load>({ s: "loading" });

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setLoad({ s: "signed-out" });
      return;
    }
    setLoad({ s: "loading" });
    try {
      const me = await viewer();
      const items = await myRequests(me.login);
      setLoad({ s: "ok", me, items });
    } catch (e) {
      if (e instanceof GitHubError && e.status === 401) {
        clearToken();
        setLoad({ s: "error", msg: "GitHub rejected the token (expired or revoked). Please sign in again." });
      } else if (e instanceof GitHubError && e.status === 404) {
        setLoad({ s: "error", msg: `Your account cannot see ${RELAY_REPO}. You need to be a collaborator on the private repository.` });
      } else if (e instanceof GitHubError && e.status === 403) {
        setLoad({ s: "error", msg: "GitHub refused the request: the token lacks Issues / Pull requests read access, or the API rate limit was hit." });
      } else {
        setLoad({ s: "error", msg: e instanceof Error ? e.message : "Could not load your requests." });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (load.s === "loading") return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;
  if (load.s === "signed-out") return <SignIn onToken={refresh} />;
  if (load.s === "error")
    return (
      <>
        <p className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm">{load.msg}</p>
        {!getToken() && <SignIn onToken={refresh} />}
      </>
    );

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
        <button
          type="button"
          onClick={() => {
            clearToken();
            setLoad({ s: "signed-out" });
          }}
          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
        >
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
          <div className="mt-2 space-y-3">{open.length ? open.map((r) => <RequestCard key={r.number} r={r} />) : <p className="text-sm text-muted-foreground">None.</p>}</div>
          {closed.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Closed ({closed.length})</h2>
              <div className="mt-2 space-y-3">{closed.map((r) => <RequestCard key={r.number} r={r} />)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
