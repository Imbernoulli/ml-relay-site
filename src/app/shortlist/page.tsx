import { loadIndex } from "@/lib/data";
import Shortlist from "@/components/Shortlist";

export const metadata = { title: "ML-Relay · Shortlist" };

export default function ShortlistPage() {
  const tasks = loadIndex().tasks.map((t) => ({ id: t.id, title: t.title ?? t.id, area: t.area ?? null }));
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Shortlist</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Tasks you starred with ☆. The list is kept in this browser only; share it as a link.
      </p>
      <Shortlist tasks={tasks} />
    </div>
  );
}
