"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { finishOAuth } from "@/lib/github";

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
      .then(() => router.replace("/me/"))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Sign-in failed."));
  }, [router]);

  if (!error) return <p className="text-sm text-muted-foreground">Signing you in…</p>;
  return (
    <>
      <p className="text-sm">{error}</p>
      <Link href="/me/" className="mt-3 inline-block text-sm underline">
        Back to My work
      </Link>
    </>
  );
}
