"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnnotatedCodeBlock from "./AnnotatedCodeBlock";
import { BASE_PATH } from "@/lib/site";
import type { Range, ViewerSummary } from "@/lib/types";

// What the agent sees in a rollout (its whole /workspace plus instruction.md) and,
// under a separate locked node, the verifier's tests/ that the agent cannot see.
// The tree structure loads up front from viewer/<task>.tree.json (small, nested);
// file contents load lazily from viewer/<task>.files.json and viewer/_shared.json.

type FileRow = [name: string, code: string, size: number | null];
type TNode = [files: FileRow[], dirs: Record<string, TNode>];
interface TreeChunk {
  task: string;
  pkgs: Record<string, string>;
  tree: { agent?: TNode; verifier?: TNode };
}
interface FilesChunk {
  content: Record<string, string>;
  shared?: Record<string, string>;
}

const REASON: Record<string, string> = {
  d: "data, weights or binary file",
  b: "build, install or dependency-pin file",
  l: "larger than 200 KB",
  s: "token or key file",
  k: "symbolic link",
  m: "not available",
};

let sharedPromise: Promise<Record<string, string>> | null = null;
function loadShared(): Promise<Record<string, string>> {
  if (!sharedPromise)
    sharedPromise = fetch(`${BASE_PATH}/viewer/_shared.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  return sharedPromise;
}

const LANG: Record<string, string> = {
  py: "python", sh: "bash", bash: "bash", yaml: "yaml", yml: "yaml", json: "json", toml: "toml", md: "markdown",
  c: "cpp", cc: "cpp", cpp: "cpp", cu: "cpp", cuh: "cpp", h: "cpp", hpp: "cpp", ts: "typescript", tsx: "typescript", js: "typescript",
  diff: "diff", patch: "diff",
};
const langOf = (p: string) => LANG[p.split(".").pop()?.toLowerCase() ?? ""] ?? "text";

function fmtSize(n: number | null | undefined) {
  if (n === null || n === undefined) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`;
}

function LockIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 4 15h8a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 12 6h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5H6V4.5a2 2 0 1 1 4 0V6Z" />
    </svg>
  );
}

// A file is addressed as "<section>:<path>" (verifier paths start with tests/).
interface FileInfo {
  key: string;
  section: "agent" | "verifier";
  path: string;
  code: string;
  size: number | null;
}
interface DirInfo {
  key: string; // "<section>:<dir path>/"
  section: "agent" | "verifier";
  path: string;
  name: string;
  count: number;
  hasEditable: boolean;
  node: TNode;
}

function countFiles(n: TNode): number {
  let c = n[0].length;
  for (const d of Object.values(n[1])) c += countFiles(d);
  return c;
}

type Row = { t: "dir"; d: DirInfo; depth: number; open: boolean; label: string; locked?: boolean } | { t: "file"; f: FileInfo; depth: number };

export default function AgentViewer({ summary }: { summary: ViewerSummary }) {
  const editable = useMemo(() => summary.editable ?? {}, [summary.editable]);
  const [chunk, setChunk] = useState<TreeChunk | null>(null);
  const [files, setFiles] = useState<FilesChunk | null>(null);
  const [shared, setShared] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<string>("");
  const [cursor, setCursor] = useState<string>("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // the tree, up front
  useEffect(() => {
    let live = true;
    fetch(`${BASE_PATH}/${summary.tree}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: TreeChunk) => {
        if (!live) return;
        setChunk(c);
        const eds = Object.keys(editable);
        const first = eds.length ? `agent:${eds[0]}` : "agent:instruction.md";
        setActive(first);
        setCursor(first);
        const o = new Set<string>();
        for (const p of eds) {
          const parts = p.split("/");
          for (let i = 1; i < parts.length; i++) o.add(`agent:${parts.slice(0, i).join("/")}/`);
        }
        setOpen(o);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [summary.tree, editable]);

  // index of every file and folder
  const index = useMemo(() => {
    const fileMap = new Map<string, FileInfo>();
    const dirMap = new Map<string, DirInfo>();
    if (!chunk) return { fileMap, dirMap };
    const walk = (section: "agent" | "verifier", node: TNode, pre: string): boolean => {
      let ed = false;
      for (const [name, code, size] of node[0]) {
        const path = pre + name;
        const key = `${section}:${path}`;
        fileMap.set(key, { key, section, path, code, size });
        if (section === "agent" && path in editable) ed = true;
      }
      for (const [name, sub] of Object.entries(node[1])) {
        const path = `${pre}${name}/`;
        const subEd = walk(section, sub, path);
        dirMap.set(`${section}:${path}`, { key: `${section}:${path}`, section, path, name, count: countFiles(sub), hasEditable: subEd, node: sub });
        ed = ed || subEd;
      }
      return ed;
    };
    if (chunk.tree.agent) walk("agent", chunk.tree.agent, "");
    if (chunk.tree.verifier) walk("verifier", chunk.tree.verifier, "");
    return { fileMap, dirMap };
  }, [chunk, editable]);

  // visible rows (tree, or a flat list of matches while filtering)
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (!chunk) return out;
    const s = q.trim().toLowerCase();
    if (s) {
      for (const f of index.fileMap.values()) {
        if (f.path.toLowerCase().includes(s)) out.push({ t: "file", f, depth: 0 });
        if (out.length >= 400) break;
      }
      return out;
    }
    const emit = (section: "agent" | "verifier", node: TNode, pre: string, depth: number) => {
      const dirs = Object.keys(node[1]).sort((a, b) => a.localeCompare(b));
      for (const name of dirs) {
        // collapse single-child chains ("a/b/c/")
        let path = `${pre}${name}/`;
        let label = name;
        let sub = node[1][name];
        while (sub[0].length === 0 && Object.keys(sub[1]).length === 1) {
          const only = Object.keys(sub[1])[0];
          path = `${path}${only}/`;
          label = `${label}/${only}`;
          sub = sub[1][only];
        }
        const d = index.dirMap.get(`${section}:${path}`)!;
        const isOpen = open.has(d.key);
        out.push({ t: "dir", d, depth, open: isOpen, label });
        if (isOpen) emit(section, sub, path, depth + 1);
      }
      const fs = [...node[0]].sort((a, b) => a[0].localeCompare(b[0]));
      for (const [name] of fs) out.push({ t: "file", f: index.fileMap.get(`${section}:${pre}${name}`)!, depth });
    };
    if (chunk.tree.agent) emit("agent", chunk.tree.agent, "", 0);
    const tests = chunk.tree.verifier?.[1]?.tests;
    if (tests) {
      const d = index.dirMap.get("verifier:tests/")!;
      const isOpen = open.has(d.key);
      out.push({ t: "dir", d, depth: 0, open: isOpen, label: "tests/ (verifier only)", locked: true });
      if (isOpen) emit("verifier", tests, "tests/", 1);
    }
    return out;
  }, [chunk, index, open, q]);

  const sel = index.fileMap.get(active) ?? null;
  const needFiles = Boolean(sel && sel.code === "t");
  useEffect(() => {
    if (!needFiles || files) return;
    fetch(`${BASE_PATH}/${summary.files}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: FilesChunk) => setFiles(c))
      .catch(() => setFiles({ content: {} }));
  }, [needFiles, files, summary.files]);
  const needShared = Boolean(sel && files?.shared && sel.key in files.shared);
  useEffect(() => {
    if (needShared && !shared) void loadShared().then(setShared);
  }, [needShared, shared]);

  const upstreamUrl = useCallback(
    (f: FileInfo) => {
      const pkg = f.path.split("/")[0];
      const base = chunk?.pkgs[pkg];
      return base ? `${base}${f.path.slice(pkg.length + 1)}` : null;
    },
    [chunk],
  );

  const toggle = (key: string, force?: boolean) =>
    setOpen((o) => {
      const n = new Set(o);
      const want = force ?? !n.has(key);
      if (want) n.add(key);
      else n.delete(key);
      return n;
    });

  const openFile = (f: FileInfo, viaClick: boolean) => {
    setActive(f.key);
    setCursor(f.key);
    if (viaClick && f.code === "u") {
      const u = upstreamUrl(f);
      if (u) window.open(u, "_blank", "noopener,noreferrer");
    }
    if (viaClick) setDrawer(false);
  };

  const rowKey = (r: Row) => (r.t === "dir" ? r.d.key : r.f.key);
  const onKey = (e: React.KeyboardEvent) => {
    if (!rows.length) return;
    const i = Math.max(0, rows.findIndex((r) => rowKey(r) === cursor));
    const r = rows[i];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const j = Math.min(rows.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)));
      const nr = rows[j];
      setCursor(rowKey(nr));
      if (nr.t === "file") setActive(nr.f.key);
      listRef.current?.querySelector(`[data-row="${CSS.escape(rowKey(nr))}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (r?.t === "dir" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggle(r.d.key);
    } else if (r?.t === "dir" && e.key === "ArrowRight") {
      e.preventDefault();
      toggle(r.d.key, true);
    } else if (r?.t === "dir" && e.key === "ArrowLeft") {
      e.preventDefault();
      toggle(r.d.key, false);
    } else if (r?.t === "file" && e.key === "Enter" && r.f.code === "u") {
      const u = upstreamUrl(r.f);
      if (u) window.open(u, "_blank", "noopener,noreferrer");
    }
  };

  if (failed) return <p className="text-sm text-muted-foreground">The file viewer could not be loaded.</p>;
  if (!chunk)
    return (
      <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
        Loading the environment: {summary.agent_files.toLocaleString()} files the agent sees
        {summary.verifier_files ? ` and ${summary.verifier_files.toLocaleString()} verifier files` : ""}…
      </p>
    );

  const text = sel && files ? files.content[sel.key] ?? (files.shared?.[sel.key] && shared ? shared[files.shared[sel.key]] : undefined) : undefined;
  const isEd = Boolean(sel && sel.section === "agent" && sel.path in editable);
  const verifier = sel?.section === "verifier";
  const crumbs = sel ? sel.path.split("/") : [];

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
        <button onClick={() => setDrawer(!drawer)} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium" aria-expanded={drawer}>
          {drawer ? "Hide files" : `Files (${(summary.agent_files + summary.verifier_files).toLocaleString()})`}
        </button>
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{sel?.path}</span>
      </div>
      <div className="grid md:grid-cols-[minmax(14rem,20rem)_1fr]">
        <div className={`${drawer ? "block" : "hidden"} border-b border-border bg-muted/30 md:block md:border-b-0 md:border-r`}>
          <div className="border-b border-border p-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter file names…"
              aria-label="Filter file names"
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-foreground/40"
            />
          </div>
          <div
            ref={listRef}
            tabIndex={0}
            onKeyDown={onKey}
            role="tree"
            aria-label="Environment files"
            className="max-h-[22rem] overflow-auto py-1 outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 md:max-h-[44rem]"
          >
            {rows.map((r) => {
              if (r.t === "dir") {
                const d = r.d;
                return (
                  <button
                    key={d.key}
                    data-row={d.key}
                    role="treeitem"
                    aria-expanded={r.open}
                    onClick={() => {
                      setCursor(d.key);
                      toggle(d.key);
                    }}
                    style={{ paddingLeft: `${r.depth * 12 + 4}px` }}
                    className={`flex w-full items-center gap-1 px-2 py-0.5 text-left font-mono text-[11.5px] ${
                      r.locked ? "mt-2 border-t border-border bg-gray-500/15 pt-1 font-semibold dark:bg-gray-400/15" : ""
                    } ${cursor === d.key ? "bg-muted" : "hover:bg-muted/60"} ${d.hasEditable ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}
                  >
                    <span className="w-3 shrink-0 text-muted-foreground">{r.open ? "▾" : "▸"}</span>
                    {r.locked && <LockIcon className="h-3 w-3 shrink-0" />}
                    <span className="break-anywhere">{r.locked ? r.label : `${r.label}/`}</span>
                    <span className="ml-auto shrink-0 pl-2 text-[10px] font-normal text-muted-foreground">{d.count.toLocaleString()}</span>
                  </button>
                );
              }
              const f = r.f;
              const ed = f.section === "agent" && f.path in editable;
              const listed = f.code !== "t" && f.code !== "u";
              return (
                <button
                  key={f.key}
                  data-row={f.key}
                  role="treeitem"
                  onClick={() => openFile(f, true)}
                  title={f.path}
                  style={{ paddingLeft: `${r.depth * 12 + 18}px` }}
                  className={`flex w-full items-center gap-1.5 px-2 py-0.5 text-left font-mono text-[11.5px] ${
                    f.section === "verifier" ? "bg-gray-500/10 dark:bg-gray-400/10" : ""
                  } ${active === f.key ? "bg-muted text-foreground" : cursor === f.key ? "bg-muted/70" : "hover:bg-muted/60"} ${
                    f.code === "t" || ed ? "text-foreground/85" : "text-muted-foreground"
                  }`}
                >
                  <span className="break-anywhere">{q ? f.path : f.path.split("/").pop()}</span>
                  {ed && <span className="shrink-0 rounded bg-emerald-600/15 px-1 text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-300">editable</span>}
                  {f.code === "u" && <span className="shrink-0 rounded bg-sky-500/15 px-1 text-[9.5px] text-sky-700 dark:text-sky-300">upstream</span>}
                  {listed && (
                    <span className="ml-auto shrink-0 pl-1 text-[9.5px] text-muted-foreground">
                      {fmtSize(f.size)} · not shown
                    </span>
                  )}
                </button>
              );
            })}
            {q && rows.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No file names match.</p>}
          </div>
        </div>
        <div className={`min-w-0 p-3 ${verifier ? "bg-gray-500/10 dark:bg-gray-400/10" : ""}`}>
          {sel ? (
            <>
              <nav aria-label="Path" className="mb-1 flex flex-wrap items-center gap-0.5 font-mono text-[11.5px]">
                {verifier && (
                  <span className="mr-1 inline-flex items-center gap-1 rounded-full border border-gray-400/60 bg-gray-500/15 px-2 py-0.5 font-sans text-[11px] font-medium">
                    <LockIcon className="h-3 w-3" /> verifier only
                  </span>
                )}
                {!verifier && <span className="text-muted-foreground">/workspace/</span>}
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  const dirKey = `${sel.section}:${crumbs.slice(0, i + 1).join("/")}/`;
                  return (
                    <span key={i} className="inline-flex items-center">
                      {last ? (
                        <span className="font-semibold">{c}</span>
                      ) : (
                        <button
                          onClick={() => {
                            setQ("");
                            for (let k = 1; k <= i + 1; k++) toggle(`${sel.section}:${crumbs.slice(0, k).join("/")}/`, true);
                            setCursor(dirKey);
                          }}
                          className="text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {c}
                        </button>
                      )}
                      {!last && <span className="px-0.5 text-muted-foreground">/</span>}
                    </span>
                  );
                })}
              </nav>
              <div className="mb-2 text-xs text-muted-foreground">
                {isEd
                  ? `editable ${editable[sel.path].map((r: Range) => (r.whole_file ? "whole file" : `lines ${r.start}–${r.end}`)).join(", ")}`
                  : verifier
                    ? "the agent cannot see this file"
                    : sel.path === "instruction.md"
                      ? "the task prompt the agent receives"
                      : sel.code === "u"
                        ? "unmodified upstream file"
                        : "read-only"}
                {sel.size ? ` · ${fmtSize(sel.size)}` : ""}
              </div>
              {sel.code === "t" ? (
                text === undefined ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <AnnotatedCodeBlock key={sel.key} code={text} filename={sel.path} language={langOf(sel.path)} editRanges={isEd ? editable[sel.path] : undefined} defaultMode="full" />
                )
              ) : sel.code === "u" ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm">
                  Byte-identical to the upstream package.{" "}
                  {upstreamUrl(sel) ? (
                    <a href={upstreamUrl(sel)!} target="_blank" rel="noreferrer" className="font-medium underline">
                      Open it at the pinned upstream commit
                    </a>
                  ) : (
                    <span className="text-muted-foreground">The package has no public upstream repository.</span>
                  )}
                </p>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Not shown: {REASON[sel.code] ?? "listed only"}
                  {sel.size ? ` (${fmtSize(sel.size)})` : ""}.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Pick a file.</p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Unmodified upstream files link to the package at its pinned commit. Build files, install and data-preparation scripts, dependency pins,
            data, weights and archives are listed by name only.
          </p>
        </div>
      </div>
    </div>
  );
}
