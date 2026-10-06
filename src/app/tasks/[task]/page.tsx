import Link from "next/link";
import { deletedIds, loadIndex, loadPeople, loadStatus, loadTask, taskDevelopers, taskTitles } from "@/lib/data";
import DeletedBanner, { DeletedBadge } from "@/components/DeletedBanner";
import type { Baseline, DescSection, TaskData, Term } from "@/lib/types";
import { arrow, fmt, fmtScore, firstParagraph, gb, hours } from "@/lib/format";
import MarkdownContent from "@/components/MarkdownContent";
import AnnotatedCodeBlock from "@/components/AnnotatedCodeBlock";
import CodeBlock from "@/components/CodeBlock";
import DiffBlock from "@/components/DiffBlock";
import EnvViewer from "@/components/EnvViewer";
import AgentViewer from "@/components/AgentViewer";
import PublicTask from "@/components/PublicTask";
import TaskImage from "@/components/TaskImage";
import StarButton from "@/components/StarButton";
import IssueButtons from "@/components/IssueButtons";
import ApproveBox from "@/components/ApproveBox";
import { splitArea } from "@/lib/areas";
import RequestStatus from "@/components/RequestStatus";
import { gpuLabel } from "@/lib/site";
import type { PublicTaskData } from "@/lib/types";
import ResultsSection from "@/components/ResultsSection";
import TaskPeople from "@/components/TaskPeople";
import TaskThread from "@/components/TaskThread";
import { Badge, Card, Fold, KV, Missing, Section } from "@/components/ui";

export function generateStaticParams() {
  // live tasks, plus the deleted ones (their pages stay, frozen and marked Deleted)
  return [...loadIndex().tasks.map((t) => t.id), ...deletedIds()].map((task) => ({ task }));
}

export async function generateMetadata({ params }: { params: Promise<{ task: string }> }) {
  const { task } = await params;
  const t = loadTask(task);
  return { title: t ? `ML-Relay · ${t.title ?? t.id}` : "ML-Relay · task", robots: { index: false, follow: false } };
}

const TOC = [
  ["question", "1 Question"],
  ["algorithm", "2 Algorithm"],
  ["surface", "3 Editable surface"],
  ["baselines", "4 Baselines"],
  ["settings", "5 Settings"],
  ["scoring", "6 Scoring"],
  ["results", "7 Results"],
  ["appendix", "Appendix"],
  ["discussion", "Discussion"],
];

function DescBlocks({ secs, kinds, empty }: { secs: DescSection[]; kinds: string[]; empty?: string }) {
  const pick = secs.filter((s) => kinds.includes(s.kind) && s.md.trim());
  if (!pick.length) return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
  return (
    <div className="space-y-4">
      {pick.map((s, i) => (
        <div key={i}>
          {s.title && <h4 className="mb-1 text-sm font-semibold">{s.title} <span className="font-normal text-muted-foreground">· instruction.md</span></h4>}
          <MarkdownContent content={s.md} />
        </div>
      ))}
    </div>
  );
}

function Staff({ text, label }: { text?: string; label: string }) {
  return (
    <div className="rounded-lg border-l-4 border-emerald-500/60 bg-muted/50 px-4 py-3">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {text ? <MarkdownContent content={text} /> : <p className="text-sm text-muted-foreground">— (no plain-language summary yet)</p>}
    </div>
  );
}

function termUse(t: TaskData, term: string) {
  return (t.scoring?.settings ?? []).filter((s) => s.terms.some(([x]) => x === term) || s.constraints.includes(term)).map((s) => s.name);
}

function refText(term: Term) {
  if (term.role !== "objective") return "—";
  if (!term.ref) return "strongest anchor arm (default)";
  if (term.ref.kind === "const") return `constant ${fmt(term.ref.value)}`;
  if (term.ref.kind === "bl_best") return `strongest anchor arm on ${term.ref.metric || term.metric}`;
  if (term.ref.kind === "bl_worst") return `weakest anchor arm on ${term.ref.metric || term.metric}`;
  return term.ref.kind;
}

function BaselineCard({ t, b }: { t: TaskData; b: Baseline }) {
  const what = b.what || firstParagraph(b.docstring);
  return (
    <Fold
      summary={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{b.slug}</span>
          <span className="font-normal">{b.name ?? <Missing what="method name" />}</span>
          {b.is_oracle && <Badge tone="oracle">oracle</Badge>}
          <span className="ml-auto font-mono text-xs text-muted-foreground">score {fmtScore(b.score)}</span>
        </span>
      }
    >
      <div className="space-y-4">
        <div>
          <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What it changes</h5>
          {what ? <MarkdownContent content={what} /> : <p className="text-sm text-muted-foreground">—</p>}
          {b.what ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Written from the delivered files (instruction.md and the arm&apos;s edit file).</p>
          ) : b.docstring ? (
            <p className="mt-1 text-[11px] text-muted-foreground">First paragraph of the docstring in tests/meta/{b.ops_file}.</p>
          ) : null}
        </div>
        <div>
          <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Code: edit ops against the starter</h5>
          {b.no_op ? (
            <p className="text-sm">No edit: this baseline is the starter as given.</p>
          ) : b.diffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">— (ops not resolved)</p>
          ) : (
            <div className="space-y-3">
              {b.diffs.map((d) => (
                <div key={d.file}>
                  <div className="mb-1 break-anywhere font-mono text-[11px] text-muted-foreground">
                    {d.file} · +{d.added} / −{d.removed}
                    {d.not_in_listing && " · file not in the config listing (shown as created content)"}
                  </div>
                  {d.diff ? <DiffBlock diff={d.diff} /> : d.new_content ? <CodeBlock code={d.new_content} language="python" /> : <p className="text-sm">— </p>}
                </div>
              ))}
              {b.diffs.some((d) => d.new_content && d.changed.length) && (
                <Fold summary="Resulting editable file with the changed lines marked">
                  <div className="space-y-3">
                    {b.diffs
                      .filter((d) => d.new_content && d.changed.length && !d.not_in_listing)
                      .map((d) => (
                        <AnnotatedCodeBlock key={d.file} code={d.new_content!} filename={d.file} changed={d.changed} label={b.slug} />
                      ))}
                  </div>
                </Fold>
              )}
            </div>
          )}
          {b.ops_file && <p className="mt-1 text-[11px] text-muted-foreground">Source: tests/meta/{b.ops_file} in the delivered bundle</p>}
          {(b.cmd || b.env) && (
            <p className="mt-1 text-xs">
              Also overrides: {b.cmd && <code>cmd = {b.cmd}</code>} {b.env && <code>env = {JSON.stringify(b.env)}</code>}
            </p>
          )}
        </div>
        {b.docstring && (
          <Fold summary="Full docstring of the edit">
            <pre className="whitespace-pre-wrap break-anywhere text-xs">{b.docstring}</pre>
          </Fold>
        )}
        {b.score_detail && (
          <div className="text-xs text-muted-foreground">
            Per-setting score at the 0.1 anchor:{" "}
            {b.score_detail.settings.map((s) => (
              <span key={s.name} className="mr-3" title={s.name}>
                {t.settings.find((x) => x.name === s.name)?.display ?? s.name}: <span className="font-mono">{fmtScore(s.score)}</span>
              </span>
            ))}
            (scored row: seed {b.score_detail.row_seed})
          </div>
        )}
      </div>
    </Fold>
  );
}

export default async function TaskPage({ params }: { params: Promise<{ task: string }> }) {
  const { task } = await params;
  const t = loadTask(task);
  if (!t) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Task not found</h1>
        <Link href="/" className="mt-4 inline-block underline">
          Back to the catalogue
        </Link>
      </div>
    );
  }
  if ((t as unknown as { mode?: string }).mode === "public") return <PublicTask t={t as unknown as PublicTaskData} />;
  const c = t.curated || {};
  const status = loadStatus();
  const termLabel = (n: string) => {
    const m = t.scoring?.terms.find((x) => x.name === n)?.metric ?? n;
    return t.leaderboard.metric_labels?.[m] ?? m;
  };
  const sc = t.scoring;
  const editable = t.files.filter((f) => f.editable);
  const readonly = t.files.filter((f) => !f.editable);
  const titleSec = t.desc_sections.find((s) => s.kind === "title");
  const settings = t.settings.filter((s) => !s.auxiliary);
  const aux = t.settings.filter((s) => s.auxiliary);
  const oracleB = t.baselines.find((b) => b.is_oracle);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Tasks
        </Link>
        <span className="mx-2">/</span>
        <span className="break-anywhere font-mono text-foreground">{t.id}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {t.status === "deleted" ? <DeletedBadge /> : <span className="font-mono">#{t.n}</span>}
        <Badge>{splitArea(t.area).area}</Badge>
        {splitArea(t.area).topic && <span>{splitArea(t.area).topic}</span>}
        {t.repo_url && (
          <a href={t.repo_url} target="_blank" rel="noreferrer" className="break-anywhere underline">
            built on {t.repo}
          </a>
        )}
        {gpuLabel(t.exec?.gpus) && <Badge>Trial: {gpuLabel(t.exec?.gpus)}</Badge>}
      </div>
      {t.status === "deleted" && t.deleted && <DeletedBanner info={t.deleted} titles={taskTitles()} />}
      <RequestStatus task={t.id} status={status} />
      <div className="mt-2 grid items-start gap-6 md:grid-cols-[1fr_minmax(16rem,26rem)]">
        <div>
          <div className="flex items-start gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.title ?? t.id}</h1>
            <div className="mt-1.5">
              <StarButton id={t.id} withLabel />
            </div>
          </div>
          <p className="mt-2 max-w-3xl text-base text-muted-foreground">{t.question ?? "—"}</p>
          <div className="mt-4">
            {t.status !== "deleted" && (
              <>
                <IssueButtons task={t.id} />
                <div className="mt-4 max-w-xl">
                  <ApproveBox task={t.id} version={t.version} />
                </div>
              </>
            )}
            <div className="mt-4 max-w-xl">
              <TaskPeople people={loadPeople()[t.id]} />
            </div>
          </div>
        </div>
        <TaskImage image={t.image} title={t.title ?? t.id} area={t.area} />
      </div>

      <div className="sticky top-14 z-40 -mx-4 mt-6 overflow-x-auto border-y border-border bg-background/90 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex gap-1 whitespace-nowrap text-xs">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* 1 ─────────────────────────── question */}
      <Section id="question" n={1} title="Research question">
        <Card>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Background · question · why it matters (ML-Relay README)</div>
          {t.elab ? <div className="space-y-2 text-sm leading-relaxed">{t.elab.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}</div> : <Missing what="README section" />}
          <div className="mt-3 space-y-1 text-xs">
            <p>
              <span className="font-semibold">Settings (README):</span> {t.readme_settings_line ?? "—"}
            </p>
            <p>
              <span className="font-semibold">Reference methods (README):</span> {t.readme_methods_line ?? "—"}
            </p>
          </div>
        </Card>
        {titleSec?.md?.trim() && <MarkdownContent content={titleSec.md} />}
        <DescBlocks secs={t.desc_sections} kinds={["rq", "background"]} />
      </Section>

      {/* 2 ─────────────────────────── algorithm */}
      <Section id="algorithm" n={2} title="The algorithm" lead="What the fixed pipeline does, what the starter computes, then the code.">
        <Staff label="The pipeline, in plain words" text={c.pipeline} />
        <Staff label="What the starter (default) method computes" text={c.starter} />
        <Fold summary="The fixed pipeline, as instruction.md states it">
          <DescBlocks secs={t.desc_sections} kinds={["fixed", "budget", "other"]} empty="instruction.md has no separate fixed-pipeline section." />
        </Fold>
        <h3 className="text-sm font-semibold">Starter code (the editable region the agent starts from)</h3>
        {t.starter_regions.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
        {editable.map((f) =>
          f.content ? (
            <AnnotatedCodeBlock key={f.filename} code={f.content} filename={f.filename} language={f.language} editRanges={f.edit_ranges} defaultMode="window" />
          ) : null,
        )}
        {readonly.length > 0 && (
          <p className="text-sm text-muted-foreground">
            The fixed pipeline lives in {readonly.length} read-only file{readonly.length === 1 ? "" : "s"} (
            {readonly.map((f) => f.filename.split("/").pop()).join(", ")}); browse them in the code viewer in section 3.
          </p>
        )}
      </Section>

      {/* 3 ─────────────────────────── surface */}
      <Section id="surface" n={3} title="What a researcher can change">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-left text-xs">
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Access</th>
                <th className="px-3 py-2 text-right">Lines</th>
              </tr>
            </thead>
            <tbody>
              {t.files.map((f) => (
                <tr key={f.filename} className="border-t border-border">
                  <td className="break-anywhere px-3 py-2 font-mono text-xs">{f.filename}</td>
                  <td className="px-3 py-2 text-xs">
                    {f.editable ? (
                      <Badge tone="accent">editable {f.edit_ranges.map((r) => (r.whole_file ? "whole file" : `${r.start}–${r.end}`)).join(", ")}</Badge>
                    ) : (
                      <Badge>read-only</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{f.lines}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <KV
          items={[
            ["New files", t.exec.allow_create ? "allowed (allow_create: true)" : "not allowed (allow_create: false)"],
            ["Edit mode", t.exec.rigorous_codebase ? "edit-only (rigorous_codebase): every baseline is an edit of the same file, run by the same commands" : "command replacement"],
            ["Coordinates", "Editable ranges as instruction.md states them, in the line numbers of the delivered agent-start files."],
          ]}
        />
        <h3 className="text-sm font-semibold">Interface, I/O contract and edit rules</h3>
        <DescBlocks secs={t.desc_sections} kinds={["modify"]} empty="— (instruction.md has no separate interface section; see the full statement in the appendix)" />
        <h3 className="text-sm font-semibold">Environment viewer</h3>
        {t.viewer ? (
          <AgentViewer summary={t.viewer} />
        ) : (
          <EnvViewer files={t.files} note="Source: environment/_workspace of the delivered bundle; editable ranges as instruction.md states them." />
        )}
      </Section>

      {/* 4 ─────────────────────────── baselines */}
      <Section
        id="baselines"
        n={4}
        title="Baselines"
        lead={
          <>
            Oracle (the arm the shipped solution replays): <span className="font-mono">{t.oracle ?? "—"}</span>
            {oracleB?.name ? ` — ${oracleB.name}` : ""}. Scores are task scores at the ML-Relay 0.1 anchor, computed with the shipped scorer.
          </>
        }
      >
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-left text-xs">
                <th className="px-3 py-2">Arm</th>
                <th className="px-3 py-2">Method (citation)</th>
                <th className="px-3 py-2" />
                <th className="px-3 py-2 text-right">Task score</th>
              </tr>
            </thead>
            <tbody>
              {[...t.baselines]
                .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
                .map((b) => (
                  <tr key={b.slug} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{b.slug}</td>
                    <td className="px-3 py-2 text-xs">{b.name ?? <Missing what="method name" />}</td>
                    <td className="px-3 py-2">{b.is_oracle && <Badge tone="oracle">oracle</Badge>}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmtScore(b.score)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Every baseline that was run is listed. The oracle is the baseline the shipped solution replays (internal only).
        </p>
        <div className="space-y-2">
          {[...t.baselines]
            .sort((a, b) => Number(b.is_oracle) - Number(a.is_oracle) || (b.score ?? -1) - (a.score ?? -1))
            .map((b) => (
              <BaselineCard key={b.slug} t={t} b={b} />
            ))}
        </div>
        <Fold summary="The reference baselines as instruction.md presents them">
          <DescBlocks secs={t.desc_sections} kinds={["baselines"]} empty="—" />
        </Fold>
      </Section>

      {/* 5 ─────────────────────────── settings */}
      <Section id="settings" n={5} title="Evaluation settings" lead="Every evaluation setting of the task.">
        <Card>
          <KV
            items={[
              ["Seeds", t.exec.seeds ? t.exec.seeds.join(", ") : <Missing key="s" />],
              ...(t.exec.seeds_note ? ([["Seed note", t.exec.seeds_note]] as [string, React.ReactNode][]) : []),
              ["GPUs (trial)", t.exec.gpus ?? <Missing key="g" />],
              ["CPUs / memory / storage", `${t.exec.cpus ?? "—"} / ${gb(t.exec.memory_mb)} / ${gb(t.exec.storage_mb)}`],
              ["Agent time limit", hours(t.exec.agent_timeout_sec)],
              ["Verifier time limit", hours(t.exec.verifier_timeout_sec)],
              ["Internet in trial", t.exec.allow_internet === false ? "sealed (no egress)" : t.exec.allow_internet ? "allowed" : "—"],
              ["Trusted result channel", t.exec.trusted_result ? "yes (harbor_trusted_result)" : "no"],
              ["Scored inputs withheld", t.exec.ephemeral_inputs ? "yes (ephemeral_inputs)" : "no"],
              ["CUDA", t.exec.use_cuda === false ? "CPU-only" : "GPU"],
              ["Packages", t.exec.packages.join(", ")],
            ]}
          />
          {t.exec.resources_note && <p className="mt-3 text-xs text-muted-foreground">Resources: {t.exec.resources_note}</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">Trial resources and limits are from the bundle&apos;s task.toml; everything else from tests/meta/config.json.</p>
        </Card>
        <div className="grid gap-3">
          {settings.map((s) => (
            <Card key={s.name}>
              <h4 className="text-sm font-semibold" title={s.name}>
                {s.display ?? s.name}
              </h4>
              {gpuLabel(s.gpus) && <div className="mt-1 text-xs text-muted-foreground">Compute: {gpuLabel(s.gpus)}</div>}
              <div className="mt-2 text-xs text-muted-foreground">
                Scored:{" "}
                {(s.scored ?? []).length ? (
                  (s.scored ?? []).map((m, i) => (
                    <span key={m.metric} title={m.metric}>
                      {i > 0 && <span className="mx-1.5 text-border">|</span>}
                      <span className="text-foreground">{m.label}</span> {arrow(m.direction)}
                      {m.role === "constraint" && <span> (guard)</span>}
                    </span>
                  ))
                ) : (
                  "—"
                )}
              </div>
              {s.cmds.length > 0 && (
                <Fold summary="Run commands and scripts" className="mt-3">
                <div className="mt-3 overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/60 text-left">
                        <th className="px-2 py-1.5">Command</th>
                        <th className="px-2 py-1.5">Script</th>
                        <th className="px-2 py-1.5 text-right" title="GPUs requested by this command (fractions share a GPU)">GPU</th>
                        <th className="px-2 py-1.5 text-right">Time budget</th>
                        <th className="px-2 py-1.5 text-right">Group</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.cmds.map((x) => (
                        <tr key={x.label} className="border-t border-border">
                          <td className="px-2 py-1.5 font-mono">
                            {x.label}
                          </td>
                          <td className="break-anywhere px-2 py-1.5 font-mono">{x.cmd}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{x.compute ?? "—"}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{x.time ?? "—"}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{x.group ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              {s.cmds
                .filter((x) => x.script)
                .map((x) => (
                  <Fold key={x.label} summary={<span className="font-mono text-xs">{x.cmd}</span>} className="mt-2">
                    <CodeBlock code={x.script!} language="bash" maxHeight={420} />
                  </Fold>
                ))}
                </Fold>
              )}
            </Card>
          ))}
          {aux.map((s) => (
            <Card key={s.name}>
              <h4 className="text-sm font-semibold">Auxiliary commands (training / shared steps, not a scored setting)</h4>
              {s.cmds.map((x) => (
                <div key={x.label} className="mt-2 text-xs">
                  <span className="font-mono">{x.label}</span> · <span className="font-mono">{x.cmd}</span> · GPU {x.compute ?? "—"} · {x.time ?? "—"} · group {x.group ?? "—"}
                  {x.script && (
                    <Fold summary="script" className="mt-1">
                      <CodeBlock code={x.script} language="bash" maxHeight={420} />
                    </Fold>
                  )}
                </div>
              ))}
            </Card>
          ))}
        </div>
        {t.exec.data_deps.length > 0 && (
          <Fold summary="Data dependencies (tests/meta/config.json data_deps)">
            <ul className="space-y-1 text-sm">
              {t.exec.data_deps.map((d) => (
                <li key={d.name}>
                  <span className="font-mono text-xs">{d.name}</span> — {d.description}
                </li>
              ))}
            </ul>
          </Fold>
        )}
        {Object.keys(t.exec.notes).length > 0 && (
          <Fold summary="Config notes (the _*_note fields in tests/meta/config.json)">
            <KV items={Object.entries(t.exec.notes).map(([k, v]) => [<span key={k} className="font-mono text-xs">{k}</span>, <span key={k + "v"} className="text-xs">{v}</span>])} />
          </Fold>
        )}
        <Fold summary="Evaluation and metric, as instruction.md states them">
          <DescBlocks secs={t.desc_sections} kinds={["evaluation", "metric"]} empty="—" />
        </Fold>
      </Section>

      {/* 6 ─────────────────────────── scoring */}
      <Section id="scoring" n={6} title="Scoring">
        <Card>
          <div className="space-y-2 text-sm leading-relaxed">
            <p>
              Each scored <strong>term</strong> maps one raw leaderboard column to [0, 1]. The column is first turned higher-is-better (its direction)
              and optionally log-transformed. The <strong>floor</strong> is the weakest anchor arm&apos;s value and scores 0. The{" "}
              <strong>reference</strong> is the strongest anchor arm&apos;s value and scores <strong>0.1</strong>, the ML-Relay anchor (the shipped
              spec sets every objective term&apos;s ref_score to 0.1). For <code>bounded_power</code> terms the <strong>bound</strong> scores 1 and the
              curve is r<sup>γ</sup> with r = (x − floor)/(bound − floor), γ solved so the reference lands on 0.1. When that γ would leave [0.1, 10]
              the scorer switches to a sigmoid calibrated at the same two points. <code>sigmoid</code> terms have no bound.
            </p>
            <p>
              A <strong>setting</strong> score is the weighted mean of its objective terms, multiplied by any constraint penalties. The{" "}
              <strong>task</strong> score is the {sc?.task_agg === "gmean" ? "geometric mean" : sc?.task_agg ?? "—"} across settings, with each setting
              floored at {sc?.gmean_eps ?? "—"}, so a submission that fails any one setting drags the whole task down.
            </p>
          </div>
        </Card>
        {sc ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/60 text-left">
                    <th className="px-2 py-2">Term / column</th>
                    <th className="px-2 py-2">Dir.</th>
                    <th className="px-2 py-2">Norm</th>
                    <th className="px-2 py-2 text-right">Floor (0)</th>
                    <th className="px-2 py-2 text-right">Reference</th>
                    <th className="px-2 py-2 text-right">Bound (1)</th>
                    <th className="px-2 py-2 text-right">ref_score</th>
                    <th className="px-2 py-2 text-right">γ / scale</th>
                    <th className="px-2 py-2">Settings</th>
                  </tr>
                </thead>
                <tbody>
                  {sc.terms.map((x) => {
                    const pr = sc.term_params[x.name] || {};
                    const gamma = pr.gamma ?? null;
                    const scale = pr.scale ?? x.scale ?? null;
                    return (
                      <tr key={x.name} className="border-t border-border">
                        <td className="break-anywhere px-2 py-1.5" title={x.metric}>
                          {t.leaderboard.metric_labels?.[x.metric] ?? x.metric}
                          {x.role !== "objective" && <Badge tone="warn">{x.role}</Badge>}
                          {x.transform !== "id" && <span className="text-muted-foreground"> ({x.transform})</span>}
                        </td>
                        <td className="px-2 py-1.5">{x.direction === "lower" ? "↓ lower" : "↑ higher"}</td>
                        <td className="px-2 py-1.5">
                          {x.norm_type}
                          {pr.fallback ? <span className="block text-[10px] text-muted-foreground">→ sigmoid fallback</span> : null}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{x.role === "objective" ? fmt(x.floor_raw) : "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums" title={refText(x)}>
                          {x.role === "objective" ? fmt(pr.ref ?? (x.ref?.kind === "const" ? x.ref.value : x.best_raw)) : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {x.role === "constraint" ? `target ${fmt(x.constraint_target)}` : fmt(x.bound)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {x.role === "objective" ? x.ref_score ?? "—" : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{gamma !== null ? `γ ${fmt(gamma, 3)}` : scale !== null ? `s ${fmt(scale, 3)}` : "—"}</td>
                        <td className="px-2 py-1.5">{termUse(t, x.name).map((n) => t.settings.find((y) => y.name === n)?.display ?? n).join("; ") || <span className="text-muted-foreground">none</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Floor and reference are the anchors the shipped scorer resolved from the leaderboard (raw units). Reference rule per term is in the cell
              tooltip. γ is the solved exponent; &ldquo;s&rdquo; is the sigmoid scale.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <h4 className="text-sm font-semibold">Settings → terms</h4>
                <ul className="mt-2 space-y-1 text-xs">
                  {sc.settings.map((s) => (
                    <li key={s.name}>
                      <span className="font-medium" title={s.name}>{t.settings.find((y) => y.name === s.name)?.display ?? s.name}</span>
                      :{" "}
                      {s.terms.map(([n, w]) => `${termLabel(n)} × ${w}`).join(" + ") || "—"}
                      {s.constraints.length > 0 && <span className="text-muted-foreground"> · guards: {s.constraints.map(termLabel).join(", ")}</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  Task = {sc.task_agg === "gmean" ? "geometric mean" : sc.task_agg} over the {sc.settings.length} settings
                </p>
              </Card>
              <Card>
                <h4 className="text-sm font-semibold">Reported but not scored</h4>
                {t.leaderboard.reported_columns.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.leaderboard.reported_columns.map((cname) => (
                      <span key={cname} title={cname} className="rounded border border-border px-1 text-[11px]">
                        {t.leaderboard.metric_labels?.[cname] ?? cname}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Every leaderboard metric column is scored.</p>
                )}
              </Card>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/60 text-left">
                    <th className="px-2 py-2">Arm</th>
                    {sc.settings.map((s) => (
                      <th key={s.name} className="px-2 py-2 text-right" title={s.name}>
                        {t.settings.find((y) => y.name === s.name)?.display ?? s.name}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right">Task</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sc.arms)
                    .filter(([, a]) => a.in_config)
                    .sort((a, b) => b[1].score - a[1].score)
                    .map(([arm, a]) => (
                      <tr key={arm} className={`border-t border-border ${arm === t.oracle ? "bg-emerald-500/5 font-medium" : ""}`}>
                        <td className="px-2 py-1.5 font-mono">
                          {arm}
                          {arm === t.oracle && <span className="ml-1 text-emerald-600 dark:text-emerald-300">oracle</span>}
                        </td>
                        {sc.settings.map((s) => (
                          <td key={s.name} className="px-2 py-1.5 text-right tabular-nums">
                            {fmtScore(a.settings.find((x) => x.name === s.name)?.score)}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtScore(a.score)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">— scoring could not be computed.</p>
        )}
        <Fold summary="score_spec.py (tests/meta)">
          <CodeBlock code={t.score_spec_source || "—"} language="python" />
        </Fold>
      </Section>

      {/* 7 ─────────────────────────── results */}
      <Section id="results" n={7} title="Current results">
        <ResultsSection t={t} />
      </Section>

      {/* appendix */}
      <Section id="appendix" title="Appendix">
        <Fold summary="Full task statement (instruction.md, above the harness sections)">
          <MarkdownContent content={t.description_md} />
        </Fold>
        {Object.keys(t.instruction_harness || {}).length > 0 && (
          <Fold summary="Harness sections of instruction.md (workspace, editable ranges, evaluation, tips, time budget)">
            <div className="space-y-4">
              {Object.entries(t.instruction_harness).map(([k, v]) => (
                <div key={k}>
                  <h4 className="mb-1 text-sm font-semibold">{k}</h4>
                  <MarkdownContent content={v} />
                </div>
              ))}
            </div>
          </Fold>
        )}
        <p className="text-xs text-muted-foreground">
          Sources: the delivered bundle <code>ml-relay-v2/tasks/mls-bench__{t.id}/</code> (instruction.md, environment/_workspace, solution,
          task.toml, tests/meta) and the delivered <code>ml-relay-v2/README.md</code>.
        </p>
      </Section>

      <div className="mt-10">
        <TaskThread
          task={t.id}
          thread={status.threads?.[t.id] ?? null}
          maintainers={status.maintainers ?? []}
          developers={taskDevelopers()}
          readOnly={t.status === "deleted"}
        />
      </div>
    </div>
  );
}
