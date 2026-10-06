import type { TaskPeopleData } from "@/lib/types";

const ROLE: Record<string, string> = {
  original: "original developer",
  rebuilt: "rebuilt",
  developer: "developer",
  proposed: "proposed the task",
};

function avatar(url: string, px: number): string {
  return `${url}${url.includes("?") ? "&" : "?"}s=${px * 2}`;
}

/** Plain-words role list of a contributor: "requested #24, PR #45, reviewed". */
function roleText(roles: string[]): string {
  return roles.join(", ");
}

/** The people behind one task: who developed it, and who has contributed since (requests, PRs, reviews). */
export default function TaskPeople({ people }: { people: TaskPeopleData | undefined }) {
  if (!people || (!people.developers.length && !people.contributors.length)) return null;
  return (
    <section id="people" className="rounded-xl border border-border bg-card p-4" aria-label="People">
      <h2 className="text-sm font-semibold">People</h2>
      {people.developers.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Developed by</div>
          <ul className="mt-2 flex flex-wrap gap-3">
            {people.developers.map((d) => (
              <li key={`${d.login}-${d.role}`}>
                <a href={d.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg pr-2 hover:bg-muted/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatar(d.avatar_url, 36)} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 rounded-full border border-border" />
                  <span className="flex flex-col leading-tight">
                    <span className="font-mono text-sm">{d.login}</span>
                    <span className="text-[11px] text-muted-foreground">{ROLE[d.role] ?? d.role}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {people.note && <p className="mt-2 text-xs text-muted-foreground">{people.note}</p>}
      {people.contributors.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Contributors <span className="font-normal normal-case">{people.contributors.length}</span>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {people.contributors.map((c) => (
              <li key={c.login}>
                <a
                  href={c.html_url}
                  target="_blank"
                  rel="noreferrer"
                  title={`${c.login}: ${roleText(c.roles)}`}
                  className="flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-0.5 pr-2 text-xs hover:bg-muted/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatar(c.avatar_url, 22)} alt="" width={22} height={22} loading="lazy" className="h-[22px] w-[22px] rounded-full" />
                  <span className="font-mono">{c.login}</span>
                  <span className="hidden text-muted-foreground sm:inline">· {roleText(c.roles)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
