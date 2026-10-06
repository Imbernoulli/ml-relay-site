"use client";

import Link from "next/link";
import { refreshLiveStatus } from "@/lib/liveStatus";
import { useEffect, useMemo, useState } from "react";
import MarkdownContent from "./MarkdownContent";
import SignInButton from "./SignInButton";
import RequestAccess from "./RequestAccess";
import Spinner from "./Spinner";
import { createIssue, GitHubError, isSignedIn, oauthConfigured, warmUpSignIn } from "@/lib/github";
import {
  addOptimistic,
  buildIssueBody,
  githubFormUrl,
  issueTitle,
  newTaskHints,
  RETURN_KEY,
  type IssueForm,
} from "@/lib/issueForm";
import { RELAY_REPO } from "@/lib/site";
import { cleanRequestTitle, type TaskTitles } from "@/lib/requestTitle";

type Submit =
  | { s: "idle" }
  | { s: "sending" }
  | { s: "done"; number: number; url: string; title: string }
  | { s: "error"; msg: string; noAccess?: boolean; noWrite?: boolean };

/** One of ML-Relay's GitHub issue forms, filled in on the site and filed with the visitor's own GitHub access. */
export default function IssueFormView({
  form,
  kind,
  draftKey,
  locked = {},
  next,
  titles = {},
}: {
  form: IssueForm;
  kind: "change" | "new task";
  draftKey: string;
  locked?: Record<string, string>;
  next: React.ReactNode;
  titles?: TaskTitles;
}) {
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({ ...locked });
  const [signedIn, setSignedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [touched, setTouched] = useState(false);
  const [sub, setSub] = useState<Submit>({ s: "idle" });

  // restore the draft (survives the sign-in redirect) and watch the session
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (d && typeof d === "object") {
        if (typeof d.title === "string") setTitle(d.title);
        if (d.values && typeof d.values === "object") setValues({ ...d.values, ...locked });
      }
    } catch {}
    const sync = () => setSignedIn(isSignedIn());
    sync();
    if (!isSignedIn()) warmUpSignIn();
    setMounted(true);
    window.addEventListener("mlrelay-auth", sync);
    return () => window.removeEventListener("mlrelay-auth", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!mounted || sub.s === "done") return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ title, values }));
    } catch {}
  }, [mounted, draftKey, title, values, sub.s]);

  const fields = form.fields;
  const missing = useMemo(
    () => fields.filter((f) => f.required && f.id && !(values[f.id] ?? "").trim()).map((f) => f.label ?? f.id!),
    [fields, values],
  );
  const hints = kind === "new task" ? newTaskHints(values) : {};
  const ghUrl = githubFormUrl(RELAY_REPO, form, locked.task ? { task: locked.task, title: `${form.title}${locked.task}: ` } : {});

  const submit = async () => {
    setTouched(true);
    if (missing.length) return;
    setSub({ s: "sending" });
    try {
      const fullTitle = issueTitle(form, title, values, locked.task);
      const r = await createIssue(fullTitle, buildIssueBody(form, values), form.labels);
      refreshLiveStatus();
      addOptimistic({ number: r.number, title: fullTitle, url: r.html_url, kind, created: new Date().toISOString() });
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      setSub({ s: "done", number: r.number, url: r.html_url, title: cleanRequestTitle(fullTitle, titles) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e instanceof GitHubError && e.status === 403)
        setSub({ s: "error", noWrite: true, msg: "The sign-in app lacks write access to issues, so the request could not be filed here. Open the GitHub form instead; your answers are kept below." });
      else if (e instanceof GitHubError && e.status === 404)
        setSub({ s: "error", noAccess: true, msg: `You need to be a collaborator on ${RELAY_REPO} to file requests.` });
      else if (e instanceof GitHubError && e.status === 401)
        setSub({ s: "error", msg: "Your GitHub session expired. Sign in again; your answers are kept." });
      else if (e instanceof GitHubError && e.status === 422)
        setSub({ s: "error", msg: "GitHub rejected the request (a label may be missing on the repository). Open the GitHub form instead." });
      else setSub({ s: "error", msg: e instanceof Error ? e.message : "Could not file the request." });
    }
  };

  if (sub.s === "done") {
    return (
      <div className="rounded-xl border-2 border-emerald-500/60 bg-emerald-500/10 p-5">
        <h2 className="text-lg font-semibold">
          Filed as{" "}
          <a href={sub.url} target="_blank" rel="noreferrer" className="underline">
            issue #{sub.number}
          </a>
        </h2>
        <p className="mt-1 text-sm font-medium">{sub.title}</p>
        <div className="mt-2 text-sm leading-relaxed">{next}</div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`${kind === "new task" ? "/proposals/" : "/modifications/"}#issue-${sub.number}`}
            className="rounded-lg border border-foreground/30 bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            {kind === "new task" ? "See it on Proposals" : "See it on Modifications"}
          </Link>
          <Link href="/me/" className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
            Go to My work
          </Link>
          <a href={sub.url} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
            Open the issue on GitHub
          </a>
        </div>
      </div>
    );
  }

  const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
  const optional = fields.filter((f) => f.type !== "markdown" && f.id && !f.required && !(f.id in locked));
  const optionalFilled = optional.some((f) => (values[f.id!] ?? "").trim()) || Boolean(title.trim());
  const renderField = (f: (typeof fields)[number], i: number) => {
        if (f.type === "markdown")
          return (
            <div key={i} className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <MarkdownContent content={f.value ?? ""} />
            </div>
          );
        if (!f.id) return null;
        const id = f.id;
        const isLocked = id in locked;
        const err = touched && f.required && !(values[id] ?? "").trim();
        const v = values[id] ?? "";
        return (
          <div key={id}>
            <label htmlFor={`f-${id}`} className="text-sm font-semibold">
              {f.label} {f.required && <span className="text-red-600">*</span>}
            </label>
            {f.description && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                <MarkdownContent content={f.description} />
              </div>
            )}
            {f.type === "input" ? (
              <input
                id={`f-${id}`}
                value={v}
                readOnly={isLocked}
                placeholder={f.placeholder}
                onChange={(e) => setValues({ ...values, [id]: e.target.value })}
                className={`${inputCls} mt-1 ${isLocked ? "bg-muted font-mono" : ""}`}
              />
            ) : f.type === "dropdown" ? (
              <select id={`f-${id}`} value={v} onChange={(e) => setValues({ ...values, [id]: e.target.value })} className={`${inputCls} mt-1`}>
                <option value="">Select…</option>
                {(f.options ?? []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <textarea
                id={`f-${id}`}
                value={v}
                readOnly={isLocked}
                placeholder={f.placeholder}
                rows={id === "settings" || id === "baselines" ? 7 : 4}
                onChange={(e) => setValues({ ...values, [id]: e.target.value })}
                className={`${inputCls} mt-1 font-mono text-[13px]`}
              />
            )}
            {err && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Required.</p>}
            {kind === "new task" && !f.required && !isLocked && !v.trim() && (
              <p className="mt-1 text-xs text-muted-foreground">Optional: if you leave it blank, the agent proposes one.</p>
            )}
            {v.trim() &&
              (hints[id] ?? []).map((h) => (
                <p key={h} className="mt-1 text-xs text-sky-700 dark:text-sky-300">
                  Suggestion: {h}
                </p>
              ))}
          </div>
        );
      };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-5"
    >
      {fields.filter((f) => f.type === "markdown" || f.required || (f.id && f.id in locked)).map(renderField)}
      {
        <details open={optionalFilled} className="rounded-lg border border-border px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Add details (optional){" "}
            <span className="font-normal text-muted-foreground">
              {kind === "new task" ? "· the agent proposes anything you leave blank" : "· the agent works these out from your description"}
            </span>
          </summary>
          <div className="mt-4 space-y-5">
            <div>
              <label htmlFor="f-title" className="text-sm font-semibold">
                Title
              </label>
              <input
                id="f-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === "new task" ? "A short name for the task (optional)" : "A short summary of the change (optional)"}
                className={`${inputCls} mt-1`}
              />
              {!title.trim() && <p className="mt-1 text-xs text-muted-foreground">Left blank, the title is taken from your first answer.</p>}
            </div>
            {optional.map(renderField)}
          </div>
        </details>
      }

      {sub.s === "error" && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <p>{sub.msg}</p>
          {sub.noAccess && (
            <div className="mt-2">
              <RequestAccess />
            </div>
          )}
          {(sub.noWrite || sub.msg.includes("GitHub form")) && (
            <a href={ghUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium underline">
              Open the GitHub form
            </a>
          )}
        </div>
      )}
      {touched && missing.length > 0 && <p className="text-sm text-red-600 dark:text-red-400">Fill in: {missing.join(", ")}.</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {!mounted ? null : signedIn ? (
          <button
            type="submit"
            disabled={sub.s === "sending"}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/60 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-70"
          >
            {sub.s === "sending" && <Spinner />}
            {sub.s === "sending" ? "Filing…" : kind === "new task" ? "Submit proposal" : "Submit change request"}
          </button>
        ) : oauthConfigured ? (
          <span
            onClickCapture={() => {
              try {
                sessionStorage.setItem(RETURN_KEY, window.location.pathname);
                localStorage.setItem(draftKey, JSON.stringify({ title, values }));
              } catch {}
            }}
          >
            <SignInButton label="Sign in with GitHub to submit" />
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Sign-in is not available right now.</span>
        )}
        <a href={ghUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline">
          Prefer GitHub? Open the form there
        </a>
      </div>
    </form>
  );
}
