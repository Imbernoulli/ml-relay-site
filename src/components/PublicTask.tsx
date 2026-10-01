import Link from "next/link";
import type { DescSection, PublicBaseline, PublicTaskData, TaskData, Term } from "@/lib/types";
import { arrow, fmt, fmtScore, firstParagraph } from "@/lib/format";
import MarkdownContent from "./MarkdownContent";
import AnnotatedCodeBlock from "./AnnotatedCodeBlock";
import DiffBlock from "./DiffBlock";
import EnvViewer from "./EnvViewer";
import ResultsSection from "./ResultsSection";
import { Badge, Card, Fold, Section } from "./ui";
import TaskImage from "./TaskImage";
import IssueButtons from "./IssueButtons";
import RequestStatus from "./RequestStatus";
import { loadStatus } from "@/lib/data";
import { gpuLabel } from "@/lib/site";

const TOC = [
  ["question", "1 Question"],
  ["task", "2 Task"],
  ["environment", "3 Environment"],
  ["baselines", "4 Baselines"],
  ["settings", "5 Settings"],
  ["scoring", "6 Scoring"],
  ["results", "7 Results"],
];

function Blocks({ secs, kinds }: { secs: DescSection[]; kinds?: string[] }) {
  const pick = secs.filter((s) => s.kind !== "title" && (!kinds || kinds.includes(s.kind)) && s.md.trim());
  return (
    <div className="space-y-4">
      {pick.map((s, i) => (
        <div key={i}>
          {s.title && <h4 className="mb-1 text-sm font-semibold">{s.title}</h4>}
          <MarkdownContent content={s.md} />
        </div>
      ))}
    </div>
  );
}

function refLabel(term: Term) {
  if (term.role !== "objective") return "—";
  if (!term.ref) return "strongest baseline";
  if (term.ref.kind === "const") return `constant ${fmt(term.ref.value)}`;
  if (term.ref.kind === "bl_best") return "strongest baseline";
  if (term.ref.kind === "bl_worst") return "weakest baseline";
  return term.ref.kind;
}

function BaselineCard({ b, sdisp }: { b: PublicBaseline; sdisp: (n: string) => string }) {
  const what = firstParagraph(b.docstring);
  return (
    <Fold
      summary={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-normal">{b.name ?? <span className="font-mono text-xs">{b.slug}</span>}</span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">score {fmtScore(b.score)}</span>
        </span>
      }
    >
      <div className="space-y-4">
        <div>
          <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What it changes</h5>
          {what ? <MarkdownContent content={what} /> : <p className="text-sm text-muted-foreground">—</p>}
        </div>
        <div>
          <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Code: the change against the starter</h5>
          {b.no_op ? (
            <p className="text-sm">No edit: this baseline is the starter as given.</p>
          ) : b.diffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <div className="space-y-3">
              {b.diffs.map((d) => (
                <div key={d.file}>
                  <div className="mb-1 break-anywhere font-mono text-[11px] text-muted-foreground">
                    {d.file} · +{d.added} / −{d.removed}
                  </div>
                  {d.diff ? <DiffBlock diff={d.diff} /> : <p className="text-sm">—</p>}
                </div>
              ))}
              {b.diffs.some((d) => d.new_content && d.changed.length && !d.not_in_listing) && (
                <Fold summary="The resulting file with the changed lines marked">
                  <div className="space-y-3">
                    {b.diffs
                      .filter((d) => d.new_content && d.changed.length && !d.not_in_listing)
                      .map((d) => (
                        <AnnotatedCodeBlock key={d.file} code={d.new_content!} filename={d.file} changed={d.changed} label={b.name ?? b.slug} />
                      ))}
                  </div>
                </Fold>
              )}
            </div>
          )}
        </div>
        {b.docstring && (
          <Fold summary="Full description">
            <pre className="whitespace-pre-wrap break-anywhere text-xs">{b.docstring}</pre>
          </Fold>
        )}
        {b.score_detail && (
          <div className="text-xs text-muted-foreground">
            Per-setting score:{" "}
            {b.score_detail.settings.map((s) => (
              <span key={s.name} className="mr-3" title={s.name}>
                {sdisp(s.name)}: <span className="font-mono">{fmtScore(s.score)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </Fold>
  );
}

export default function PublicTask({ t }: { t: PublicTaskData }) {
  const sc = t.scoring;
  const status = loadStatus();
  const sdisp = (n: string) => t.settings.find((x) => x.name === n)?.display ?? n;
  const titleSec = t.desc_sections.find((s) => s.kind === "title");
  const filesEdit = t.instruction_harness["Files You May Edit"];
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
        <span className="font-mono">#{t.n}</span>
        <Badge>{t.area ?? "—"}</Badge>
        {t.repo_url && (
          <a href={t.repo_url} target="_blank" rel="noreferrer" className="break-anywhere underline">
            built on {t.repo}
          </a>
        )}
        {gpuLabel(t.gpus) && <Badge>Trial: {gpuLabel(t.gpus)}</Badge>}
      </div>
      <RequestStatus task={t.id} status={status} />
      <div className="mt-2 grid items-start gap-6 md:grid-cols-[1fr_minmax(16rem,26rem)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.title ?? t.id}</h1>
          <p className="mt-2 max-w-3xl text-base text-muted-foreground">{t.question ?? "—"}</p>
          <div className="mt-4">
            <IssueButtons task={t.id} />
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

      <Section id="question" n={1} title="Research question">
        <Card>
          {t.elab ? <div className="space-y-2 text-sm leading-relaxed">{t.elab.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}</div> : <p className="text-sm text-muted-foreground">—</p>}
          <div className="mt-3 space-y-1 text-xs">
            <p>
              <span className="font-semibold">Settings:</span> {t.readme_settings_line ?? "—"}
            </p>
            <p>
              <span className="font-semibold">Reference methods:</span> {t.readme_methods_line ?? "—"}
            </p>
          </div>
        </Card>
        {titleSec?.md?.trim() && <MarkdownContent content={titleSec.md} />}
        <Blocks secs={t.desc_sections} kinds={["rq", "background"]} />
      </Section>

      <Section id="task" n={2} title="The task, as the agent receives it" lead="The task statement, the interface and the edit rules.">
        <Blocks secs={t.desc_sections} kinds={["modify", "fixed", "budget", "other", "evaluation", "metric", "baselines"]} />
        {filesEdit && (
          <Card>
            <h4 className="mb-1 text-sm font-semibold">Files you may edit</h4>
            <MarkdownContent content={filesEdit} />
          </Card>
        )}
      </Section>

      <Section id="environment" n={3} title="Environment viewer" lead="The task's source files: the editable file(s) with the editable region marked, and the read-only context the method runs in.">
        <EnvViewer
          files={t.files}
          note="Source code only. Build files, install and data-preparation scripts, dependency pins, data and the test harness are not published."
        />
      </Section>

      <Section id="baselines" n={4} title="Baselines" lead="Published reference methods, each written as an edit of the same starter. Scores are task scores from the task's own scorer.">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-left text-xs">
                <th className="px-3 py-2">Method (citation)</th>
                <th className="px-3 py-2 text-right">Task score</th>
              </tr>
            </thead>
            <tbody>
              {[...t.baselines]
                .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
                .map((b) => (
                  <tr key={b.slug} className="border-t border-border">
                    <td className="px-3 py-2 text-xs">
                      {b.name ?? <span className="font-mono">{b.slug}</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmtScore(b.score)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2">
          {[...t.baselines]
            .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
            .map((b) => (
              <BaselineCard key={b.slug} b={b} sdisp={sdisp} />
            ))}
        </div>
      </Section>

      <Section id="settings" n={5} title="Evaluation settings">
        <div className="grid gap-3">
          {t.settings.map((s) => (
            <Card key={s.name}>
              <h4 className="text-sm font-semibold" title={s.name}>
                {s.display ?? s.name}
              </h4>
              {gpuLabel(s.gpus) && <div className="mt-1 text-xs text-muted-foreground">Compute: {gpuLabel(s.gpus)}</div>}
              <div className="mt-2 text-xs text-muted-foreground">
                Scored:{" "}
                {(s.scored ?? []).length ? (
                  (s.scored ?? []).map((m, i) => (
                    <span key={m.metric}>
                      {i > 0 && <span className="mx-1.5 text-border">|</span>}
                      <span className="text-foreground">{m.label}</span> {arrow(m.direction)}
                      {m.role === "constraint" && <span> (guard)</span>}
                    </span>
                  ))
                ) : (
                  "—"
                )}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="scoring" n={6} title="Scoring">
        <Card>
          <p className="text-sm leading-relaxed">
            Each scored term maps one metric to [0, 1]: the weakest baseline maps to 0 and the strongest to {sc?.default_ref_score ?? 0.1}, so
            most of the scale is headroom above the published methods. A setting&apos;s score is the weighted mean of its terms (times any
            constraint penalty); the task score is the {sc?.task_agg === "gmean" ? "geometric mean" : sc?.task_agg ?? "—"} over settings.
          </p>
        </Card>
        {sc && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/60 text-left">
                  <th className="px-2 py-2">Metric</th>
                  <th className="px-2 py-2">Direction</th>
                  <th className="px-2 py-2">Normalisation</th>
                  <th className="px-2 py-2">Reference</th>
                  <th className="px-2 py-2">Setting</th>
                  <th className="px-2 py-2">Role</th>
                </tr>
              </thead>
              <tbody>
                {sc.terms.map((x) => (
                  <tr key={x.name} className="border-t border-border">
                    <td className="break-anywhere px-2 py-1.5">
                      {t.leaderboard.metric_labels?.[x.metric] ?? x.metric}
                      {x.transform !== "id" && <span className="text-muted-foreground"> ({x.transform})</span>}
                    </td>
                    <td className="px-2 py-1.5">{x.direction === "lower" ? "lower is better" : "higher is better"}</td>
                    <td className="px-2 py-1.5">{x.norm_type}</td>
                    <td className="px-2 py-1.5">{refLabel(x)}</td>
                    <td className="px-2 py-1.5">{sdisp(t.settings.find((y) => y.metrics.includes(x.metric))?.name ?? "")}</td>
                    <td className="px-2 py-1.5">{x.role === "objective" ? "scored" : x.role === "constraint" ? "guard" : x.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="results" n={7} title="Results">
        <ResultsSection t={t as unknown as TaskData} publicMode />
      </Section>
    </div>
  );
}
