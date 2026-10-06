"use client";

import { useEffect, useState } from "react";
import { commentOnIssue, createIssue, GitHubError, isSignedIn, oauthConfigured } from "@/lib/github";
import { refreshLiveStatus } from "@/lib/liveStatus";
import { RETURN_KEY } from "@/lib/issueForm";
import { postBody, threadTitle, type PostKind } from "@/lib/threads";
import RequestAccess from "./RequestAccess";
import SignInButton from "./SignInButton";
import Spinner from "./Spinner";

type Kind = PostKind | "agent" | "approve";

const CHOICES: { kind: Kind; label: string; hint: string }[] = [
  { kind: "comment", label: "Comment", hint: "Discuss freely: comments never start the agent." },
  { kind: "request", label: "Request a change", hint: "One paragraph is enough. Everyone on the task is notified; the agent starts only after /approve." },
  { kind: "method-idea", label: "Method idea", hint: "A method you would like to see tried on this task." },
];

/** Write into a task's one discussion thread (creating it when the task has none yet). */
export default function ThreadComposer({
  task,
  thread,
  approved = false,
  mayApprove = false,
  defaultKind = "comment",
  onPosted,
}: {
  task: string;
  thread: number | null;
  approved?: boolean;
  mayApprove?: boolean;
  defaultKind?: Kind;
  onPosted?: (issue: number) => void;
}) {
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; noAccess?: boolean } | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const draftKey = `mlrelay-thread-draft-${task}`;

  useEffect(() => {
    const sync = () => setSignedIn(isSignedIn());
    sync();
    try {
      const d = localStorage.getItem(draftKey);
      if (d) setText(d);
    } catch {}
    window.addEventListener("mlrelay-auth", sync);
    return () => window.removeEventListener("mlrelay-auth", sync);
  }, [draftKey]);
  useEffect(() => {
    try {
      if (text) localStorage.setItem(draftKey, text);
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [text, draftKey]);

  const choices: { kind: Kind; label: string; hint: string }[] = [
    ...CHOICES,
    ...(approved ? [{ kind: "agent" as Kind, label: "Ask the agent", hint: "A round is running: this message goes to the agent (/run)." }] : []),
    ...(mayApprove && !approved && thread
      ? [{ kind: "approve" as Kind, label: "Start the agent", hint: "Starts a round of agent work on this thread (/approve). Optional notes go to the agent." }]
      : []),
  ];
  const current = choices.find((c) => c.kind === kind) ?? choices[0];
  const needsText = kind !== "approve";

  const post = async () => {
    if (busy || (needsText && !text.trim())) return;
    setBusy(true);
    setMsg(null);
    try {
      const body = postBody(kind, text);
      let n = thread;
      if (n) {
        await commentOnIssue(n, body);
      } else {
        // no thread yet: open it; the backend labels it task-thread and notifies the task's people
        const r = await createIssue(threadTitle(task, text), body, ["relay-request"]);
        n = r.number;
      }
      refreshLiveStatus();
      setText("");
      setMsg({
        ok: true,
        text:
          kind === "approve"
            ? "Approved: the agent starts shortly."
            : kind === "agent"
              ? "Sent to the agent."
              : thread
                ? "Posted. Everyone on the task's thread gets an email."
                : `Posted as the task's discussion thread #${n}. The task's developers and the maintainers are notified.`,
      });
      onPosted?.(n);
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) setMsg({ ok: false, noAccess: true, text: "You need to be a collaborator on Imbernoulli/ML-Relay to post." });
      else if (e instanceof GitHubError && e.status === 403) setMsg({ ok: false, text: "The sign-in app could not post this. Post on GitHub instead." });
      else if (e instanceof GitHubError && e.status === 401) setMsg({ ok: false, text: "Your GitHub session expired. Sign in again; your text is kept." });
      else setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not post." });
    } finally {
      setBusy(false);
    }
  };

  if (signedIn === false)
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
        <p>Sign in with GitHub to join the discussion, request a change or suggest a method.</p>
        {oauthConfigured && (
          <span
            className="mt-2 inline-block"
            onClickCapture={() => {
              try {
                sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.hash);
              } catch {}
            }}
          >
            <SignInButton label="Sign in to post" />
          </span>
        )}
      </div>
    );

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="What are you posting?">
        {choices.map((c) => (
          <button
            key={c.kind}
            type="button"
            role="radio"
            aria-checked={kind === c.kind}
            onClick={() => setKind(c.kind)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              kind === c.kind ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{current.hint}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={kind === "approve" ? "Notes for the agent (optional)" : "Write or paste one paragraph (Markdown)"}
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || (needsText && !text.trim())}
          onClick={() => void post()}
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600/60 bg-emerald-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy && <Spinner className="h-3.5 w-3.5" />}
          {kind === "approve" ? "Start the agent" : kind === "agent" ? "Send to the agent" : "Post"}
        </button>
        {thread && (
          <a href={`https://github.com/Imbernoulli/ML-Relay/issues/${thread}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline">
            Reply on GitHub
          </a>
        )}
      </div>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-800 dark:text-amber-200"}`}>{msg.text}</p>}
      {msg?.noAccess && (
        <div className="mt-2">
          <RequestAccess compact />
        </div>
      )}
    </div>
  );
}
