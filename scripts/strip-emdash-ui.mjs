#!/usr/bin/env node
/**
 * Strip em-dashes ONLY from user-facing text - JSX content in .tsx files,
 * plus the two libs that carry copy that ends up rendered/sent to users
 * (whatsapp message strings and email template HTML).
 *
 * Preserves:
 *  - Single-line comments (// ...)
 *  - Block comments (/* ... *\/)
 *  - JSDoc comments
 *  - Any em-dash that sits inside a // line
 *
 * This is line-based, not AST-based, but that's enough: in this codebase
 * em-dashes only appear in either prose (UI copy) or comments. Mixing
 * the two on the same line is vanishingly rare; the heuristic skips the
 * line if it starts (after whitespace) with // or *.
 */
import fs from "node:fs";
import path from "node:path";

const REPLACEMENTS = [
  // ─── characters used in the codebase. Replace with the same-width
  // ASCII fallback so we don't widen or shrink lines that aren't text.
  // Em-dash -> hyphen-minus (with surrounding spaces preserved).
];

function isCommentLine(line) {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function rewriteFile(p) {
  const src = fs.readFileSync(p, "utf8");
  const lines = src.split("\n");
  let changed = false;
  const out = lines.map((line) => {
    if (!line.includes("—")) return line;
    if (isCommentLine(line)) return line; // leave comments alone
    const replaced = line.replace(/—/g, "-");
    if (replaced !== line) changed = true;
    return replaced;
  });
  if (!changed) return false;
  fs.writeFileSync(p, out.join("\n"), "utf8");
  return true;
}

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next" || name === ".git" || name === ".prisma") continue;
      walk(p, acc);
    } else if (st.isFile()) {
      acc.push(p);
    }
  }
}

const root = process.cwd();
const all = [];
walk(path.join(root, "src"), all);

// Scope: every .tsx (UI), plus the two libs that carry user copy.
const eligible = all.filter((p) => {
  if (p.endsWith(".tsx")) return true;
  if (p.endsWith("/lib/email-templates.ts")) return true;
  if (p.endsWith("/lib/whatsapp.ts")) return true;
  return false;
});

let rewroteCount = 0;
for (const p of eligible) {
  if (rewriteFile(p)) rewroteCount++;
}
console.log(`scanned ${eligible.length} files, rewrote ${rewroteCount}`);
