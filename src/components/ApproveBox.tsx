"use client";

import { useEffect, useState } from "react";
import { cachedViewer, GitHubError, isSignedIn, markReview, oauthConfigured, viewer, type ReviewMark } from "@/lib/github";
import { currentApprovals, setTaskMarks, useReviews } from "@/lib/reviews";
import { RETURN_KEY } from "@/lib/issueForm";
import SignInButton from "./SignInButton";
import RequestAccess from "./RequestAccess";
import Spinner from "./Spinner";

function when(at: string) {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? at : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Approver({ m, stale }: { m: ReviewMark; stale: boolean }) {
  return (
    <a
      href={`https://github.com/${m.login}`}
      target="_blank"
      rel="noreferrer"
      title={`${m.login} · approved ${when(m.at)}${stale ? " · an earlier version of this task" : ""}`}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-0.5 pr-2 text-xs hover:border-foreground/30 ${stale ? "opacity-50 grayscale" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={m.avatar_url} alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
      <span className="font-mono">{m.login}</span>
      {stale && <span className="text-[10px] text-muted-foreground">approved an earlier version</span>}
    </a>
  );
}

/** Reviewer approvals of one task: a toggle for signed-in reviewers, the approver list for everyone. */
export default function ApproveBox({ task, version }: { task: string; version: string | null | undefined }) {
  const { reviews, failed } = useReviews();
  const [login, setLogin] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; noAccess?: boolean } | null>(null);

  useEffect(() => {
    const sync = () => {
      const s = isSignedIn();
      setSignedIn(s);
      if (!s) return setLogin(null);
      const v = cachedViewer();
      if (v) setLogin(v.login);
      else
        viewer()
          .then((x) => setLogin(x.login))
          .catch(() => {});
    };
    sync();
    setMounted(true);
    window.addEventListener("mlrelay-auth", sync);
    return () => window.removeEventListener("mlrelay-auth", sync);
  }, []);

  const marks = reviews?.[task] ?? [];
  const current = currentApprovals(marks, version);
  const stale = marks.filter((m) => !current.includes(m));
  const mine = login ? marks.find((m) => m.login === login) : undefined;
  const mineCurrent = Boolean(mine && current.includes(mine));

  const toggle = async () => {
    if (!login || busy) return;
    const ok = !mineCurrent;
    const before = marks;
    const optimistic: ReviewMark[] = ok
      ? [
          ...marks.filter((m) => m.login !== login),
          { login, avatar_url: cachedViewer()?.avatar_url ?? `https://github.com/${login}.png?size=40`, at: new Date().toISOString(), version: version ?? "" },
        ]
      : marks.filter((m) => m.login !== login);
    setErr(null);
    setBusy(true);
    setTaskMarks(task, optimistic);
    try {
      setTaskMarks(task, await markReview(task, version ?? "", ok));
    } catch (e) {
      setTaskMarks(task, before);
      if (e instanceof GitHubError && (e.status === 403 || e.status === 404))
        setErr({ noAccess: true, msg: "Approving needs access to the private Imbernoulli/ML-Relay repository." });
      else if (e instanceof GitHubError && e.status === 401) setErr({ msg: "Your GitHub session expired. Sign in again." });
      else setErr({ msg: e instanceof Error ? e.message : "Could not save the approval." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {current.length > 0 && (
          <span className="rounded-full border border-emerald-600/50 bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">✓ Approved</span>
        )}
        {!mounted ? null : signedIn && login ? (
          <button
            type="button"
            onClick={() => void toggle()}
            disabled={busy}
            aria-pressed={mineCurrent}
            className={
              mineCurrent
                ? "inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/60 bg-emerald-600/15 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:opacity-90 dark:text-emerald-200"
                : "inline-flex items-center gap-1.5 rounded-lg border border-foreground/30 px-3 py-1.5 text-sm font-semibold hover:bg-muted"
            }
          >
            {busy && <Spinner />}
            {mineCurrent ? (
              <>
                Approved ✓ <span className="font-normal text-muted-foreground">· withdraw</span>
              </>
            ) : (
              "Approve"
            )}
          </button>
        ) : signedIn ? (
          <Spinner />
        ) : oauthConfigured ? (
          <span
            onClickCapture={() => {
              try {
                sessionStorage.setItem(RETURN_KEY, window.location.pathname);
              } catch {}
            }}
          >
            <SignInButton variant="nav" label="Sign in to approve" />
          </span>
        ) : null}
        {failed && !reviews && <span className="text-xs text-muted-foreground">Approvals could not be loaded.</span>}
      </div>
      {marks.length > 0 && (
        <div className="mt-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Approved by</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {current.map((m) => (
              <Approver key={m.login} m={m} stale={false} />
            ))}
            {stale.map((m) => (
              <Approver key={m.login} m={m} stale />
            ))}
          </div>
        </div>
      )}
      {err && (
        <div className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          <p>{err.msg}</p>
          {err.noAccess && (
            <div className="mt-2">
              <RequestAccess compact />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
