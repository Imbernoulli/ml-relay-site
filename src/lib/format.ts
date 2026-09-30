export const DASH = "—";

export function fmt(v: unknown, digits = 4): string {
  if (v === null || v === undefined || v === "") return DASH;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return DASH;
    const a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(2);
    if (a >= 1000) return v.toFixed(1);
    if (a >= 100) return v.toFixed(2);
    return Number(v.toFixed(digits)).toString();
  }
  return String(v);
}

export function fmtScore(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return v.toFixed(4);
}

export function hours(sec: number | null | undefined): string {
  if (!sec) return DASH;
  const h = sec / 3600;
  return h >= 1 ? `${Number(h.toFixed(1))} h` : `${Math.round(sec / 60)} min`;
}

export function gb(mb: number | null | undefined): string {
  if (!mb) return DASH;
  return `${Number((mb / 1024).toFixed(1))} GiB`;
}

export function firstParagraph(s: string | null | undefined): string {
  if (!s) return "";
  return s.trim().split(/\n\s*\n/)[0].replace(/\s*\n\s*/g, " ");
}

export const VERDICT_STYLE: Record<string, string> = {
  FAITHFUL: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  FIXED: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  DEVIATES: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "NO-REFERENCE": "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "NOT-THE-METHOD": "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  EXTRAPOLATION: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

export function areaSlug(a: string | null): string {
  return (a || "other").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
