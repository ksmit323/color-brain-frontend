#!/usr/bin/env node
/**
 * Verifies rendered marketing copy rules across built HTML pages in dist/.
 * Usage: node scripts/check-copy.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LANDING_ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST_DIR = path.join(LANDING_ROOT, "dist");

const EXPECTED_PAGES = [
  "index.html",
  "zh/index.html",
  "zh-tw/index.html",
  "vi/index.html",
  "calculator/index.html",
  "zh/calculator/index.html",
  "zh-tw/calculator/index.html",
  "vi/calculator/index.html",
];

const HOME_PAGES = new Set([
  "index.html",
  "zh/index.html",
  "zh-tw/index.html",
  "vi/index.html",
]);

const ENGLISH_PAGES = new Set(["index.html", "calculator/index.html"]);

const RETIRED_CLAIMS = [
  "never invents",
  "never changes",
  "invented recipes",
  "no generated formula",
  "no black-box guess",
  "decision support for textile coloration",
  "从不发明配方",
  "從不發明配方",
  "không bao giờ bịa công thức",
  "虚构配方",
  "虛構配方",
  "công thức bịa đặt",
];

const ENGLISH_TYPOS = [
  "trust.As",
  "$50K to $100K/ year",
  "continuously  improve",
  "annual  savings",
];

const PROOF_BASELINE_NUMBERS = [
  "86.7%",
  "359 / 414",
  "2,043",
  "12,398",
  "20.3%",
  "+0.2082",
];

const SCROLL_BEATS_AND_PHASES = [
  'data-beat="connect"',
  'data-beat="search"',
  'data-beat="match"',
  'data-beat="adjust"',
  'data-beat="learn"',
  "scene-status__index",
  "scene-status__search",
  "scene-status__match",
  "scene-status__adjust",
  "scene-status__learn",
];

const META_KEYS = new Set([
  "description",
  "og:title",
  "og:description",
  "twitter:title",
  "twitter:description",
]);

const NAMED_ENTITIES = {
  mdash: "\u2014",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  nbsp: " ",
};

const BLOCK_TAG_RE =
  /<\/?(?:p|div|section|article|aside|header|footer|nav|main|h[1-6]|li|ul|ol|dl|dt|dd|tr|td|th|br|hr|title|option|button|label|textarea|form|figure|figcaption)\b[^>]*>/gi;

const CHECK_CATALOG = [
  ["expected-pages", "All 8 expected HTML pages exist under dist/"],
  ["no-em-dash", "Zero em-dashes (\\u2014) in copy, meta, and subject"],
  ["no-unhyphenated-cofounder", "Zero unhyphenated Cofounder"],
  ["no-retired-claims", "Zero retired positioning claims"],
  ["no-english-typos", "Zero brief typos on English pages"],
  ["proof-baseline-numbers", "All 6 proof baseline numbers intact on homepages"],
  ["scroll-beats-and-phases", "All 5 scroll beats and 5 scene-status phases on homepages"],
  ["english-home-markers", "English homepage has 3x Co-founder and LEARNING LOOP"],
];

function escapeRegex(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EM_DASH_SPECS = [{ label: "\u2014", regex: /\u2014/ }];
const COFOUNDER_SPECS = [{ label: "Cofounder", regex: /\bcofounder\b/i }];
const RETIRED_SPECS = RETIRED_CLAIMS.map((p) => ({
  label: p,
  regex: new RegExp(escapeRegex(p), "i"),
}));
const TYPO_SPECS = ENGLISH_TYPOS.map((p) => ({
  label: p,
  regex: new RegExp(escapeRegex(p), "i"),
}));

function decodeEntities(raw) {
  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (full, name) => NAMED_ENTITIES[name.toLowerCase()] ?? full);
}

function stripIgnoredBlocks(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

function extractVisibleText(cleanHtml) {
  const bodyMatch = cleanHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const source = bodyMatch ? bodyMatch[1] : cleanHtml;
  const separated = source
    .replace(BLOCK_TAG_RE, "\n")
    .replace(/<\/[a-z0-9]+>\s*<[a-z0-9][^>]*>/gi, "\n");
  return decodeEntities(separated.replace(/<[^>]+>/g, ""));
}

function parseAttr(tag, attrName) {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const match = tag.match(re);
  if (!match) return null;
  return decodeEntities(match[1] ?? match[2] ?? "");
}

function extractMetaCopy(cleanHtml) {
  const chunks = [];
  const titleMatch = cleanHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) chunks.push(decodeEntities(titleMatch[1]));
  for (const match of cleanHtml.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (parseAttr(match[0], "name") ?? parseAttr(match[0], "property") ?? "").toLowerCase();
    const content = parseAttr(match[0], "content");
    if (META_KEYS.has(key) && content) chunks.push(content);
  }
  for (const match of cleanHtml.matchAll(/<input\b[^>]*>/gi)) {
    const isSubject = (parseAttr(match[0], "name") ?? "") === "_subject";
    const value = parseAttr(match[0], "value");
    if (isSubject && value) chunks.push(value);
  }
  return chunks.join("\n");
}

function extractElementAttrCopy(cleanHtml) {
  const chunks = [];
  const re = /\b(?:aria-label|placeholder|data-text|data-tip|title)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  for (const match of cleanHtml.matchAll(re)) {
    const val = decodeEntities(match[1] ?? match[2] ?? "");
    if (val) chunks.push(val);
  }
  return chunks.join("\n");
}

function collectHtmlFiles(dir, rootDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectHtmlFiles(fullPath, rootDir));
    if (entry.isFile() && entry.name.endsWith(".html")) {
      found.push(path.relative(rootDir, fullPath).split(path.sep).join("/"));
    }
  }
  return found.sort();
}

function snippetAround(text, index, matchLength) {
  const start = Math.max(0, index - 32);
  const end = Math.min(text.length, index + matchLength + 32);
  const slice = text.slice(start, end).replace(/[\r\n\t]+/g, " ").trim();
  return `${start > 0 ? "..." : ""}${slice}${end < text.length ? "..." : ""}`;
}

function buildFailure(file, rule, offending, expected) {
  return { file, rule, offending, expected };
}

function checkForbiddenPatterns(file, text, rule, specs, expected) {
  const failures = [];
  for (const spec of specs) {
    const match = spec.regex.exec(text);
    if (!match) continue;
    const excerpt = snippetAround(text, match.index, match[0].length);
    failures.push(buildFailure(file, rule, `"${spec.label}" in "${excerpt}"`, expected));
  }
  return failures;
}

function checkRequiredLiterals(file, text, rule, literals, expectedPrefix) {
  const failures = [];
  for (const literal of literals) {
    if (text.includes(literal)) continue;
    failures.push(buildFailure(file, rule, `missing "${literal}"`, `${expectedPrefix} "${literal}"`));
  }
  return failures;
}

function checkEnglishHomeMarkers(file, visibleText, allCopy) {
  const failures = [];
  const cofounderCount = (visibleText.match(/\bCo-founder\b/g) ?? []).length;
  if (cofounderCount !== 3) {
    failures.push(buildFailure(
      file, "english-home-markers",
      `found ${cofounderCount} occurrence(s) of "Co-founder"`,
      'exactly 3 occurrences of "Co-founder" on English homepage',
    ));
  }
  if (!/learning loop/i.test(allCopy)) {
    failures.push(buildFailure(
      file, "english-home-markers",
      'missing "LEARNING LOOP"',
      'case-insensitive "LEARNING LOOP" present on English homepage',
    ));
  }
  return failures;
}

function checkExpectedPages(foundFiles) {
  const failures = [];
  if (foundFiles.length < EXPECTED_PAGES.length) {
    failures.push(buildFailure(
      "dist/",
      "expected-pages",
      `found ${foundFiles.length} HTML file(s)`,
      `at least ${EXPECTED_PAGES.length} HTML files under dist/`,
    ));
  }
  const foundSet = new Set(foundFiles);
  for (const expected of EXPECTED_PAGES) {
    if (foundSet.has(expected)) continue;
    failures.push(buildFailure(`dist/${expected}`, "expected-pages", "file not found", `built HTML page at dist/${expected}`));
  }
  return failures;
}

function inspectHtmlPage(relPath) {
  const file = `dist/${relPath}`;
  const cleanHtml = stripIgnoredBlocks(fs.readFileSync(path.join(DIST_DIR, relPath), "utf8"));
  const visible = extractVisibleText(cleanHtml);
  const allCopy = `${visible}\n${extractMetaCopy(cleanHtml)}\n${extractElementAttrCopy(cleanHtml)}`;
  const failures = [
    ...checkForbiddenPatterns(file, allCopy, "no-em-dash", EM_DASH_SPECS, "zero em-dashes (\\u2014)"),
    ...checkForbiddenPatterns(file, allCopy, "no-unhyphenated-cofounder", COFOUNDER_SPECS, 'hyphenated "Co-founder" only'),
    ...checkForbiddenPatterns(file, allCopy, "no-retired-claims", RETIRED_SPECS, "zero retired claims"),
  ];
  if (ENGLISH_PAGES.has(relPath)) failures.push(...checkForbiddenPatterns(file, allCopy, "no-english-typos", TYPO_SPECS, "zero brief typos"));
  if (HOME_PAGES.has(relPath)) {
    failures.push(...checkRequiredLiterals(file, visible, "proof-baseline-numbers", PROOF_BASELINE_NUMBERS, "homepage must contain"));
    failures.push(...checkRequiredLiterals(file, cleanHtml, "scroll-beats-and-phases", SCROLL_BEATS_AND_PHASES, "homepage HTML must contain"));
  }
  if (relPath === "index.html") failures.push(...checkEnglishHomeMarkers(file, visible, allCopy));
  return failures;
}

function printReport(foundFiles, failures) {
  const failedRules = new Set(failures.map((f) => f.rule));
  console.log(`Scanned ${foundFiles.length} HTML file(s) under dist/:`);
  for (const relPath of foundFiles) console.log(`  - dist/${relPath}`);
  console.log("\nChecks:");
  for (const [rule, label] of CHECK_CATALOG) {
    const status = failedRules.has(rule) ? "FAIL" : "PASS";
    console.log(`  [${status}] ${rule}: ${label}`);
  }
  if (failures.length === 0) {
    console.log("\nRESULT: PASS (all copy checks passed)");
    return;
  }
  console.log(`\nFailures (${failures.length}):`);
  for (const f of failures) {
    console.log(`  - ${f.file} [${f.rule}] offending: ${f.offending} | expected: ${f.expected}`);
  }
  console.log("\nRESULT: FAIL");
}

function main() {
  const foundFiles = collectHtmlFiles(DIST_DIR);
  const failures = [...checkExpectedPages(foundFiles)];
  for (const relPath of foundFiles) {
    failures.push(...inspectHtmlPage(relPath));
  }
  printReport(foundFiles, failures);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main();
