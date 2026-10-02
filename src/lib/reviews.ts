"use client";

// Reviewer approvals: fetched live from the sign-in service (GET /reviews, no-store),
// never baked into the build. One shared copy per page, so the index and a task
// page agree and an optimistic change shows everywhere at once.
import { useEffect, useState } from "react";
import { fetchReviews, type ReviewMark } from "./github";

export type Reviews = Record<string, ReviewMark[]>;

let cache: Reviews | null = null;
let inflight: Promise<Reviews> | null = null;
let failed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((f) => f());
}

export function loadReviews(force = false): Promise<Reviews> {
  if (cache && !force) return Promise.resolve(cache);
  if (!inflight || force) {
    inflight = fetchReviews()
      .then((r) => {
        cache = r;
        failed = false;
        emit();
        return r;
      })
      .catch(() => {
        failed = true;
        emit();
        return cache ?? {};
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function setTaskMarks(task: string, marks: ReviewMark[]) {
  cache = { ...(cache ?? {}), [task]: marks };
  emit();
}

export function useReviews(): { reviews: Reviews | null; failed: boolean } {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    listeners.add(f);
    void loadReviews();
    return () => {
      listeners.delete(f);
    };
  }, []);
  return { reviews: cache, failed };
}

/** Approvals of the current version (all of them when the version is unknown). */
export function currentApprovals(marks: ReviewMark[] | undefined, version: string | null | undefined): ReviewMark[] {
  return (marks ?? []).filter((m) => !version || !m.version || m.version === version);
}
