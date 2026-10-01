"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { finishOAuth } from "@/lib/github";
import Spinner from "@/components/Spinner";
import { RETURN_KEY } from "@/lib/issueForm";

export default function Callback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    const state = q.get("state");
    // Drop the one-time code from the address bar and history either way.
    window.history.replaceState(null, "", window.location.pathname);
    if (q.get("error")) {
      setError(q.get("error_description") || "GitHub did not authorize the sign-in.");
      return;
    }
    if (!code || !state) {
      setError("This page is only reached from GitHub's sign-in.");
      return;
    }
    finishOAuth(code, state)
      .then(() => {
        // Back to the page that started the sign-in (e.g. a half-filled form), else My work.
        let to = "/me/";
        try {
          const r = sessionStorage.getItem(RETURN_KEY);
          sessionStorage.removeItem(RETURN_KEY);
          if (r && r.startsWith("/")) {
            const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
            to = base && r.startsWith(base) ? r.slice(base.length) || "/" : r;
          }
        } catch {}
        router.replace(to);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Sign-in failed."));
  }, [router]);

  if (!error)
    return (
      <div className="flex flex-col items-center gap-3 text-muted-foreground" role="status" aria-live="polite">
        <Spinner className="h-8 w-8" />
        <p className="text-base font-medium text-foreground">Connecting to GitHub…</p>
        <p className="text-sm">Signing you in.</p>
      </div>
    );
  return (
    <>
      <p className="text-sm">{error}</p>
      <Link href="/me/" className="mt-3 inline-block text-sm underline">
        Back to My work
      </Link>
    </>
  );
}
