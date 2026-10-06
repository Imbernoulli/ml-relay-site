"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AUTH_EVENT, cachedViewer, clearToken, isSignedIn, oauthConfigured, viewer, warmUpSignIn, type Viewer } from "@/lib/github";
import SignInButton from "./SignInButton";
import { ensureAccessRequest } from "@/lib/autoAccess";

/** Navbar account area. Rendered empty on the server; the session is read in the browser only. */
export default function AccountMenu() {
  const [mounted, setMounted] = useState(false);
  const [me, setMe] = useState<Viewer | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => {
      const on = isSignedIn();
      setSignedIn(on);
      if (!on) {
        setMe(null);
        warmUpSignIn();
        return;
      }
      setMe(cachedViewer());
      viewer()
        .then(setMe)
        .catch(() => undefined);
      void ensureAccessRequest(); // once per session: files the access request of a signed-in non-collaborator
    };
    sync();
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!mounted) return null;
  if (!signedIn) {
    if (oauthConfigured) return <SignInButton variant="nav" />;
    return (
      <Link href="/me/" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground">
        Sign in
      </Link>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Link href="/me/" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-muted/60" title="My work">
        {me?.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatar_url} alt="" className="h-6 w-6 rounded-full" />
        )}
        <span className="hidden font-mono text-xs sm:inline">{me?.login ?? "My work"}</span>
      </Link>
      <button
        type="button"
        onClick={() => {
          clearToken();
        }}
        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      >
        Sign out
      </button>
    </span>
  );
}
