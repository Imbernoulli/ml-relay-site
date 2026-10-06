import Link from "next/link";
import type { DevInfo, TaskPeopleData } from "@/lib/types";

const STAGE: Record<string, string> = {
  idea: "Idea",
  design: "Design review",
  pilot: "Building & pilot run",
  measurement: "Full measurement",
  gate3: "Final checks (Gate 3)",
};

export function DevBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-sky-600/50 bg-sky-600/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
      In development
    </span>
  );
}

/** Banner on the page of a task still being built: its stage, where it is discussed, and that the numbers are preliminary. */
export default function DevBanner({ dev }: { dev: DevInfo }) {
  return (
    <div role="note" className="mt-3 rounded-xl border-2 border-sky-600/40 bg-sky-600/5 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <DevBadge />
        <span className="font-medium">
          {dev.phase ? `Phase ${dev.phase}: ` : ""}
          {STAGE[dev.stage] ?? dev.stage}
        </span>
        {dev.issue ? (
          <Link href={`/requests/${dev.issue}/`} className="underline">
            proposal #{dev.issue}
          </Link>
        ) : null}
        {dev.since && <span className="text-muted-foreground">since {dev.since}</span>}
      </div>
      <p className="mt-2 text-sm">
        This task is not part of ML-Relay yet. The page shows its current state; baselines, settings and numbers are preliminary and may change
        before it ships. Baseline code and scores appear once it ships.
      </p>
    </div>
  );
}

/** The People card of a task in development: who proposed it. */
export function devPeople(dev: DevInfo | undefined): TaskPeopleData | undefined {
  if (!dev?.requester || !/^[A-Za-z0-9-]{1,39}$/.test(dev.requester)) return undefined;
  const login = dev.requester;
  return {
    developers: [{ login, avatar_url: `https://github.com/${login}.png`, html_url: `https://github.com/${login}`, role: "proposed" }],
    contributors: [],
  };
}
