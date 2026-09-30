"use client";

import { useMemo, useState } from "react";
import { Highlighter, codeTheme, KNOWN_LANGS } from "./highlighter";
import type { Range } from "@/lib/types";

interface Props {
  code: string;
  filename: string;
  language?: string;
  /** Editable ranges (1-based, inclusive) in agent-start coordinates. */
  editRanges?: Range[];
  /** Lines to mark as changed (baseline previews). */
  changed?: Range[];
  /** Start collapsed to the editable window (editable files) or a preview. */
  defaultMode?: "window" | "full";
  label?: string;
}

const CONTEXT = 6;
const PREVIEW = 40;

function inRanges(n: number, rs: Range[] | undefined) {
  if (!rs) return false;
  for (const r of rs) if (n >= r.start && n <= r.end) return true;
  return false;
}

export default function AnnotatedCodeBlock({ code, filename, language = "python", editRanges, changed, defaultMode = "window", label }: Props) {
  const lines = useMemo(() => code.split("\n"), [code]);
  const total = lines.length;
  const hasEdit = !!editRanges && editRanges.length > 0;
  const hasChanged = !!changed && changed.length > 0;
  const [mode, setMode] = useState<"window" | "full">(defaultMode);
  const lang = KNOWN_LANGS.has(language) ? language : "text";

  // window = editable / changed region with a little context; otherwise a head preview
  const [from, to] = useMemo(() => {
    if (mode === "full") return [1, total];
    const rs = hasChanged ? changed! : hasEdit ? editRanges! : null;
    if (rs && rs.length) {
      const s = Math.max(1, Math.min(...rs.map((r) => r.start)) - CONTEXT);
      const e = Math.min(total, Math.max(...rs.map((r) => r.end)) + CONTEXT);
      return [s, e];
    }
    return [1, Math.min(total, PREVIEW)];
  }, [mode, total, hasChanged, hasEdit, changed, editRanges]);

  const shown = lines.slice(from - 1, to).join("\n");
  const windowed = from > 1 || to < total;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-code-bg px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="break-anywhere font-mono text-xs text-gray-300">{filename}</span>
          {label && <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-300">{label}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
          {hasEdit && !hasChanged && (
            <>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm border-l-2 border-emerald-400 bg-emerald-500/30" />editable</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-gray-600/40" />read-only</span>
            </>
          )}
          {hasChanged && <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm border-l-2 border-sky-400 bg-sky-500/30" />changed vs starter</span>}
          <span>
            lines {from}–{to} of {total}
          </span>
          {(windowed || mode === "full") && total > PREVIEW && (
            <button onClick={() => setMode(mode === "full" ? "window" : "full")} className="rounded border border-gray-600 px-2 py-0.5 text-gray-300 hover:text-white">
              {mode === "full" ? (hasEdit || hasChanged ? "Show region only" : "Collapse") : "Show full file"}
            </button>
          )}
        </div>
      </div>
      <div className="max-h-[640px] overflow-auto bg-code-bg text-xs">
        <Highlighter
          language={lang}
          style={codeTheme}
          customStyle={{ margin: 0, background: "transparent", fontSize: "0.75rem", padding: "0.5rem 0" }}
          showLineNumbers
          startingLineNumber={from}
          wrapLines
          lineNumberStyle={{ minWidth: "3.5em", paddingRight: "1em", color: "#6b7280", userSelect: "none" }}
          lineProps={(ln: number) => {
            const n = ln; // already offset by startingLineNumber
            const isChanged = hasChanged && inRanges(n, changed);
            const isEdit = !hasChanged && hasEdit && inRanges(n, editRanges);
            const style: React.CSSProperties = { display: "block", borderLeft: "3px solid transparent" };
            if (isChanged) {
              style.background = "rgba(56, 189, 248, 0.14)";
              style.borderLeft = "3px solid rgb(56, 189, 248)";
            } else if (isEdit) {
              style.background = "rgba(16, 185, 129, 0.13)";
              style.borderLeft = "3px solid rgb(52, 211, 153)";
            } else if (hasEdit && !hasChanged) {
              style.opacity = 0.72;
            }
            return { style };
          }}
          codeTagProps={{ style: { fontFamily: "inherit" } }}
        >
          {shown}
        </Highlighter>
      </div>
    </div>
  );
}
