"use client";

import { Highlighter, codeTheme } from "./highlighter";

export default function DiffBlock({ diff, maxHeight = 560 }: { diff: string; maxHeight?: number }) {
  const lines = diff.replace(/\n$/, "").split("\n");
  return (
    <div className="overflow-auto rounded-lg border border-border bg-code-bg text-xs" style={{ maxHeight }}>
      <Highlighter
        language="diff"
        style={codeTheme}
        wrapLines
        customStyle={{ margin: 0, background: "transparent", fontSize: "0.75rem", padding: "0.5rem 0" }}
        lineProps={(n: number) => {
          const l = lines[n - 1] ?? "";
          const style: React.CSSProperties = { display: "block", paddingLeft: "0.75rem", borderLeft: "3px solid transparent" };
          if (l.startsWith("+") && !l.startsWith("+++")) {
            style.background = "rgba(34, 197, 94, 0.14)";
            style.borderLeft = "3px solid rgb(74, 222, 128)";
          } else if (l.startsWith("-") && !l.startsWith("---")) {
            style.background = "rgba(244, 63, 94, 0.14)";
            style.borderLeft = "3px solid rgb(251, 113, 133)";
          } else if (l.startsWith("@@")) {
            style.background = "rgba(148, 163, 184, 0.12)";
          }
          return { style };
        }}
        codeTagProps={{ style: { fontFamily: "inherit" } }}
      >
        {lines.join("\n")}
      </Highlighter>
    </div>
  );
}
