"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GitHubError, isSignedIn, issueThread, openThreads, type ThreadComment, type ThreadIssue } from "@/lib/github";
import { STATUS_MARKER } from "@/lib/relayStatus";
import { canApprove, titleTask } from "@/lib/threads";
import { useLogin } from "./MaintainerActions";
import ThreadComposer from "./ThreadComposer";
import ThreadPost from "./ThreadPost";
import RequestAccess from "./RequestAccess";
import Spinner from "./Spinner";

const SHOW = 6;

/** A task's one discussion thread on its page: every request and discussion about the task, and a box to join in.
 *  The thread lives in the private ML-Relay repository, so it is read live with the visitor's own GitHub access. */
export default function TaskThread({
  task,
  thread: knownThread,
  maintainers = [],
  developers = {},
  defaultKind = "comment",
  readOnly = false,
}: {
  task: string;
  thread: number | null;
  maintainers?: string[];
  developers?: Record<string, string[]>;
  defaultKind?: "comment" | "request" | "method-idea";
  /** a deleted task: its thread stays readable, but nothing new can be posted or started */
  readOnly?: boolean;
}) {
  const login = useLogin();
  const [thread, setThread] = useState<number | null>(knownThread);
  const [data, setData] = useState<{ issue: ThreadIssue; comments: ThreadComment[] } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "noaccess" | "error" | "signedout">("idle");
  const [all, setAll] = useState(false);

  const load = useCallback(
    async (n: number | null) => {
      if (!isSignedIn()) return setState("signedout");
      setState("loading");
      try {
        let num = n;
        if (!num) {
          const open = await openThreads();
          num = open.filter((t) => titleTask(t.title) === task).map((t) => t.number).sort((a, b) => a - b)[0] ?? null;
        }
        setThread(num);
        setData(num ? await issueThread(num) : null);
        setState("idle");
      } catch (e) {
        setState(e instanceof GitHubError && e.status === 404 ? "noaccess" : "error");
      }
    },
    [task],
  );

  useEffect(() => {
    void load(knownThread);
    const f = () => void load(knownThread);
    window.addEventListener("mlrelay-auth", f);
    return () => window.removeEventListener("mlrelay-auth", f);
  }, [load, knownThread]);

  const labels = data?.issue.labels.map((l) => l.name) ?? [];
  const approved = labels.includes("approved");
  const posts = (data?.comments ?? []).filter((c) => !(c.body ?? "").includes(STATUS_MARKER) && !(c.body ?? "").includes("<!-- relay-thread-cc -->"));
  const shown = all ? posts : posts.slice(-SHOW);
  const mayApprove = canApprove(login, task, maintainers, developers);

  return (
    <section id="discussion" className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-base font-semibold">Discussion</h2>
        {thread && (
          <Link href={`/requests/${thread}/`} className="font-mono text-xs underline">
            thread #{thread}
          </Link>
        )}
        {data && (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${approved ? "border-amber-500/50 bg-amber-500/10" : "border-border bg-muted"}`}>
            {readOnly ? "closed: task deleted" : approved ? "agent round in progress" : "open for discussion"}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        One thread per task: every change request, method idea and discussion about this task goes here, and everyone on the task is emailed on each
        post. Discussion is free; a maintainer or one of the task&apos;s developers starts the agent.
      </p>

      {state === "loading" && !data && (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading the discussion…
        </p>
      )}
      {state === "noaccess" && (
        <div className="mt-3 text-sm">
          <p>The discussion is in the private Imbernoulli/ML-Relay repository; collaborators can read and join it.</p>
          <div className="mt-2">
            <RequestAccess />
          </div>
        </div>
      )}
      {state === "error" && <p className="mt-3 text-sm text-muted-foreground">The discussion could not be loaded right now.</p>}

      {data && (
        <ol className="mt-3 space-y-2">
          <ThreadPost user={data.issue.user} at={data.issue.created_at} url={data.issue.html_url} body={data.issue.body} first />
          {!all && posts.length > SHOW && (
            <li>
              <button type="button" onClick={() => setAll(true)} className="text-xs underline">
                Show {posts.length - SHOW} earlier post{posts.length - SHOW === 1 ? "" : "s"}
              </button>
            </li>
          )}
          {shown.map((c) => (
            <ThreadPost key={c.id} user={c.user} at={c.created_at} url={c.html_url} body={c.body} />
          ))}
        </ol>
      )}
      {readOnly && (
        <p className="mt-3 text-sm text-muted-foreground">This task was removed from ML-Relay: its discussion is kept for reference and is closed to new posts.</p>
      )}
      {!readOnly && state !== "noaccess" && state !== "error" && (
        <div className="mt-3">
          {state === "idle" && !thread && login && <p className="mb-2 text-sm text-muted-foreground">No discussion yet. Your first post opens the task&apos;s thread.</p>}
          <ThreadComposer task={task} thread={thread} approved={approved} mayApprove={mayApprove} defaultKind={defaultKind} onPosted={(n) => setTimeout(() => void load(n), 1200)} />
        </div>
      )}
    </section>
  );
}
