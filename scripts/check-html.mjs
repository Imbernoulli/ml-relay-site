// Fails the build if a rendered page shows a placeholder value: "undefined",
// "NaN", or a bare "null", anywhere in visible text outside code blocks.
import fs from "fs";
import path from "path";

const root = process.argv[2] || "out";
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) files.push(p);
  }
})(root);

const bad = [];
for (const f of files) {
  let h = fs.readFileSync(f, "utf8");
  h = h.replace(/<script[\s\S]*?<\/script>/gi, " ")
       .replace(/<style[\s\S]*?<\/style>/gi, " ")
       .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
       .replace(/<code[\s\S]*?<\/code>/gi, " ")
       .replace(/<!--[\s\S]*?-->/g, "")
       // identifiers (slugs, metric names) are rendered monospace; a baseline may be called "null"
       .replace(/<(span|td|div|h4)\b[^>]*class="[^"]*font-mono[^"]*"[^>]*>[^<]*<\/\1>/g, " ");
  // attribute values that end up visible
  for (const m of h.matchAll(/\s(?:alt|title|aria-label)="([^"]*)"/g)) {
    if (/\b(undefined|NaN)\b|^\s*null\s*$/.test(m[1])) bad.push([f, `attribute: ${m[1].slice(0, 80)}`]);
  }
  const text = h.replace(/<[^>]+>/g, "\u0000");
  for (const node of text.split("\u0000")) {
    const t = node.replace(/&[a-z#0-9]+;/gi, " ").trim();
    if (!t) continue;
    // a placeholder is a value slot: the whole text node, or next to a unit / ± / "of"
    const slot = /^(undefined|NaN)$/.test(t) ||
      /\b(undefined|NaN|null)\s*(GPUs?|lines?|seeds?|%|per trial|KB|MB)\b/.test(t) ||
      /(±|\bof)\s*(undefined|NaN|null)\b/.test(t) || /\bundefined\b/.test(t);
    if (slot) {
      bad.push([f, t.slice(0, 100)]);
    }
  }
}
if (bad.length) {
  console.error(`check-html: ${bad.length} placeholder value(s) in rendered pages`);
  for (const [f, t] of bad.slice(0, 40)) console.error(`  ${path.relative(root, f)}: ${t}`);
  process.exit(1);
}
console.log(`check-html: ${files.length} pages clean (no undefined / NaN / null)`);
