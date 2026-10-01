"use client";
// The shortlist lives in this browser only (localStorage). It is never written
// into the static data and never sent anywhere.
const KEY = "mlrelay-shortlist";
const EVT = "mlrelay-shortlist";

export function getShortlist(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function setShortlist(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(ids)]));
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

export function toggleShortlist(id: string) {
  const cur = getShortlist();
  setShortlist(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
}

export function onShortlistChange(fn: () => void): () => void {
  const h = () => fn();
  window.addEventListener(EVT, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(EVT, h);
    window.removeEventListener("storage", h);
  };
}
