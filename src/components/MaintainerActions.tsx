"use client";

import { useEffect, useState } from "react";
import { cachedViewer, commentOnIssue, GitHubError, isSignedIn, viewer } from "@/lib/github";
import type { Approval } from "@/lib/types";
import Spinner from "./Spinner";

/** The signed-in visitor's GitHub login ("" while unknown, null when signed out). */
export function useLogin(): string | null | "" {
  const [login, setLogin] = useState<string | null | "">("");
  useEffect(() => {
    const sync = () => {
      if (!isSignedIn()) return setLogin(null);
      const v = cachedViewer();
      if (v) return setLogin(v.login);
      viewer()
        .then((x) => setLogin(x.login))
        .catch(() => setLogin(null));
    };
    sync();
    window.addEventListener("mlrelay-auth", sync);
    return () => window.removeEventListener("mlrelay-auth", sync);
  }, []);
  return login;
}

export function isMaintainer(login: string | null | "", maintainers: string[] | undefined): boolean {
  return Boolean(login) && (maintainers ?? []).some((m) => m.toLowerCase() === String(login).toLowerCase());
}

type Mode = null | "approve" | "feedback" | "reject";

/** Approve / feedback / reject for a request awaiting maintainer approval; shown only to maintainers. */
export default function MaintainerActions({
  issue,
  approval,
  maintainers,
  repo = "Imbernoulli/ML-Relay",
}: {
  issue: number;
  approval: Approval | null | undefined;
  maintainers: string[] | undefined;
  repo?: string;
}) {
  const login = useLogin();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!isMaintainer(login, maintainers)) return null;
  if (!approval || (approval.state !== "waiting" && approval.state !== "feedback")) return null;

  const post = async () => {
    if (busy || !mode) return;
    const t = text.trim();
    if ((mode === "feedback" || mode === "reject") && !t) return setErr(mode === "reject" ? "Give a reason." : "Write the feedback.");
    const body = mode === "approve" ? `/approve${t ? ` ${t}` : ""}` : mode === "reject" ? `/reject ${t}` : t;
    setBusy(true);
    setErr(null);
    try {
      await commentOnIssue(issue, body);
      setDone(mode === "approve" ? "Approved." : mode === "reject" ? "Rejected." : "Feedback posted.");
      setMode(null);
      setText("");
    } catch (e) {
      if (e instanceof GitHubError && e.status === 403) setErr("The sign-in app lacks write access; post it on GitHub instead.");
      else if (e instanceof GitHubError && e.status === 401) setErr("Your GitHub session expired. Sign in again.");
      else setErr(e instanceof Error ? e.message : "Could not post.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
        {done} The status here updates within a couple of minutes.
      </p>
    );
  const btn = "rounded-md border px-2.5 py-1 text-xs font-semibold";
  return (
    <div className="mt-2 rounded-lg border border-violet-500/40 bg-violet-500/5 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-violet-800 dark:text-violet-200">Maintainer</span>
        <button type="button" onClick={() => setMode(mode === "approve" ? null : "approve")} className={`${btn} border-emerald-600/60 ${mode === "approve" ? "bg-emerald-600 text-white" : "text-emerald-800 dark:text-emerald-200"}`}>
          Approve
        </button>
        <button type="button" onClick={() => setMode(mode === "feedback" ? null : "feedback")} className={`${btn} border-sky-600/60 ${mode === "feedback" ? "bg-sky-600 text-white" : "text-sky-800 dark:text-sky-200"}`}>
          Feedback
        </button>
        <button type="button" onClick={() => setMode(mode === "reject" ? null : "reject")} className={`${btn} border-red-600/60 ${mode === "reject" ? "bg-red-600 text-white" : "text-red-800 dark:text-red-200"}`}>
          Reject
        </button>
        <a href={`https://github.com/${repo}/issues/${issue}`} target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-muted-foreground underline">
          issue #{issue}
        </a>
      </div>
      {mode && (
        <div className="mt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={mode === "approve" ? "Notes for the agent (optional)" : mode === "reject" ? "Reason (required)" : "Your feedback"}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void post()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-foreground/30 bg-foreground px-3 py-1 text-xs font-semibold text-background disabled:opacity-70"
            >
              {busy && <Spinner />}
              {mode === "approve" ? "Post /approve" : mode === "reject" ? "Post /reject" : "Post feedback"}
            </button>
            <button type="button" onClick={() => setMode(null)} className="text-xs text-muted-foreground underline">
              Cancel
            </button>
          </div>
        </div>
      )}
      {err && <p className="mt-1.5 text-xs text-red-700 dark:text-red-300">{err}</p>}
    </div>
  );
}
