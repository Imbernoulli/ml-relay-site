import MarkdownContent from "./MarkdownContent";
import { KIND_LABEL, postMeta } from "@/lib/threads";

export interface PostUser {
  login: string;
  avatar_url: string;
  type?: string;
}

const CHIP: Record<string, string> = {
  request: "border-emerald-600/50 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200",
  "method-idea": "border-violet-500/50 bg-violet-500/10 text-violet-800 dark:text-violet-200",
  agent: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200",
};

const isBot = (u: PostUser) => u.type === "Bot" || /\[bot\]$/.test(u.login);
const fmt = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC";
/** Visible text: HTML comments (markers) removed; raw HTML is never rendered. */
export const cleanBody = (b: string | null | undefined) => (b ?? "").replace(/<!--[\s\S]*?-->/g, "").trim();

/** One post of a thread, with a chip saying what it is (change request, method idea, to the agent). */
export default function ThreadPost({
  user,
  at,
  url,
  body,
  first = false,
}: {
  user: PostUser;
  at: string;
  url: string;
  body: string | null;
  first?: boolean;
}) {
  const meta = postMeta(body);
  const raw = body ?? "";
  const kind = /^\s*\/run\b/.test(raw) ? "agent" : /^\s*\/approve\b/.test(raw) ? "approve" : meta.kind;
  const text = cleanBody(raw);
  return (
    <li className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${user.avatar_url}${user.avatar_url.includes("?") ? "&" : "?"}s=48`} alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
        <span className="font-mono font-medium">{user.login}</span>
        {isBot(user) && <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">agent</span>}
        {CHIP[kind] && <span className={`rounded-full border px-1.5 py-px text-[10px] font-semibold ${CHIP[kind]}`}>{KIND_LABEL[kind]}</span>}
        {kind === "approve" && <span className="rounded-full border border-sky-500/50 bg-sky-500/10 px-1.5 py-px text-[10px] font-semibold text-sky-800 dark:text-sky-200">started the agent</span>}
        {meta.movedFrom && <span className="text-muted-foreground">moved from #{meta.movedFrom}</span>}
        <span className="text-muted-foreground">
          {first ? "opened the thread" : "commented"} · {fmt(at)}
        </span>
        <a href={url} target="_blank" rel="noreferrer" className="ml-auto text-muted-foreground underline">
          GitHub
        </a>
      </div>
      <div className="prose prose-sm max-w-none px-3 py-2 dark:prose-invert">{text ? <MarkdownContent content={text} /> : <p className="text-muted-foreground">(empty)</p>}</div>
    </li>
  );
}
