"use client";

import { useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Setting, TaskData } from "@/lib/types";
import { fmt } from "@/lib/format";

const sub = () => () => {};

export default function MetricBarChart({ t, setting }: { t: TaskData; setting: Setting }) {
  const mounted = useSyncExternalStore(sub, () => true, () => false);
  const metrics = setting.metrics.filter((m) => t.leaderboard.metric_columns.includes(m));
  if (!metrics.length) return null;
  const dirs = Object.fromEntries((t.scoring?.terms ?? []).map((x) => [x.metric, x.direction]));
  return (
    <div className={`grid gap-3 ${metrics.length > 1 ? "lg:grid-cols-2" : ""}`}>
      {metrics.map((m) => {
        const data = t.leaderboard.summaries
          .filter((s) => s.kind !== "agent" && s.mean[m] !== undefined)
          .map((s) => {
            const b = t.baselines.find((x) => x.slug === s.arm);
            const kind = s.kind === "control" ? "control" : b?.is_oracle ? "oracle" : b?.is_null ? "null" : "anchor";
            return { arm: s.arm, mean: s.mean[m], err: s.std[m] ?? 0, kind, n: s.n_seeds };
          })
          .sort((a, b) => (dirs[m] === "lower" ? a.mean - b.mean : b.mean - a.mean));
        if (!data.length) return null;
        const h = Math.max(140, data.length * 30 + 50);
        return (
          <div key={m} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="break-anywhere font-mono font-medium">{m}</span>
              <span className="text-muted-foreground">{dirs[m] === "lower" ? "lower is better ↓" : "higher is better ↑"}</span>
            </div>
            <div style={{ height: h }}>
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmt(v, 3)} stroke="var(--border)" />
                    <YAxis type="category" dataKey="arm" width={120} tick={{ fontSize: 10, fill: "var(--foreground)" }} stroke="var(--border)" />
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as (typeof data)[number];
                        return (
                          <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow">
                            <div className="font-mono font-medium">{p.arm}</div>
                            <div className="text-muted-foreground">
                              {fmt(p.mean)}
                              {p.err ? ` ± ${fmt(p.err, 3)}` : ""} · n={p.n} · {p.kind}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="mean" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                      {data.map((d) => (
                        <Cell
                          key={d.arm}
                          fill={d.kind === "oracle" ? "var(--accent)" : d.kind === "control" ? "#f59e0b" : d.kind === "null" ? "#94a3b8" : "#8a8f98"}
                          fillOpacity={d.kind === "control" || d.kind === "null" ? 0.6 : 0.9}
                        />
                      ))}
                      <ErrorBar dataKey="err" width={4} strokeWidth={1.2} stroke="var(--foreground)" direction="x" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded bg-muted/50" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
