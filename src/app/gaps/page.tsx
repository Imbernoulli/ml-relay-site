import Link from "next/link";
import { loadGaps } from "@/lib/data";

export const metadata = { title: "ML-Relay · gap report", robots: { index: false, follow: false } };

export default function GapsPage() {
  const g = loadGaps();
  const byTask = new Map<string, typeof g.gaps>();
  for (const x of g.gaps) byTask.set(x.task, [...(byTask.get(x.task) || []), x]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold">Gap report</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Fields the generator could not resolve from the delivered files (the ml-relay-v2 bundles and README.md). Each is shown as &ldquo;—&rdquo; on its task page; nothing was estimated.
        Generated {g.generated}; {g.n_gaps} gaps. Machine-readable copy: <code>src/data/gaps.json</code>.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/60 text-left text-xs">
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2 text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(g.by_field).map(([k, v]) => (
              <tr key={k} className="border-t border-border">
                <td className="px-3 py-1.5 font-mono text-xs">{k}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-8 space-y-4">
        {[...byTask.entries()].map(([task, gs]) => (
          <div key={task} className="rounded-lg border border-border bg-card p-4">
            <Link href={`/tasks/${task}/`} className="font-mono text-sm font-medium underline">
              {task}
            </Link>
            <ul className="mt-2 space-y-1 text-sm">
              {gs.map((x, i) => (
                <li key={i} className="break-anywhere">
                  <span className="font-mono text-xs">{x.field}</span> <span className="text-muted-foreground">— {x.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
