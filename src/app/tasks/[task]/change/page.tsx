import Link from "next/link";
import { loadForms, loadIndex, taskTitles } from "@/lib/data";
import IssueFormView from "@/components/IssueFormView";
import { REQUEST_MODEL } from "@/lib/site";

export function generateStaticParams() {
  return loadIndex().tasks.map((t) => ({ task: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ task: string }> }) {
  const { task } = await params;
  return { title: `ML-Relay · Request a change · ${task}` };
}

export default async function ChangePage({ params }: { params: Promise<{ task: string }> }) {
  const { task } = await params;
  const t = loadIndex().tasks.find((x) => x.id === task);
  const form = loadForms()["change-task"];
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
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{REQUEST_MODEL}</p>
      <div className="mt-6">
        {form ? (
          <IssueFormView
            form={form}
            titles={taskTitles()}
            kind="change"
            draftKey={`mlrelay-draft-change-${task}`}
            locked={{ task }}
            next={
              <>
                The agent works on this task only. It reports back on the issue (you get an email via a GitHub @mention) and proposes its changes as
                one pull request, which a maintainer reviews and merges. Reply on the issue, or from My work, to steer it.
              </>
            }
          />
        ) : (
          <p className="text-sm">
            The form is not available on the site yet.{" "}
            <a href={gh} target="_blank" rel="noreferrer" className="underline">
              Open it on GitHub
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
