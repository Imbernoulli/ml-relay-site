"use client";

import { useEffect, useState } from "react";
import { INVITATIONS_URL, myAccessRequest, requestAccess, type AccessRequest } from "@/lib/access";
import Spinner from "./Spinner";

/** For signed-in visitors without access to the private repo: an in-site access request the maintainer approves. */
export default function RequestAccess({ compact = false }: { compact?: boolean }) {
  const [me, setMe] = useState<AccessRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    myAccessRequest()
      .then(setMe)
      .catch(() => setMe({ login: "", state: "none" }));
  }, []);
  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      setMe(await requestAccess(note.trim()));
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  };
  const sz = compact ? "text-xs" : "text-sm";
  if (!me) return <Spinner />;
  if (me.state === "has-access") return <span className={`${sz} text-emerald-700 dark:text-emerald-300`}>You have access; reload the page.</span>;
  if (me.state === "pending")
    return <span className={`${sz} rounded-md border border-sky-500/50 bg-sky-500/10 px-2 py-0.5 font-medium text-sky-800 dark:text-sky-200`}>Access requested · waiting for approval</span>;
  if (me.state === "approved")
    return (
      <span className={sz}>
        Approved.{" "}
        <a href={INVITATIONS_URL} target="_blank" rel="noreferrer" className="font-medium underline">
          Accept your invitation on GitHub
        </a>
        , then reload.
      </span>
    );
  return (
    <span className={`inline-flex flex-col gap-2 ${sz}`}>
      {me.state === "denied" && <span className="text-muted-foreground">Your earlier request was declined. You can ask again.</span>}
      {!open ? (
        <span className="inline-flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`rounded-md border border-emerald-600/60 bg-emerald-600/15 font-medium text-emerald-800 hover:border-emerald-600 dark:text-emerald-200 ${compact ? "px-2 py-0.5" : "px-3 py-1.5"}`}
          >
            Request access
          </button>
        </span>
      ) : (
        <span className="flex max-w-md flex-col gap-1.5">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="A short note for the maintainer (optional)" className="rounded-md border border-border bg-background px-2 py-1 text-sm" />
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => void send()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md border border-foreground/30 bg-foreground px-3 py-1 text-xs font-semibold text-background disabled:opacity-70">
              {busy && <Spinner />}Send request
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs underline">
              Cancel
            </button>
          </span>
        </span>
      )}
      {err && <span className="text-xs text-red-700 dark:text-red-300">{err}</span>}
    </span>
  );
}
