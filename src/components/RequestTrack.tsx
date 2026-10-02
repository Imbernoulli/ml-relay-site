"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken, isSignedIn } from "@/lib/github";
import { RELAY_REPO } from "@/lib/site";
import { liveRecord, useLiveStatus } from "@/lib/liveStatus";
import { agentThread, NoAccessError, type AgentReport } from "@/lib/relayStatus";
import MarkdownContent from "./MarkdownContent";
import ReplyBox from "./ReplyBox";
import Skeleton from "./Skeleton";
import { computeStages, displayProgress, lastAgentRunning, parseStatusTable, toMs, withCreated, type StageInput } from "@/lib/stages";
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
  pr = null,
  noReport = false,
  noPr = false,
  reportSlot = null,
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
  pr?: { number: number | null; state?: string | null } | null;
  /** the request page shows the report and the PR itself */
  noReport?: boolean;
  noPr?: boolean;
  /** the request page's own report, placed where the card's report goes (above the reply box) */
  reportSlot?: React.ReactNode;
}) {
  const [c, setC] = useState<{ body: string; url: string; updated: string } | null>(null);
  const [noAccess, setNoAccess] = useState(false);
  const [report, setReport] = useState<AgentReport | null>(null);
  const [full, setFull] = useState(false);
  const [tick, setTick] = useState(0);
  const [threadLoading, setThreadLoading] = useState(false);
  const [labels, setLabels] = useState<{ names: string[]; state: string; author: string } | null>(null);
  const [poll, setPoll] = useState(0);
  const [note, setNote] = useState(false);
  // a running clock for the "agent is working" timer
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  // signed in: re-read the issue and its comments every ~10 s while the tab is visible
  useEffect(() => {
    if (!isSignedIn()) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") setPoll((n) => n + 1);
    }, 10000);
    return () => clearInterval(id);
  }, []);
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
  }, [issue, poll]);
  useEffect(() => {
    if (!isSignedIn()) return;
    let live = true;
    if (poll === 0) setThreadLoading(true);
    agentThread(issue)
      .finally(() => live && setThreadLoading(false))
      .then((x) => {
        if (!live) return;
        setC(x.status);
        setReport(x.report);
      })
      .catch((e) => {
        if (live && e instanceof NoAccessError) setNoAccess(true);
      });
    return () => {
      live = false;
    };
  }, [issue, tick, poll]);

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
  if (report?.readyForGo) stageInput = { ...stageInput, readyForGo: report.readyForGo };
  const shown = displayProgress(progress);
  const isOpen = !(labels?.state === "closed" || stageInput.closed);
  const upd = Math.max(...[toMs(updated), newest(progress), fromLive && c ? toMs(c.updated) : NaN, pushed && rec ? toMs(rec.updated) : NaN].filter((x) => Number.isFinite(x)));

  // what the card asks of the visitor: nothing while the agent works
  const steps = progress?.steps ?? [];
  // the agent's own running step; a Daytona run in flight is background work, not the agent
  const runIdx = lastAgentRunning(steps);
  const lastRunning =
    runIdx >= 0 && !steps.slice(runIdx + 1).some((x) => x.state === "waiting" || x.state === "failed" || /\b(finished|ended|stopped)\b/i.test(x.label ?? "")) ? steps[runIdx] : null;
  const working = isOpen && ((lab ? lab.names.includes("relay-running") : Boolean(input.running)) || Boolean(lastRunning));
  const stages = computeStages(stageInput);
  const waitingReq = stages.note === "Waiting for your answers" || stages.note === "Waiting for your go";
  const needed = !working && isOpen && Boolean(report?.readyForGo) && waitingReq;
  const workStep = lastRunning ?? [...steps].reverse().find((x) => x.kind !== "created" && x.kind !== "approval") ?? null;
  const workSince = toMs(workStep?.t);
  const workEl = Number.isFinite(workSince) ? Math.max(1, Math.floor((now - workSince) / 60000)) : null;
  const prNum = (pushed && rec?.pr) || pr?.number || null;
  const prState = (pushed && rec?.pr_state) || pr?.state || stageInput.prState || null;
  const full2 = !compact && !noDetails;

  return (
    <div>
      <StageBar {...stageInput} />
      {shown?.steps?.length ? <ProgressTimeline progress={shown} compact={compact} /> : null}
      {full2 && working && (
        <div className="mt-3 rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-sm">
          <span className="font-semibold">The agent is working</span>
          {workStep?.label ? `: ${workStep.label}` : ""}
          {workEl !== null ? ` · ${workEl < 60 ? `${workEl} m` : `${Math.floor(workEl / 60)} h ${workEl % 60} m`}` : ""}. Nothing needed from you.
        </div>
      )}
      {full2 && !noReport && !working && threadLoading && !report && <Skeleton lines={5} className="mt-3" />}
      {full2 && !noReport && !working && report && (
        <div className="mt-3 rounded-lg border-2 border-emerald-600/40 bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-emerald-800 dark:text-emerald-200">
              {report.kind === "design-draft" ? "Design draft" : report.kind === "pilot-report" ? "Pilot report" : report.kind === "results" ? "Results" : report.kind === "final" ? "Final report" : "Agent update"}
            </span>
            <span>{report.updated.slice(0, 16).replace("T", " ")} UTC</span>
            <a href={report.url} target="_blank" rel="noreferrer" className="ml-auto underline">
              on GitHub
            </a>
          </div>
          <div className={`prose prose-sm relative max-w-none px-3 py-2 dark:prose-invert ${full ? "" : "max-h-[22rem] overflow-hidden"}`}>
            <MarkdownContent content={report.body} />
            {!full && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />}
          </div>
          <button type="button" onClick={() => setFull(!full)} className="px-3 pb-2 text-xs font-medium underline">
            {full ? "show less" : "show full"}
          </button>
        </div>
      )}
      {full2 && !working && reportSlot}
      {full2 && needed && report && (
        <ReplyBox
          issue={issue}
          url={report.url}
          onPosted={() => setTick((n) => n + 1)}
          go={report.readyForGo === "yes"}
          title={report.readyForGo === "no" ? "Answer the agent's questions" : "The agent is waiting for your go"}
        />
      )}
      {full2 && !needed && isOpen && (report || working) && c !== undefined && (
        <div className="mt-2">
          {note ? (
            <ReplyBox issue={issue} url={`https://github.com/${RELAY_REPO}/issues/${issue}`} onPosted={() => setTick((n) => n + 1)} go={false} title="Add a note for the agent" />
          ) : (
            <button type="button" onClick={() => setNote(true)} className="text-xs underline">
              add a note
            </button>
          )}
        </div>
      )}
      {noAccess && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>You need to be a collaborator on Imbernoulli/ML-Relay to see the agent&apos;s details.</span>
          <RequestAccess compact />
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {!compact &&
          !noDetails &&
          !noPr &&
          (prNum ? (
            <a href={`https://github.com/${RELAY_REPO}/pull/${prNum}`} target="_blank" rel="noreferrer" className="font-mono underline">
              PR #{prNum}
              {prState ? ` (${prState})` : ""}
            </a>
          ) : (
            <span>no PR yet</span>
          ))}
        <span>
          {fmt(upd) ? `updated ${fmt(upd)}` : null}
          {fromLive || pushed ? " · live" : null}
        </span>
        {!noLink && (
          <Link href={`/requests/${issue}/`} className="font-medium text-foreground underline">
            Open the request: reports, discussion, actions
          </Link>
        )}
      </div>
    </div>
  );
}
