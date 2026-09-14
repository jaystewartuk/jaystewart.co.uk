#!/usr/bin/env node
/**
 * Fail the build if a name that must not be published appears in the repository
 * or in the built output.
 *
 * The problem
 * -----------
 * One case study on this site describes a company that has not announced
 * itself. The engineering is published; the identity is not. That constraint
 * binds the *source*, not just the rendered page — this repository is public,
 * so an MDX draft, an image filename, an alt attribute or a commit message
 * leaks exactly as effectively as body copy would.
 *
 * A reviewer cannot hold that rule reliably. A grep can.
 *
 * Why the terms are hashed
 * ------------------------
 * A checker that stores the forbidden words in plaintext publishes them itself
 * — the words would sit in this file, in a public repository, indexed. So the
 * script stores truncated SHA-256 digests and hashes each token it encounters
 * to compare.
 *
 * The honest limitation: these are short, unsalted digests of guessable words.
 * They are not secret against someone who suspects a specific term and tests
 * for it, and a salt would not change that, since the salt would have to live
 * here too. That is not what this defends against. It defends against the
 * words being present, greppable and search-indexed — which is the actual
 * failure mode.
 *
 * Usage
 * -----
 *   node scripts/check-stealth.mjs           # source tree
 *   node scripts/check-stealth.mjs dist      # built output, after a build
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, process.argv[2] ?? '.');

/**
 * Truncated SHA-256 of each blocked term, grouped by how many whitespace-
 * separated words the term contains, so multi-word names are caught too.
 */
const BLOCKED = {
  1: new Set([
    'ff22e70559d1d35b',
    '3ebe9991655721db',
    '64762f0a177079dc',
    'bd949c97616611be',
    '0f9af1a8b568e2c9',
    'e1df4cace5b63c36',
    'ab1c2fcd5516f471',
    '4e71eb6cf08afacd',
    'e575814264a98bfb',
  ]),
  2: new Set(['bb50d6b424b53add', '6f29c24d6029c86e']),
  3: new Set(['c56f3853c720a509']),
};

const digest = (value) => createHash('sha256').update(value).digest('hex').slice(0, 16);

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.astro',
  'coverage',
  'test-results',
  'playwright-report',
  'fonts',
]);

/** Binary and vendored formats where token scanning is meaningless. */
const SKIP_EXT = new Set([
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
  '.ico',
  '.mp4',
  '.webm',
  '.pdf',
  '.zip',
]);

/** This file necessarily contains the digests it is testing for. */
const SELF = resolve(fileURLToPath(import.meta.url));

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (!SKIP_EXT.has(extname(entry.name).toLowerCase())) yield full;
  }
}

/**
 * Split into lowercase word tokens. Punctuation, path separators and camelCase
 * boundaries all split, so `docs/binni-bus/Route.tsx` yields the same tokens as
 * prose would.
 */
function tokenise(text) {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const findings = [];

function scan(text, label) {
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    const tokens = tokenise(line);

    for (let i = 0; i < tokens.length; i += 1) {
      for (const size of [1, 2, 3]) {
        if (i + size > tokens.length) continue;

        const phrase = tokens.slice(i, i + size).join(' ');
        if (BLOCKED[size].has(digest(phrase))) {
          findings.push({ label, line: index + 1, hint: `${phrase.length}-char token` });
        }
      }
    }
  });
}

if (!existsSync(target)) {
  console.error(`check-stealth: no such path: ${target}`);
  process.exit(1);
}

let scanned = 0;

for (const file of files(target)) {
  if (file === SELF) continue;

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  // A crude binary guard for extensions not on the list: a NUL byte means
  // this is not text, and tokenising it would be noise.
  if (text.indexOf('\u0000') !== -1) continue;

  scan(text, relative(root, file));
  scanned += 1;
}

// Filenames and directory names leak just as readily as file contents.
function scanPaths(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    scan(entry.name, `${relative(root, full)} (path)`);
    if (entry.isDirectory()) scanPaths(full);
  }
}

scanPaths(target);

if (findings.length > 0) {
  console.error(`\ncheck-stealth: ${findings.length} leak(s) found\n`);
  for (const { label, line, hint } of findings) {
    console.error(`  ${label}:${line}  — blocked term (${hint})`);
  }
  console.error(
    '\nThese names must not appear in a public repository. Rewrite the ' +
      'reference in the abstract, then re-run.\n',
  );
  process.exit(1);
}

console.log(
  `check-stealth: clean — ${scanned} files scanned under ${relative(root, target) || '.'}`,
);
