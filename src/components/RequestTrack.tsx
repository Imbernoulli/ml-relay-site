"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken, isSignedIn } from "@/lib/github";
import { RELAY_REPO } from "@/lib/site";
import { liveRecord, useLiveStatus } from "@/lib/liveStatus";
import { NoAccessError, statusComment } from "@/lib/relayStatus";
import { displayProgress, parseStatusTable, toMs, withCreated, type StageInput } from "@/lib/stages";
import { approvalOf, withApproval } from "@/lib/approval";
import type { Approval, ProgressRecord } from "@/lib/types";
import StageBar from "./StageBar";
import ProgressTimeline from "./ProgressTimeline";
import RequestAccess from "./RequestAccess";

function fmt(ms: number): string | null {
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC" : null;
}

function newest(p: ProgressRecord | null | undefined): number {
  let m = NaN;
  for (const s of p?.steps ?? []) {
    const t = toMs(s.t);
    if (Number.isFinite(t) && !(t <= m)) m = t;
  }
  return m;
}

/** A request's progress on its card: the stage bar, the detailed steps, the agent's status
 *  comment, and when it was last updated. Signed-in visitors get the live status comment,
 *  which replaces the published steps whenever it is newer. */
export default function RequestTrack({
  input,
  issue,
  opened,
  requester,
  approval,
  updated,
  compact = false,
  noDetails = false,
  noLink = false,
}: {
  input: StageInput;
  issue: number;
  opened?: string | null;
  requester?: string | null;
  approval?: Approval | null;
  updated?: string | null;
  compact?: boolean;
  noDetails?: boolean;
  noLink?: boolean;
}) {
  const [c, setC] = useState<{ body: string; url: string; updated: string } | null>(null);
  const [noAccess, setNoAccess] = useState(false);
  const [labels, setLabels] = useState<{ names: string[]; state: string; author: string } | null>(null);
  // the issue's current labels, live (signed in), so the bar follows them at once
  useEffect(() => {
    if (!isSignedIn()) return;
    const tok = getToken();
    if (!tok) return;
    let live = true;
    fetch(`https://api.github.com/repos/${RELAY_REPO}/issues/${issue}`, {
      headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json" },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((it) => {
        if (live && it) setLabels({ names: (it.labels ?? []).map((l: { name: string }) => l.name), state: it.state, author: it.user?.login ?? "" });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [issue]);
  useEffect(() => {
    if (!isSignedIn()) return;
    let live = true;
    statusComment(issue)
      .then((x) => live && setC(x))
      .catch((e) => {
        if (live && e instanceof NoAccessError) setNoAccess(true);
      });
    return () => {
      live = false;
    };
  }, [issue]);

  const liveAll = useLiveStatus();
  const rec = liveRecord(liveAll, issue);
  let progress: ProgressRecord | null = input.progress ?? null;
  let fromLive = false;
  let pushed = false;
  // the backend's live push wins over the static build when it is newer
  if (rec && toMs(rec.updated) > Math.max(toMs(updated), newest(progress) || 0) - 0) {
    if (rec.steps?.length) progress = withApproval({ current: null, steps: rec.steps }, approval);
    pushed = true;
  }
  if (c && !(pushed && toMs(rec!.updated) >= toMs(c.updated))) {
    const steps = parseStatusTable(c.body, c.updated);
    const liveP: ProgressRecord = { current: null, steps };
    if (steps.length && (!(newest(progress) >= newest(liveP)) || (progress?.steps.length ?? 0) < steps.length)) {
      progress = withApproval(liveP, approval);
      fromLive = true;
    }
  }
  progress = withCreated(progress, opened, requester);
  let stageInput: StageInput = { ...input, progress };
  const liveLabels = pushed && rec ? { names: rec.labels ?? [], state: rec.state === "closed" ? "closed" : "open", author: rec.requester } : null;
  if (pushed && rec?.pr_state) stageInput = { ...stageInput, prState: rec.pr_state as StageInput["prState"] };
  const lab = liveLabels ?? labels;
  if (lab) {
    const labels = lab;
    const ls = labels.names;
    const ph = ls.find((l) => l.startsWith("newtask-phase-"));
    const hasApprovalLabel = ls.some((l) => l === "awaiting-approval" || l === "approved" || l === "rejected");
    stageInput = {
      ...stageInput,
      phase: ph ? ph.slice(-1).toUpperCase() : stageInput.phase,
      waitingGo: ls.includes("newtask-awaiting-go"),
      done: stageInput.done || ls.includes("newtask-done"),
      closed: labels.state === "closed" && stageInput.prState !== "merged" && !ls.includes("newtask-done"),
      approval: hasApprovalLabel ? approvalOf(ls, labels.author, []).a : stageInput.approval,
    };
  }
  const shown = displayProgress(progress);
  const upd = Math.max(...[toMs(updated), newest(progress), fromLive && c ? toMs(c.updated) : NaN, pushed && rec ? toMs(rec.updated) : NaN].filter((x) => Number.isFinite(x)));

  return (
    <div>
      <StageBar {...stageInput} />
      {shown?.steps?.length ? <ProgressTimeline progress={shown} compact={compact} /> : null}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
        <span>
          {fmt(upd) ? `updated ${fmt(upd)}` : null}
          {fromLive ? " · live from the agent's status comment" : pushed ? " · live" : null}
        </span>
        {!noLink && (
          <Link href={`/requests/${issue}/`} className="font-medium text-foreground underline">
            Open the request: reports, discussion, actions
          </Link>
        )}
      </div>
      {noAccess && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>You need to be a collaborator on Imbernoulli/ML-Relay to see the agent&apos;s details.</span>
          <RequestAccess compact />
        </div>
      )}
      {!compact && !noDetails && c?.body && (
        <details className="mt-2 rounded-lg border border-border bg-muted/30">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium">Agent&apos;s detailed status · {c.updated.slice(0, 16).replace("T", " ")} UTC</summary>
          <div className="border-t border-border px-3 py-2">
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-anywhere text-xs leading-relaxed">{c.body}</pre>
            <a href={c.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">
              Open on GitHub
            </a>
          </div>
        </details>
      )}
    </div>
  );
}
