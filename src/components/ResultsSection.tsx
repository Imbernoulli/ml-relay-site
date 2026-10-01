"use client";

import { Fragment, useMemo, useState } from "react";
import type { TaskData, LbSummary, LbRow, Setting } from "@/lib/types";
import { arrow, colLabel, fmt, fmtScore } from "@/lib/format";
import MetricBarChart from "./MetricBarChart";
import { Badge } from "./ui";

function roleOf(t: TaskData, s: LbSummary): { label: string; tone: "oracle" | "muted" | "agent" } {
  if (s.kind === "agent") return { label: "agent", tone: "agent" };
  const b = t.baselines.find((x) => x.slug === s.arm);
  if (b?.is_oracle) return { label: "oracle", tone: "oracle" };
  return { label: "", tone: "muted" };
}

function colsForSetting(t: TaskData, st: Setting): { scored: string[]; reported: string[] } {
  const scored = st.metrics.filter((m) => t.leaderboard.metric_columns.includes(m));
  const reported = t.leaderboard.reported_columns.filter((c) => st.labels.some((l) => c === l || c.endsWith("_" + l)) && !scored.includes(c));
  return { scored, reported };
}

function MeanCell({ s, c, dir }: { s: LbSummary; c: string; dir?: string }) {
  const m = s.mean[c];
  const sd = s.std[c];
  if (m === undefined) return <td className="px-3 py-2 text-right text-muted-foreground">—</td>;
  return (
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums" title={`${s.mean_source[c] ?? ""}${dir ? `; ${dir} is better` : ""}`}>
      {fmt(m)}
      {sd !== undefined && <span className="text-muted-foreground"> ± {fmt(sd, 3)}</span>}
    </td>
  );
}

function SeedRows({ rows, cols }: { rows: LbRow[]; cols: string[] }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.arm + r.seed} className="border-t border-border/60 bg-muted/30 text-xs text-muted-foreground">
          <td className="px-3 py-1.5 pl-8">seed {r.seed}</td>
          <td className="px-3 py-1.5" />
          <td className="px-3 py-1.5" />
          {cols.map((c) => (
            <td key={c} className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
              {fmt(r.values[c] as number)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function SettingTable({ t, st, kinds }: { t: TaskData; st: Setting; kinds: "baseline"[] }) {
  const [perSeed, setPerSeed] = useState(false);
  const { scored, reported } = colsForSetting(t, st);
  const [showReported, setShowReported] = useState(false);
  const cols = showReported ? [...scored, ...reported] : scored;
  const dirs = Object.fromEntries((t.scoring?.terms ?? []).map((x) => [x.metric, x.direction]));
  const sums = t.leaderboard.summaries
    .filter((s) => (kinds as string[]).includes(s.kind))
    .filter((s) => cols.some((c) => s.mean[c] !== undefined));
  const armScore = (arm: string) => t.scoring?.arms?.[arm]?.settings.find((x) => x.name === st.name)?.score;
  sums.sort((a, b) => (armScore(b.arm) ?? -1) - (armScore(a.arm) ?? -1));
  if (!sums.length) return <p className="text-sm text-muted-foreground">No baseline rows for this setting.</p>;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={perSeed} onChange={(e) => setPerSeed(e.target.checked)} /> per-seed rows
        </label>
        {reported.length > 0 && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showReported} onChange={(e) => setShowReported(e.target.checked)} /> reported, unscored columns ({reported.length})
          </label>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/60 text-left text-xs">
              <th className="px-3 py-2 font-medium">Arm</th>
              <th className="px-3 py-2 font-medium" />
              <th className="px-3 py-2 text-right font-medium" title="setting score at the ML-Relay 0.1 anchor">Setting score</th>
              {cols.map((c) => (
                <th key={c} className={`px-3 py-2 text-right font-medium ${scored.includes(c) ? "" : "text-muted-foreground"}`}>
                  <span title={c}>{colLabel(t, st, c)}</span> {arrow(dirs[c])}
                  {!scored.includes(c) && <span className="block text-[10px] font-normal">not scored</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sums.map((s) => {
              const r = roleOf(t, s);
              const seedRows = t.leaderboard.rows.filter((x) => x.kind === s.kind && x.arm === s.arm && x.seed !== "mean");
              return (
                <Fragment key={s.arm}>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">
                      <span className="font-sans">{t.baselines.find((x) => x.slug === s.arm)?.name ?? s.arm}</span>
                      <span className="ml-1 text-[10px] text-muted-foreground">n={s.n_seeds}</span>
                    </td>
                    <td className="px-3 py-2">
                      {r.label && <Badge tone={r.tone}>{r.label}</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtScore(armScore(s.arm))}</td>
                    {cols.map((c) => (
                      <MeanCell key={c} s={s} c={c} dir={dirs[c]} />
                    ))}
                  </tr>
                  {perSeed && <SeedRows rows={seedRows} cols={cols} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ResultsSection({ t, publicMode = false }: { t: TaskData; publicMode?: boolean }) {
  const settings = t.settings.filter((s) => !s.auxiliary && s.metrics.length);
  const agentSums = t.leaderboard.summaries.filter((s) => s.kind === "agent");
  const agentCols = useMemo(() => t.leaderboard.scored_columns.filter((c) => agentSums.some((s) => s.mean[c] !== undefined)), [t, agentSums]);
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Mean ± sample standard deviation over seeds. The mean is the leaderboard&apos;s own <code>seed=mean</code> row where one exists; otherwise
        it is computed here from the per-seed rows (hover a cell for which). Baselines are sorted by their setting score.
      </p>
      {settings.map((st) => (
        <div key={st.name}>
          <h4 className="mb-1 flex flex-wrap items-center gap-2 text-base font-semibold">
            <span title={st.name}>{st.display ?? st.name}</span>
          </h4>
          <SettingTable t={t} st={st} kinds={["baseline"]} />
          <div className="mt-3">
            <MetricBarChart t={t} setting={st} />
          </div>
        </div>
      ))}
      {!publicMode && <div>
        <h4 className="mb-2 text-base font-semibold">Agent rows (separate; never merged with baselines)</h4>
        {agentSums.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agent rows in this task&apos;s leaderboard.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-sky-500/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky-500/10 text-left text-xs">
                  <th className="px-3 py-2 font-medium">Agent model</th>
                  <th className="px-3 py-2 font-medium">Rows</th>
                  {agentCols.map((c) => (
                    <th key={c} className="px-3 py-2 text-right font-medium" title={c}>
                      {colLabel(t, null, c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentSums.map((s) => (
                  <tr key={s.arm} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{s.arm}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{s.n_seeds} seed row(s)</td>
                    {agentCols.map((c) => (
                      <MeanCell key={c} s={s} c={c} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-[11px] text-muted-foreground">
              Historical native-harness agent runs recorded in <code>leaderboard.csv</code>; they predate the current ML-Relay settings and are not
              scored here.
            </p>
          </div>
        )}
      </div>}
    </div>
  );
}
