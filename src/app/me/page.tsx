import Link from "next/link";
import MyWork from "./MyWork";
import { loadIndex, loadStatus, taskTitles } from "@/lib/data";

export const metadata = { title: "ML-Relay · My work" };

export default function MePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Tasks
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">My work</span>
      </nav>
      <h1 className="text-3xl font-bold tracking-tight">My work</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Your change requests and new-task proposals: where each one stands, the pull request the agent opened, the agent&apos;s latest reply,
        and whether it is waiting for you.
      </p>
      <MyWork status={loadStatus()} knownTasks={loadIndex().tasks.map((t) => t.id)} titles={taskTitles()} />
    </div>
  );
}
