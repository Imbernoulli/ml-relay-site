import type { RequestPost } from "@/lib/types";
import MarkdownContent from "./MarkdownContent";
import { KIND_LABEL } from "@/lib/threads";

const CHIP: Record<string, string> = {
  request: "border-emerald-600/50 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200",
  "method-idea": "border-violet-500/50 bg-violet-500/10 text-violet-800 dark:text-violet-200",
  agent: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  approve: "border-sky-500/50 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  reject: "border-red-600/50 bg-red-600/10 text-red-800 dark:text-red-200",
};
const LABEL: Record<string, string> = { ...KIND_LABEL, approve: "approved", reject: "declined" };

/** The human posts of a request's thread, from the published (cleaned, redacted) status: what people said. */
export default function StaticPosts({ posts }: { posts: RequestPost[] }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">Discussion</h2>
      <ol className="mt-3 space-y-3">
        {posts.map((p, i) => (
          <li key={i} className="rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://github.com/${encodeURIComponent(p.author)}.png?size=40`} alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
              <span className="font-mono font-medium">{p.author}</span>
              {CHIP[p.kind] && <span className={`rounded-full border px-1.5 py-px text-[10px] font-semibold ${CHIP[p.kind]}`}>{LABEL[p.kind]}</span>}
              {p.at && <span className="text-muted-foreground">{p.at.slice(0, 16).replace("T", " ")} UTC</span>}
            </div>
            <div className="prose prose-sm max-w-none px-3 py-2 dark:prose-invert">
              {p.text ? <MarkdownContent content={p.text} /> : <p className="text-muted-foreground">(no text)</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
