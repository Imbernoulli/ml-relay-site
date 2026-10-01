import { loadIndex, loadStatus, siteMode } from "@/lib/data";
import { NewTaskProposals } from "@/components/RequestStatus";
import TaskCatalogue from "@/components/TaskCatalogue";
import Link from "next/link";

export default function Home() {
  const idx = loadIndex();
  const status = loadStatus();
  const mode = siteMode();
  const nSettings = idx.tasks.reduce((a, t) => a + t.settings.length, 0);
  const nBaselines = idx.tasks.reduce((a, t) => a + t.baselines.length, 0);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {mode === "internal" && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-warn-border bg-warn-bg px-3 py-1 text-xs font-medium text-warn-text">
          Internal · ML-Relay is not public · this site shows the full bundles
        </div>
      )}
      <h1 className="text-3xl font-bold tracking-tight">ML-Relay</h1>
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
        ML-Relay is a collection of open machine-learning research tasks. If something in a task looks wrong, request a change on that
        task&apos;s page. If there is a research problem you think matters, one where you would like to see how far today&apos;s models can go,
        propose it as a new task.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/propose/"
          className="rounded-lg border border-emerald-600/60 bg-emerald-600/15 px-4 py-2 text-sm font-semibold text-emerald-800 hover:border-emerald-600 dark:text-emerald-200"
        >
          Propose a new task
        </Link>
        <span className="text-sm text-muted-foreground">To change an existing task, open it below and use &ldquo;Request a change&rdquo;.</span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Tasks", idx.tasks.length],
          ["Evaluation settings", nSettings],
          ["Baseline arms", nBaselines],
          ["Areas", new Set(idx.tasks.map((t) => (t.area ?? "").split(" / ")[0])).size],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <NewTaskProposals status={status} />
      <div className="mt-8">
        <TaskCatalogue tasks={idx.tasks} status={status} />
      </div>
      <details className="group mt-10 rounded-xl border border-border bg-card">
        <summary className="flex items-center gap-2 px-4 py-3 text-sm font-semibold">
          <span className="chev text-muted-foreground">▸</span>
          How is ML-Relay different from MLS-Bench?
        </summary>
        <ul className="list-disc space-y-1.5 border-t border-border px-4 py-3 pl-9 text-sm leading-relaxed">
          <li>
            It is a more advanced framework that covers more fields and sits closer to real research: each task uses the papers&apos; own
            models, data and evaluation protocols.
          </li>
          <li>
            MLS-Bench collected classical tasks from the field&apos;s past decades. ML-Relay focuses on research problems people are actively
            pushing in 2025–2026 and that are still unsolved.
          </li>
        </ul>
      </details>
    </div>
  );
}
