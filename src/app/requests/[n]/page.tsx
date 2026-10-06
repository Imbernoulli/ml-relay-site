import { deletedIds, loadStatus, taskDevelopers, taskTitles } from "@/lib/data";
import RequestDetail from "@/components/RequestDetail";

// One page per request the published status knows; newer ones are served by the
// not-found fallback (it renders the same view from the URL).
export function generateStaticParams() {
  const st = loadStatus();
  const ns = new Set<number>([...(st.issues ?? []).map((i) => i.issue), ...st.new_tasks.map((e) => e.issue)]);
  return [...ns].map((n) => ({ n: String(n) }));
}

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  return { title: `ML-Relay · Request #${n}` };
}

export default async function RequestPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const st = loadStatus();
  const num = Number(n);
  const issue = (st.issues ?? []).find((i) => i.issue === num) ?? null;
  return <RequestDetail n={num} st={issue} titles={taskTitles()} maintainers={st.maintainers} repo={st.repo} developers={taskDevelopers()} deleted={deletedIds()} />;
}
