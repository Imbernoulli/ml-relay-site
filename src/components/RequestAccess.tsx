"use client";

import { useEffect, useState } from "react";
import { viewer } from "@/lib/github";

const OWNER_EMAIL = "bohan@berkeley.edu";
const SUBJECT = "give me the request";

function bodyFor(login: string): string {
  return `Hi Bohan,\n\nPlease add my GitHub account to Imbernoulli/ML-Relay so I can use ML-Relay.\n\nGitHub username: ${login}\nGitHub profile: https://github.com/${login}\n\nThanks!`;
}

/** For signed-in visitors without access to the private repo: a prefilled access-request email. */
export default function RequestAccess({ compact = false }: { compact?: boolean }) {
  const [login, setLogin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    viewer()
      .then((v) => setLogin(v.login))
      .catch(() => {});
  }, []);
  const who = login ?? "<your GitHub username>";
  const body = bodyFor(who);
  const href = `mailto:${OWNER_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
  const copy = async () => {
    const text = `To: ${OWNER_EMAIL}\nSubject: ${SUBJECT}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this request", text);
    }
  };
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      <a
        href={href}
        className={`rounded-md border border-emerald-600/60 bg-emerald-600/15 font-medium text-emerald-800 hover:border-emerald-600 dark:text-emerald-200 ${
          compact ? "px-2 py-0.5" : "px-3 py-1.5"
        }`}
      >
        Request access by email
      </a>
      <button type="button" onClick={copy} className="text-xs underline">
        {copied ? "Copied" : "Copy request text"}
      </button>
    </span>
  );
}
