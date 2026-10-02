"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TaskTitles } from "@/lib/requestTitle";
import RequestDetail from "./RequestDetail";

/** 404 page; /requests/<n>/ for a request newer than the published build renders the request view. */
export default function NotFoundView({ titles, maintainers, repo }: { titles: TaskTitles; maintainers?: string[]; repo: string }) {
  const [n, setN] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    const m = /\/requests\/(\d+)\/?$/.exec(window.location.pathname);
    setN(m ? Number(m[1]) : null);
  }, []);
  if (n === undefined) return null;
  if (n !== null) return <RequestDetail n={n} st={null} titles={titles} maintainers={maintainers} repo={repo} />;
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href="/" className="underline">
          Back to the tasks
        </Link>
      </p>
    </div>
  );
}
