"use client";

import { useMemo, useState } from "react";
import AnnotatedCodeBlock from "./AnnotatedCodeBlock";
import type { Range } from "@/lib/types";

export interface ViewerFile {
  filename: string;
  editable: boolean;
  edit_ranges: Range[];
  language: string;
  lines: number;
  content: string | null;
  omitted?: string | null;
  truncated?: boolean;
}

interface Node {
  name: string;
  path: string;
  children: Map<string, Node>;
  file?: ViewerFile;
}

function buildTree(files: ViewerFile[]): Node {
  const root: Node = { name: "", path: "", children: new Map() };
  for (const f of files) {
    const parts = f.filename.split("/");
    let cur = root;
    parts.forEach((p, i) => {
      const path = parts.slice(0, i + 1).join("/");
      if (!cur.children.has(p)) cur.children.set(p, { name: p, path, children: new Map() });
      cur = cur.children.get(p)!;
      if (i === parts.length - 1) cur.file = f;
    });
  }
  return root;
}

// Collapse chains of single-child directories ("a/b/c") so the tree stays shallow.
function compact(n: Node): Node {
  const kids = new Map<string, Node>();
  for (const [k, c] of n.children) {
    let node = compact(c);
    while (!node.file && node.children.size === 1) {
      const only = [...node.children.values()][0];
      node = { ...only, name: `${node.name}/${only.name}` };
    }
    kids.set(k, node);
  }
  return { ...n, children: kids };
}

function sorted(n: Node): Node[] {
  return [...n.children.values()].sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name));
}

function TreeNode({ n, depth, active, onPick }: { n: Node; depth: number; active: string; onPick: (p: string) => void }) {
  const [open, setOpen] = useState(true);
  if (n.file) {
    const f = n.file;
    return (
      <button
        onClick={() => onPick(f.filename)}
        title={f.filename}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left font-mono text-[11.5px] ${
          active === f.filename ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
      >
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${f.editable ? "bg-emerald-500" : f.content === null ? "bg-transparent ring-1 ring-gray-400" : "bg-gray-400"}`} />
        <span className="break-anywhere">{n.name}</span>
      </button>
    );
  }
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-left font-mono text-[11.5px] text-foreground hover:bg-muted/60"
      >
        <span className="w-3 text-muted-foreground">{open ? "▾" : "▸"}</span>
        <span className="break-anywhere">{n.name}/</span>
      </button>
      {open && sorted(n).map((c) => <TreeNode key={c.path} n={c} depth={depth + 1} active={active} onPick={onPick} />)}
    </div>
  );
}

export default function EnvViewer({ files, note }: { files: ViewerFile[]; note?: string }) {
  const tree = useMemo(() => compact(buildTree(files)), [files]);
  const first = files.find((f) => f.editable) ?? files[0];
  const [active, setActive] = useState(first?.filename ?? "");
  if (!files.length) return <p className="text-sm text-muted-foreground">No source files.</p>;
  const f = files.find((x) => x.filename === active) ?? first;
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid md:grid-cols-[minmax(12rem,17rem)_1fr]">
        <div className="max-h-[22rem] overflow-auto border-b border-border bg-muted/30 py-2 md:max-h-[44rem] md:border-b-0 md:border-r">
          <div className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Files</div>
          {sorted(tree).map((c) => (
            <TreeNode key={c.path} n={c} depth={0} active={f.filename} onPick={setActive} />
          ))}
          <div className="mt-2 flex flex-wrap gap-3 px-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> editable
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-400" /> read-only
            </span>
          </div>
        </div>
        <div className="min-w-0 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="break-anywhere font-mono font-medium">{f.filename}</span>
            <span className="text-muted-foreground">
              {f.editable
                ? `editable ${f.edit_ranges.map((r) => (r.whole_file ? "whole file" : `${r.start}–${r.end}`)).join(", ")}`
                : "read-only"}{" "}
              · {f.lines} lines
            </span>
          </div>
          {f.content === null ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Not shown{f.omitted ? `: ${f.omitted}` : ""}.
            </p>
          ) : (
            <AnnotatedCodeBlock
              key={f.filename}
              code={f.content}
              filename={f.filename}
              language={f.language}
              editRanges={f.editable ? f.edit_ranges : undefined}
              defaultMode="full"
            />
          )}
          {f.truncated && <p className="mt-1 text-[11px] text-muted-foreground">Large file: shown truncated.</p>}
          {note && <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>}
        </div>
      </div>
    </div>
  );
}
