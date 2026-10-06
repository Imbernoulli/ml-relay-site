"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { StatusIssue } from "@/lib/types";
import { cleanRequestTitle, type TaskTitles } from "@/lib/requestTitle";
import { requestState, STATE_STYLE } from "@/lib/requestState";
import MarkdownContent from "./MarkdownContent";
import MaintainerActions from "./MaintainerActions";

const KIND: Record<StatusIssue["type"], string> = { change: "change request", "new task": "new-task proposal", maintenance: "maintainer change" };

/** Long text folded to a few lines, with "Show more" to expand it in place. */
export function Clamp({ children, lines = 6 }: { children: React.ReactNode; lines?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const max = `${lines * 1.6}rem`;
  useEffect(() => {
    const el = ref.current;
    if (el) setLong(el.scrollHeight > el.clientHeight + 4);
  }, [children]);
  return (
    <div>
      <div ref={ref} className="relative overflow-hidden" style={open ? undefined : { maxHeight: max }}>
        {children}
        {!open && long && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-xs font-medium underline">
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/** The request's own words: its form fields (what to change, why, papers ...) or its one paragraph. */
export function RequestText({ r, clamp = true }: { r: StatusIssue; clamp?: boolean }) {
  const d = r.details;
  if (!d) return null;
  if (d.withheld)
    return <p className="mt-2 text-sm italic text-muted-foreground">Details withheld: this request&apos;s text is not published on the site.</p>;
  const fields = d.text?.fields ?? [];
  const body = d.text?.body;
  if (!fields.length && !body) return null;
  const content = (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      {body ? <MarkdownContent content={body} /> : null}
      {fields.map((f, i) => (
        <div key={i}>
          {f.label && <div className="not-prose mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</div>}
          <MarkdownContent content={f.text} />
        </div>
      ))}
    </div>
  );
  return <div className="mt-2">{clamp ? <Clamp>{content}</Clamp> : content}</div>;
}

/** A request as a card: state, who, when, what they asked for, and the agent's latest one-liner. */
export default function RequestCard({
  r,
  titles = {},
  showTask = false,
  maintainers,
  repo = "Imbernoulli/ML-Relay",
}: {
  r: StatusIssue;
  titles?: TaskTitles;
  showTask?: boolean;
  maintainers?: string[];
  repo?: string;
}) {
  const state = requestState(r);
  const posts = r.details?.posts?.length ?? 0;
  return (
    <li id={`issue-${r.issue}`} className="scroll-mt-20 list-none rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${STATE_STYLE[state]}`}>{state}</span>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5">{KIND[r.type] ?? r.type}</span>
        {showTask && r.task && (
          <Link href={`/tasks/${r.task}/`} className="font-medium underline">
            {titles[r.task] ?? r.task}
          </Link>
        )}
        <span className="text-muted-foreground">
          {r.requester && (
            <>
              by <span className="font-mono">{r.requester}</span>
            </>
          )}
          {r.opened && <> · {r.opened.slice(0, 10)}</>}
          {state !== "awaiting approval" && state !== "declined" && r.stage && <> · {r.stage}</>}
        </span>
      </div>
      <Link href={`/requests/${r.issue}/`} className="mt-1.5 block text-base font-semibold leading-snug hover:underline">
        {cleanRequestTitle(r.title, titles)}
      </Link>
      {r.replacement && (
        <div className="mt-1 text-sm text-amber-800 dark:text-amber-200">
          Replaces this task with <span className="font-mono">{titles[r.replacement] ?? r.replacement}</span>.
        </div>
      )}
      <RequestText r={r} />
      {r.details?.summary && (
        <p className="mt-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm">
          <span className="font-medium">Agent&apos;s latest report:</span> {r.details.summary}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Link href={`/requests/${r.issue}/`} className="underline">
          {posts ? `${posts} post${posts === 1 ? "" : "s"} · open the request` : "open the request"}
        </Link>
        <a href={`https://github.com/${repo}/issues/${r.issue}`} target="_blank" rel="noreferrer" className="font-mono underline" title="Private repository: GitHub shows 404 unless you are a collaborator.">
          issue #{r.issue}
        </a>
        {r.pr && (
          <a href={`https://github.com/${repo}/pull/${r.pr}`} target="_blank" rel="noreferrer" className="font-mono underline">
            PR #{r.pr}
            {r.pr_state ? ` (${r.pr_state})` : ""}
          </a>
        )}
      </div>
      {state === "awaiting approval" && <MaintainerActions issue={r.issue} approval={r.approval} maintainers={maintainers} repo={repo} />}
    </li>
  );
}
