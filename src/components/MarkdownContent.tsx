"use client";

import { Component, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Highlighter, codeTheme, KNOWN_LANGS } from "./highlighter";

class Boundary extends Component<{ children: ReactNode; fallback: string }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  render() {
    if (this.state.err) return <pre className="whitespace-pre-wrap text-sm">{this.props.fallback}</pre>;
    return this.props.children;
  }
}

const components: Components = {
  code({ className, children }) {
    const m = /language-([\w-]+)/.exec(className || "");
    const text = String(children).replace(/\n$/, "");
    const isBlock = !!m || text.includes("\n");
    if (isBlock) {
      const lang = m && KNOWN_LANGS.has(m[1]) ? m[1] : m ? "text" : "python";
      return (
        <div className="not-prose my-3 overflow-auto rounded-lg border border-border bg-code-bg text-xs" style={{ maxHeight: 520 }}>
          <Highlighter language={lang} style={codeTheme} customStyle={{ margin: 0, background: "transparent", fontSize: "0.75rem" }} codeTagProps={{ style: { fontFamily: "inherit" } }}>
            {text}
          </Highlighter>
        </div>
      );
    }
    return <code className="break-anywhere">{children}</code>;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  table({ children }) {
    return (
      <div className="not-prose my-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return <th className="border border-border bg-muted px-3 py-2 text-left text-xs font-medium align-top">{children}</th>;
  },
  td({ children }) {
    return <td className="break-anywhere border border-border px-3 py-2 text-xs align-top">{children}</td>;
  },
  a({ href, children }) {
    return (
      <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="break-anywhere underline decoration-dotted underline-offset-2">
        {children}
      </a>
    );
  },
};

export default function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  if (!content) return null;
  return (
    <Boundary fallback={content}>
      <div className={`prose prose-sm max-w-none break-anywhere dark:prose-invert ${className}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
      </div>
    </Boundary>
  );
}
