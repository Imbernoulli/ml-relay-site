"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isSignedIn } from "@/lib/github";
import { hasRepoAccess, INVITATIONS_URL, listAccessRequests, myAccessRequest } from "@/lib/access";
import { AUTO_ACCESS_EVENT } from "@/lib/autoAccess";

const CACHE = "mlrelay-access-notices";

/** Navbar: the maintainer's pending access-request count, and the "accept your invitation" hint for an approved visitor. */
export default function AccessNotices() {
  const [pending, setPending] = useState(0);
  const [invite, setInvite] = useState(false);
  const [autoSent, setAutoSent] = useState(false);
  // the sign-in just filed an access request automatically: say so (it disappears after a while)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const on = () => {
      setAutoSent(true);
      if (t) clearTimeout(t);
      t = setTimeout(() => setAutoSent(false), 15000);
    };
    window.addEventListener(AUTO_ACCESS_EVENT, on);
    return () => {
      window.removeEventListener(AUTO_ACCESS_EVENT, on);
      if (t) clearTimeout(t);
    };
  }, []);
  useEffect(() => {
    if (!isSignedIn()) return;
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE) || "null");
      if (c && Date.now() - c.at < 120000) {
        setPending(c.pending);
        setInvite(c.invite);
        return;
      }
    } catch {}
    (async () => {
      let p = 0;
      let inv = false;
      try {
        p = (await listAccessRequests()).filter((r) => r.state === "pending").length;
      } catch {}
      try {
        const me = await myAccessRequest();
        if (me.state === "approved") inv = (await hasRepoAccess()) === false;
      } catch {}
      setPending(p);
      setInvite(inv);
      try {
        sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), pending: p, invite: inv }));
      } catch {}
    })();
  }, []);
  // a fixed slot for the count and a floating hint: nothing in the navbar moves when they arrive
  return (
    <>
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
        {pending > 0 && (
          <Link href="/me/#access-requests" title={`${pending} pending access request${pending === 1 ? "" : "s"}`} className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {pending}
          </Link>
        )}
      </span>
      {autoSent && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 max-w-xs rounded-lg border border-sky-500/60 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900 shadow-lg dark:bg-sky-950 dark:text-sky-200"
        >
          Access requested automatically. The maintainer has been notified; GitHub emails you an invitation once it is approved.
          <button type="button" onClick={() => setAutoSent(false)} className="ml-2 underline">
            OK
          </button>
        </div>
      )}
      {invite && (
        <a
          href={INVITATIONS_URL}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-4 right-4 z-50 max-w-xs rounded-lg border border-amber-500/60 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow-lg dark:bg-amber-950 dark:text-amber-200"
        >
          Accept your invitation at github.com/Imbernoulli/ML-Relay/invitations
        </a>
      )}
    </>
  );
}
