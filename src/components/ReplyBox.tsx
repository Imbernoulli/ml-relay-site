"use client";

import { useState } from "react";
import { commentOnIssue, GitHubError } from "@/lib/github";
import Spinner from "./Spinner";

/** Reply to the agent on an issue from the site (a "go" button and free text). */
export default function ReplyBox({ issue, url, onPosted, go = true, title }: { issue: number; url: string; onPosted: () => void; go?: boolean; title?: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const post = async (body: string) => {
    if (!body.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await commentOnIssue(issue, body.trim());
      setText("");
      setMsg({ ok: true, text: "Posted. The agent picks it up shortly." });
      setTimeout(onPosted, 1500);
    } catch (e) {
      if (e instanceof GitHubError && e.status === 403) setMsg({ ok: false, text: "The sign-in app lacks write access, so the reply could not be posted here. Reply on GitHub instead." });
      else if (e instanceof GitHubError && e.status === 404) setMsg({ ok: false, text: "You need to be a collaborator on Imbernoulli/ML-Relay to reply." });
      else setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not post the reply." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3">
      <div className="text-xs font-medium">{title ?? "The agent is waiting for your reply"}</div>
      {go && (
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void post("go")}
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600/60 bg-emerald-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-70"
        >
          {busy && <Spinner className="h-3.5 w-3.5" />}Go
        </button>
        <span className="self-center text-xs text-muted-foreground">or answer below</span>
      </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Your reply (Markdown)"
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !text.trim()} onClick={() => void post(text)} className="rounded-md border border-border px-3 py-1 text-sm font-medium hover:bg-muted disabled:opacity-50">
          Send
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs underline">
          Reply on GitHub
        </a>
      </div>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-800 dark:text-amber-200"}`}>{msg.text}</p>}
    </div>
  );
}
