import Link from "next/link";
import { NEW_TASK_FORM, REQUEST_MODEL } from "@/lib/site";
import { Card } from "@/components/ui";

export const metadata = { title: "ML-Relay · Propose a new task" };

const ASKS: [string, string, string][] = [
  [
    "Research question and why it matters",
    "One modular component a researcher would change (a loss, a criterion, a schedule, a solver, a policy), stated as a question, and why the answer matters beyond one dataset.",
    "ML-Relay tasks measure one atomic, transferable contribution. If the question needs many changes at once, it is engineering, not a task.",
  ],
  [
    "Source paper(s)",
    "The paper(s) the question comes from, with links.",
    "The settings, baselines and evaluation are taken from the field's own papers, so the results can be checked against published numbers.",
  ],
  [
    "Codebase",
    "The repository and commit (repo@commit) and the entry point that trains or evaluates.",
    "Every task is built inside an existing, pinned research codebase; the agent edits one region of it and everything else runs as published.",
  ],
  [
    "Evaluation settings",
    "At least three settings from the papers' own protocol, each with its metric and whether higher or lower is better.",
    "A method is scored across genuinely different settings, so it has to generalise rather than fit one configuration.",
  ],
  [
    "Baselines",
    "Published methods with code, and which one the agent starts from.",
    "The baselines anchor the score: the weakest maps to 0, the strongest to 0.1, so most of the scale is headroom above the field.",
  ],
  [
    "Editable scope",
    "What the agent may change (a file and line range, a class, a function) and what stays fixed.",
    "The editable region is the contract: it must hold the component the question is about and nothing that would let a method change the evaluation.",
  ],
  [
    "Compute budget per setting",
    "GPUs and wall-clock time a single evaluation of one setting needs.",
    "Each submission is run on every setting; the budget decides whether the task can be measured at research scale.",
  ],
];

export default function ProposePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Tasks
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Propose a new task</span>
      </nav>
      <h1 className="text-3xl font-bold tracking-tight">How to propose a task</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        A new ML-Relay task starts as a GitHub issue form in the private Imbernoulli/ML-Relay repository. Only collaborators on that repository
        can submit it. The form asks for seven things; here is what each one is and why we need it.
      </p>
      <p className="mt-3 rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm">{REQUEST_MODEL}</p>

      <div className="mt-6 space-y-3">
        {ASKS.map(([title, what, why], i) => (
          <Card key={title}>
            <h2 className="text-base font-semibold">
              <span className="mr-2 font-mono text-sm text-muted-foreground">{i + 1}</span>
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed">{what}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Why: {why}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">A worked example</h2>
      <Card className="mt-3">
        <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[11rem_1fr]">
          <dt className="font-semibold">Question</dt>
          <dd>
            With no retraining and no gradient step, which weights of a pretrained language model should be removed in one pass, and what should
            the survivors be set to? It matters because one-shot pruning is the only kind affordable at frontier scale, and the criterion is the
            whole method.
          </dd>
          <dt className="font-semibold">Papers</dt>
          <dd>Wanda (Sun et al., 2024); SparseGPT (Frantar &amp; Alistarh, 2023); RIA (Zhang et al., 2024).</dd>
          <dt className="font-semibold">Codebase</dt>
          <dd>
            <code>locuslab/wanda@&lt;commit&gt;</code>, entry point <code>main.py</code> (prune, then evaluate WikiText-2 perplexity).
          </dd>
          <dt className="font-semibold">Settings</dt>
          <dd>
            OPT-125M at 50% unstructured sparsity; OPT-1.3B at 70% unstructured; OPT-1.3B at 2:4 semi-structured. Metric: WikiText-2 perplexity,
            lower is better.
          </dd>
          <dt className="font-semibold">Baselines</dt>
          <dd>Magnitude pruning (the starter), Wanda, SparseGPT, RIA, each with its released code.</dd>
          <dt className="font-semibold">Editable scope</dt>
          <dd>
            The per-layer pruning function: it receives the weight and calibration statistics and returns the pruned weight. Model loading, the
            calibration data, the sparsity target and the evaluation are fixed.
          </dd>
          <dt className="font-semibold">Compute</dt>
          <dd>A fraction of one GPU per setting; 45 minutes for OPT-125M and 1 h 40 min for each OPT-1.3B setting.</dd>
        </dl>
      </Card>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">What happens next</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm leading-relaxed">
        <li>
          <strong>Design review.</strong> We check the question, settings, baselines and editable scope, and reply on the issue with a proposed
          design.
        </li>
        <li>
          <strong>Build and pilot.</strong> The task is built in its codebase and a small pilot checks that the baselines run and separate.
        </li>
        <li>
          <strong>Full measurement.</strong> Every baseline is run on every setting at full scale, and the task joins the set.
        </li>
      </ol>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Each phase waits for your reply on the issue before the next one starts. You are mentioned on every update, so GitHub emails you.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/propose/new/"
          className="rounded-lg border border-emerald-600/60 bg-emerald-600/15 px-4 py-2 text-sm font-semibold text-emerald-800 hover:border-emerald-600 dark:text-emerald-200"
        >
          Fill in the proposal form
        </Link>
        <a href={NEW_TASK_FORM} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline">
          Prefer GitHub? Open the form there
        </a>
        <span className="w-full text-xs text-muted-foreground">Collaborators on Imbernoulli/ML-Relay only. {REQUEST_MODEL}</span>
      </div>
    </div>
  );
}
