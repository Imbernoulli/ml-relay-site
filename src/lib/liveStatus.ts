"use client";

// Live request status from the sign-in service (GET /status, public, no-store): the
// backend pushes each request's public record the moment it changes. Fetched on load,
// every ~20 s while the tab is visible, and on focus; merged over the static
// status.json per issue (the newer `updated` wins). No token is needed.
import { useEffect, useState } from "react";
import type { ProgressStep } from "./types";

export interface LiveRecord {
  issue: number;
  title: string;
  type: string;
  task: string;
  requester: string;
  state: string;
  labels: string[];
  pr: number | null;
  pr_state: string | null;
  current: string;
  steps: ProgressStep[];
  updated: string;
}

const URL = `${(process.env.NEXT_PUBLIC_GH_AUTH_PROXY || "https://mletask--ml-relay-auth-web.modal.run").replace(/\/+$/, "")}/status`;
let cache: Record<string, LiveRecord> | null = null;
let inflight: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function refresh(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetch(URL, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && typeof d.issues === "object") {
        cache = d.issues;
        listeners.forEach((f) => f());
      }
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function start() {
  if (timer || typeof window === "undefined") return;
  void refresh();
  timer = setInterval(() => {
    if (document.visibilityState === "visible") void refresh();
  }, 20000);
  window.addEventListener("focus", () => void refresh());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refresh();
  });
}

export function useLiveStatus(): Record<string, LiveRecord> | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    listeners.add(f);
    start();
    return () => {
      listeners.delete(f);
    };
  }, []);
  return cache;
}

export function liveRecord(all: Record<string, LiveRecord> | null, n: number): LiveRecord | null {
  return all?.[String(n)] ?? null;
}
