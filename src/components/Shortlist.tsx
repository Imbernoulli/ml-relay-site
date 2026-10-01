"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getShortlist, onShortlistChange, setShortlist } from "@/lib/shortlist";

type T = { id: string; title: string; area: string | null };

export default function Shortlist({ tasks }: { tasks: T[] }) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const [mine, setMine] = useState<string[]>([]);
  const [shared, setShared] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setMine(getShortlist().filter((id) => byId.has(id)));
    sync();
    const ids = new URLSearchParams(window.location.search).get("ids");
    if (ids) setShared(ids.split(",").map((s) => s.trim()).filter((id) => byId.has(id)));
    setReady(true);
    return onShortlistChange(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;

  const move = (i: number, d: number) => {
    const next = [...mine];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setShortlist(next);
  };
  const share = async () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("ids", mine.join(","));
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link", url.toString());
    }
  };

  const Row = ({ id, i, editable }: { id: string; i: number; editable: boolean }) => {
    const t = byId.get(id)!;
    return (
      <li className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <span className="w-6 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
        <div className="min-w-0 flex-1">
          <Link href={`/tasks/${id}/`} className="font-semibold hover:underline">
            {t.title}
          </Link>
          {t.area && <div className="text-xs text-muted-foreground">{t.area}</div>}
        </div>
        {editable && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-40" aria-label="Move up">
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === mine.length - 1}
              className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-40"
              aria-label="Move down"
            >
              ↓
            </button>
            <button type="button" onClick={() => setShortlist(mine.filter((x) => x !== id))} className="rounded border border-border px-2 py-0.5 text-xs">
              Remove
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="mt-6 space-y-8">
      {shared && (
        <section>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Shared shortlist ({shared.length})</h2>
            <button
              type="button"
              onClick={() => setShortlist([...mine, ...shared.filter((x) => !mine.includes(x))])}
              className="rounded-lg border border-emerald-600/60 bg-emerald-600/15 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-200"
            >
              Save to my shortlist
            </button>
          </div>
          {shared.length ? (
            <ol className="mt-3 space-y-2">
              {shared.map((id, i) => (
                <Row key={id} id={id} i={i} editable={false} />
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">This link names no known tasks.</p>
          )}
        </section>
      )}
      <section>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">My shortlist ({mine.length})</h2>
          {mine.length > 0 && (
            <button type="button" onClick={share} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-foreground/40">
              {copied ? "Link copied" : "Share"}
            </button>
          )}
        </div>
        {mine.length ? (
          <ol className="mt-3 space-y-2">
            {mine.map((id, i) => (
              <Row key={id} id={id} i={i} editable />
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing yet. Star tasks with ☆ on the <Link href="/" className="underline">task list</Link> or on a task page.
          </p>
        )}
      </section>
    </div>
  );
}
