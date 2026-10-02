import Link from "next/link";
import { loadForms, taskTitles } from "@/lib/data";
import IssueFormView from "@/components/IssueFormView";
import ProposalGuide from "@/components/ProposalGuide";
import { NEW_TASK_FORM, REQUEST_MODEL } from "@/lib/site";

export const metadata = { title: "ML-Relay · Propose a new task" };

export default function ProposeNewPage() {
  const form = loadForms()["new-task"];
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/proposals/" className="hover:text-foreground">
          Proposals
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">New proposal</span>
      </nav>
      <h1 className="text-3xl font-bold tracking-tight">Propose a new task</h1>
      <p className="mt-3 text-base leading-relaxed">
        At minimum, give the research question and the source paper(s). The other fields are optional: fill in whatever you already know, and
        the agent will propose anything you leave blank for you to confirm.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{REQUEST_MODEL}</p>
      <div className="mt-4">
        <ProposalGuide />
      </div>
      <div className="mt-6">
        {form ? (
          <IssueFormView
            form={form}
            titles={taskTitles()}
            kind="new task"
            draftKey="mlrelay-draft-new-task"
            next={
              <>
                The agent starts with a design review: it reads your paper and code, checks the repository and data, and replies on the issue with a
                design or with questions. You get an email (GitHub @mention) whenever it needs you; reply with <code>go</code> to move to the build and
                pilot, and again for full measurement. You can follow it, and reply, from My work.
              </>
            }
          />
        ) : (
          <p className="text-sm">
            The form is not available on the site yet.{" "}
            <a href={NEW_TASK_FORM} target="_blank" rel="noreferrer" className="underline">
              Open it on GitHub
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
