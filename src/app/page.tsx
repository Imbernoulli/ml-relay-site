import { loadIndex, loadGaps, siteMode } from "@/lib/data";
import TaskCatalogue from "@/components/TaskCatalogue";
import MarkdownContent from "@/components/MarkdownContent";
import Link from "next/link";

export default function Home() {
  const idx = loadIndex();
  const gaps = loadGaps();
  const intro = idx.intro_md.replace(/^# ML-Relay\s*/, "");
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
      <div className="mt-3 max-w-4xl">
        <MarkdownContent content={intro} />
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
      <p className="mt-3 text-xs text-muted-foreground">
        Generated {idx.generated}{" "}from the ML-Relay task bundles and README. Scores come from each task&apos;s own scorer and use
        the ML-Relay anchor: the weakest reference arm maps to 0, the strongest to {idx.relay_ref_score}. {gaps.n_gaps} unresolved fields are
        listed on the <Link href="/gaps/" className="underline">gaps page</Link>.
      </p>
      <div className="mt-8">
        <TaskCatalogue tasks={idx.tasks} />
      </div>
    </div>
  );
}
