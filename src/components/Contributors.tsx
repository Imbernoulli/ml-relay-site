import type { Contributor } from "@/lib/data";

/** Homepage card: the people behind ML-Relay (collaborators, requesters, approvers). */
export default function Contributors({ list }: { list: Contributor[] }) {
  if (!list.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">
        Contributors <span className="font-normal text-muted-foreground">{list.length}</span>
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {list.map((c) => (
          <a key={c.login} href={c.html_url} target="_blank" rel="noreferrer" title={c.login} aria-label={c.login} className="rounded-full ring-offset-2 hover:ring-2 hover:ring-foreground/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${c.avatar_url}${c.avatar_url.includes("?") ? "&" : "?"}s=64`} alt={c.login} width={32} height={32} loading="lazy" className="h-8 w-8 rounded-full" />
          </a>
        ))}
      </div>
    </div>
  );
}
