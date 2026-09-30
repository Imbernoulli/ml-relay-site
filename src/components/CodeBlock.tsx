"use client";

import { Highlighter, codeTheme, KNOWN_LANGS } from "./highlighter";

interface Props {
  code: string;
  language?: string;
  startingLineNumber?: number;
  showLineNumbers?: boolean;
  maxHeight?: number;
}

export default function CodeBlock({ code, language = "python", startingLineNumber = 1, showLineNumbers = true, maxHeight = 560 }: Props) {
  const lang = KNOWN_LANGS.has(language) ? language : "text";
  return (
    <div className="overflow-auto rounded-lg border border-border bg-code-bg text-xs" style={{ maxHeight }}>
      <Highlighter
        language={lang}
        style={codeTheme}
        customStyle={{ margin: 0, background: "transparent", fontSize: "0.75rem", padding: "0.75rem 0" }}
        showLineNumbers={showLineNumbers}
        startingLineNumber={startingLineNumber}
        lineNumberStyle={{ minWidth: "3em", paddingRight: "1em", color: "#6b7280", userSelect: "none" }}
        codeTagProps={{ style: { fontFamily: "inherit" } }}
      >
        {code}
      </Highlighter>
    </div>
  );
}
