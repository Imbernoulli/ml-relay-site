"use client";

import { useState } from "react";
import AnnotatedCodeBlock from "./AnnotatedCodeBlock";
import type { CodeFile } from "@/lib/types";

export default function TaskCodeViewer({ files }: { files: CodeFile[] }) {
  const [active, setActive] = useState(0);
  if (!files.length) return <p className="text-sm text-muted-foreground">No files.</p>;
  const f = files[Math.min(active, files.length - 1)];
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {files.map((x, i) => (
          <button
            key={x.filename}
            onClick={() => setActive(i)}
            className={`break-anywhere rounded-md border px-2.5 py-1 text-left font-mono text-[11px] transition-colors ${
              i === active ? "border-foreground/40 bg-muted text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
            title={x.filename}
          >
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${x.editable ? "bg-emerald-500" : "bg-gray-400"}`} />
            {x.filename.split("/").slice(-2).join("/")}
          </button>
        ))}
      </div>
      {f.content === null ? (
        <p className="text-sm text-muted-foreground">— (content not resolved; see gaps)</p>
      ) : (
        <>
          <AnnotatedCodeBlock
            key={f.filename}
            code={f.content}
            filename={f.filename}
            language={f.language}
            editRanges={f.editable ? f.edit_ranges : undefined}
            defaultMode="window"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {f.editable
              ? `Editable lines ${f.edit_ranges.map((r) => (r.whole_file ? "whole file" : `${r.start}–${r.end}`)).join(", ")} (as instruction.md states them, in agent-start line numbers).`
              : "Read-only context."}{" "}
            {f.truncated && "Large data file: shown truncated. "}
            Source: {f.source ?? "—"}.
          </p>
        </>
      )}
    </div>
  );
}
