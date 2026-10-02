"use client";

import { useState } from "react";
import { startOAuth } from "@/lib/github";
import Spinner from "./Spinner";

/** Starts GitHub sign-in with instant feedback (the redirect can take a moment). */
export default function SignInButton({ variant = "primary", label }: { variant?: "primary" | "nav"; label?: string }) {
  const [busy, setBusy] = useState(false);
  const click = () => {
    if (busy) return;
    setBusy(true);
    // Paint the spinner before the redirect starts.
    requestAnimationFrame(() => {
      startOAuth().catch(() => setBusy(false));
    });
  };
  const cls =
    variant === "primary"
      ? "inline-flex items-center gap-2 rounded-lg border border-foreground/30 bg-foreground px-5 py-2.5 text-base font-semibold text-background hover:opacity-90 disabled:opacity-80"
      : "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-80";
  return (
    <button type="button" onClick={click} disabled={busy} aria-busy={busy} className={cls}>
      {busy ? (
        <>
          <Spinner />
          {variant === "primary" ? "Redirecting to GitHub…" : "Redirecting…"}
        </>
      ) : variant === "primary" ? (
        label ?? "Sign in with GitHub"
      ) : (
        label ?? "Sign in"
      )}
    </button>
  );
}
