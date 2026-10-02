"use client";

import { useCallback, useEffect, useState } from "react";
import { COLLAB_SETTINGS_URL, decideAccess, HttpError, inviteCollaborator, listAccessRequests, type AccessRequest } from "@/lib/access";
import Spinner from "./Spinner";

/** Maintainers: pending access requests, approved by inviting the person as a collaborator. Renders nothing for others. */
export default function AccessQueue() {
  const [reqs, setReqs] = useState<AccessRequest[] | null>(null);
  const [allowed, setAllowed] = useState(true);
  const load = useCallback(() => {
    listAccessRequests()
      .then((r) => {
        setReqs(r.filter((x) => x.state === "pending"));
        setAllowed(true);
      })
      .catch(() => setAllowed(false));
  }, []);
  useEffect(load, [load]);
  if (!allowed || reqs === null) return null;
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">Access requests ({reqs.length})</h2>
      <div className="mt-2 space-y-3">
        {reqs.length ? reqs.map((r) => <Row key={r.login} r={r} onDone={load} />) : <p className="text-sm text-muted-foreground">No pending access requests.</p>}
      </div>
    </section>
  );
}

function Row({ r, onDone }: { r: AccessRequest; onDone: () => void }) {
  const [perm, setPerm] = useState<"push" | "triage">("push");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; settings?: boolean } | null>(null);
  const approve = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await inviteCollaborator(r.login, perm);
      await decideAccess(r.login, "approved");
      setMsg({ ok: true, text: "Invitation sent; they must accept it on GitHub." });
      setTimeout(onDone, 2500);
    } catch (e) {
      if (e instanceof HttpError && e.status === 403)
        setMsg({ ok: false, settings: true, text: "GitHub refused the invitation: this sign-in session lacks the Administration permission (sign out and back in to refresh it). Nothing was recorded. You can invite them from the repository settings:" });
      else setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not approve." });
    } finally {
      setBusy(false);
    }
  };
  const deny = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await decideAccess(r.login, "denied");
      setMsg({ ok: true, text: "Denied." });
      setTimeout(onDone, 1500);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not deny." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {r.avatar_url && <img src={r.avatar_url} alt="" width={28} height={28} className="h-7 w-7 rounded-full" />}
        <a href={r.html_url || `https://github.com/${r.login}`} target="_blank" rel="noreferrer" className="font-mono text-sm font-semibold hover:underline">
          {r.login}
        </a>
        {r.at && <span className="ml-auto text-xs text-muted-foreground">{r.at.slice(0, 16).replace("T", " ")} UTC</span>}
      </div>
      {r.note && <p className="mt-2 text-sm">{r.note}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <select value={perm} onChange={(e) => setPerm(e.target.value as "push" | "triage")} className="rounded-md border border-border bg-background px-2 py-1">
          <option value="push">Write</option>
          <option value="triage">Triage</option>
        </select>
        <button type="button" onClick={() => void approve()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600/60 bg-emerald-600 px-3 py-1 font-semibold text-white disabled:opacity-70">
          {busy && <Spinner className="h-3.5 w-3.5" />}Approve and invite
        </button>
        <button type="button" onClick={() => void deny()} disabled={busy} className="rounded-md border border-red-600/60 px-3 py-1 font-semibold text-red-800 dark:text-red-200">
          Deny
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-800 dark:text-amber-200"}`}>
          {msg.text}{" "}
          {msg.settings && (
            <a href={COLLAB_SETTINGS_URL} target="_blank" rel="noreferrer" className="underline">
              collaborator settings
            </a>
          )}
        </p>
      )}
    </div>
  );
}
