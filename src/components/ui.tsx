import type { ReactNode } from "react";
import { VERDICT_STYLE } from "@/lib/format";

export function Badge({ children, tone = "muted", title }: { children: ReactNode; tone?: "muted" | "accent" | "warn" | "hidden" | "oracle" | "null" | "control" | "agent"; title?: string }) {
  const cls = {
    muted: "border-border bg-muted text-muted-foreground",
    accent: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warn: "border-warn-border bg-warn-bg text-warn-text",
    hidden: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
    oracle: "border-emerald-600/60 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 font-semibold",
    null: "border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    control: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    agent: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

export function Verdict({ tag, text }: { tag?: string; text?: string }) {
  if (!tag && !text) return <span className="text-muted-foreground">not recorded</span>;
  const style = (tag && VERDICT_STYLE[tag]) || "border-border bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${style}`} title={text}>
      {tag || (text || "").replace(/\*/g, "").slice(0, 24)}
    </span>
  );
}

export function Section({ id, n, title, children, lead }: { id: string; n?: number | string; title: string; children: ReactNode; lead?: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-28">
      <h2 className="flex items-baseline gap-3 border-b border-border pb-2 text-xl font-semibold tracking-tight">
        {n !== undefined && <span className="font-mono text-sm text-muted-foreground">{n}</span>}
        {title}
      </h2>
      {lead && <div className="mt-2 text-sm text-muted-foreground">{lead}</div>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Fold({ summary, children, open = false, className = "" }: { summary: ReactNode; children: ReactNode; open?: boolean; className?: string }) {
  return (
    <details open={open} className={`group rounded-lg border border-border bg-card ${className}`}>
      <summary className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
        <span className="chev text-muted-foreground">▸</span>
        <span className="min-w-0 flex-1">{summary}</span>
      </summary>
      <div className="border-t border-border px-4 py-3">{children}</div>
    </details>
  );
}

export function KV({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-anywhere">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Missing({ what }: { what?: string }) {
  return <span className="text-muted-foreground" title={what ? `${what}: not available` : "not available"}>—</span>;
}
