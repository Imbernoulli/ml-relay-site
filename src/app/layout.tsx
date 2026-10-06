import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { loadStatus, siteMode, taskDevelopers } from "@/lib/data";

const MODE = siteMode();

export const metadata: Metadata =
  MODE === "public"
    ? { title: "ML-Relay", description: "ML-Relay: fifty-two machine-learning research questions with published baselines and results." }
    : { title: "ML-Relay (internal)", description: "Internal browser for the 52 ML-Relay research tasks. Not public.", robots: { index: false, follow: false } };

// Runs before paint: pick the saved theme, else the OS preference.
const THEME_BOOT = `(function(){try{var t=localStorage.getItem('mlrelay-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <Navbar mode={MODE} maintainers={MODE === "public" ? loadStatus().maintainers ?? [] : []} developers={MODE === "public" ? taskDevelopers() : {}} />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground px-4">
          {MODE === "public"
            ? "ML-Relay · task pages generated from the ML-Relay task bundles · source code is shown for reading; build files, data and test harness are not published"
            : "ML-Relay internal browser · generated from the delivered ml-relay-v2 bundles and README · not public, do not share outside the team"}
        </footer>
      </body>
    </html>
  );
}
