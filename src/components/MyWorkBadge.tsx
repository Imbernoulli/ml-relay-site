"use client";

import { useEffect, useState } from "react";
import { cachedViewer, isSignedIn } from "@/lib/github";
import { useLiveStatus } from "@/lib/liveStatus";
import { actionsFor, pendingActions } from "@/lib/actions";
import { isMaintainer } from "./MaintainerActions";

/** Navbar: how many requests wait on the signed-in visitor (live through the status stream). */
export default function MyWorkBadge({ maintainers }: { maintainers: string[] }) {
  const live = useLiveStatus();
  const [login, setLogin] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setLogin(isSignedIn() ? cachedViewer()?.login ?? null : null);
    read();
    window.addEventListener("mlrelay-auth", read);
    return () => window.removeEventListener("mlrelay-auth", read);
  }, []);
  if (!login) return null;
  const n = actionsFor(pendingActions(live, []), login, isMaintainer(login, maintainers)).length;
  if (!n) return null;
  return (
    <span title={`${n} request${n === 1 ? "" : "s"} waiting for you`} className="ml-1 rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
      {n}
    </span>
  );
}
