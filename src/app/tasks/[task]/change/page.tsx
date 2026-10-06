import Link from "next/link";
import { loadIndex, loadStatus, taskDevelopers } from "@/lib/data";
import TaskThread from "@/components/TaskThread";

export function generateStaticParams() {
  return loadIndex().tasks.map((t) => ({ task: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ task: string }> }) {
  const { task } = await params;
  return { title: `ML-Relay · Request a change · ${task}` };
}

/** Requesting a change = posting into the task's one discussion thread (one paragraph is enough). */
export default async function ChangePage({ params }: { params: Promise<{ task: string }> }) {
  const { task } = await params;
  const t = loadIndex().tasks.find((x) => x.id === task);
  const st = loadStatus();
  const gh = `https://github.com/Imbernoulli/ML-Relay/issues/new?${new URLSearchParams({ template: "change-task.yml", task, title: `[change] ${task}: ` })}`;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href={`/tasks/${task}/`} className="hover:text-foreground">
          {t?.title ?? task}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Request a change</span>
      </nav>
      <h1 className="text-3xl font-bold tracking-tight">Request a change</h1>
      <p className="mt-2 text-base text-muted-foreground">{t?.title ?? task}</p>
      <p className="mt-3 text-sm leading-relaxed">
        Describe the change in one paragraph, or paste a note you already have. It goes into this task&apos;s discussion thread, where the task&apos;s
        developers and the maintainers are notified and anyone can discuss it. The agent starts when a maintainer or one of the task&apos;s developers
        approves; its changes come back as one pull request.
      </p>
      <div className="mt-6">
        <TaskThread task={task} thread={st.threads?.[task] ?? null} maintainers={st.maintainers ?? []} developers={taskDevelopers()} defaultKind="request" />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Prefer GitHub?{" "}
        <a href={gh} target="_blank" rel="noreferrer" className="underline">
          Open the form there
        </a>{" "}
        (a request for a task that already has a thread is moved into it).
      </p>
    </div>
  );
}
