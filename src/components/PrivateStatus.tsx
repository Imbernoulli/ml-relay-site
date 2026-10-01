"use client";

import { useEffect, useState } from "react";
import { NoAccessError, statusComment } from "@/lib/relayStatus";
import RequestAccess from "./RequestAccess";

/** Signed-in My work only: the agent's detailed status comment, fetched live, shown as plain text. */
export default function PrivateStatus({ issue }: { issue: number }) {
  const [c, setC] = useState<{ body: string; url: string; updated: string } | null>(null);
  const [noAccess, setNoAccess] = useState(false);
  useEffect(() => {
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
  if (noAccess)
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>You need to be a collaborator on Imbernoulli/ML-Relay to see the agent&apos;s details.</span>
        <RequestAccess compact />
      </div>
    );
  if (!c || !c.body) return null;
  return (
    <details className="mt-3 rounded-lg border border-border bg-muted/30">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium">Agent&apos;s detailed status · {c.updated.slice(0, 16).replace("T", " ")} UTC</summary>
      <div className="border-t border-border px-3 py-2">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-anywhere text-xs leading-relaxed">{c.body}</pre>
        <a href={c.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">
          Open on GitHub
        </a>
      </div>
    </details>
  );
}
