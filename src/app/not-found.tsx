import { loadStatus, taskTitles } from "@/lib/data";
import NotFoundView from "@/components/NotFoundView";

export default function NotFound() {
  const st = loadStatus();
  return <NotFoundView titles={taskTitles()} maintainers={st.maintainers} repo={st.repo} />;
}
