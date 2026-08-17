#!/usr/bin/env node
// Test harness for @api-common/spectral-problem-details-ruleset.
//
// Asserts three things:
//   1. every rule in the ruleset fires at least once on the noncompliant fixture
//      (a rule nobody can trigger is a rule that does not work)
//   2. the clean fixture is completely silent
//   3. no rule throws while linting either document
//
// Plus one specific regression guard: the clean fixture carries the XML
// namespace `urn:ietf:rfc:7807`, which RFC 9457 Appendix B retained. If
// problem-details-cites-obsoleted-rfc7807 ever over-matches onto it, assertion
// 2 fails and names the rule.
//
// No test framework — spawn Spectral, parse JSON, exit non-zero on failure.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const rulesetPath = resolve(root, 'problem-details.yaml');

let failures = 0;

function lint(fixture) {
  const file = resolve(root, 'fixtures', fixture);
  const bin = resolve(root, 'node_modules', '.bin', 'spectral');
  // Write JSON to a file: with -f json the CLI still prints a human-readable
  // "No results ... found!" line to stdout, which would corrupt a parse.
  const outFile = resolve(tmpdir(), `pd-spectral-${fixture}-${process.pid}.json`);
  const res = spawnSync(
    bin,
    ['lint', file, '-r', rulesetPath, '-f', 'json', '-o', outFile, '--verbose'],
    { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 }
  );

  const stderr = res.stderr || '';
  if (/threw|exception|Error running|Cannot read|is not a function/i.test(stderr)) {
    console.error(`  RULE ERROR while linting ${fixture}:`);
    console.error(stderr.trim());
    failures++;
  }

  let json;
  try {
    json = JSON.parse(readFileSync(outFile, 'utf8').trim() || '[]');
  } catch {
    console.error(`Failed to parse Spectral JSON output for ${fixture}.`);
    console.error('stdout:', res.stdout);
    console.error('stderr:', res.stderr);
    process.exit(2);
  } finally {
    try { rmSync(outFile, { force: true }); } catch {}
  }
  return json;
}

// Every rule id declared in the ruleset. Read with a regex rather than a YAML
// parser so the harness stays dependency-free: take the `rules:` block and
// collect its two-space-indented keys.
function declaredRules() {
  const src = readFileSync(rulesetPath, 'utf8');
  const start = src.search(/^rules:\s*$/m);
  if (start === -1) {
    console.error('Could not find a top-level `rules:` block in the ruleset.');
    process.exit(2);
  }
  const ids = [];
  for (const line of src.slice(start).split('\n').slice(1)) {
    if (/^\S/.test(line)) break; // dedented out of the rules block
    const m = line.match(/^ {2}([A-Za-z0-9][A-Za-z0-9-]*):\s*$/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

const declared = declaredRules();
if (!declared.length) {
  console.error('Parsed zero rule ids — the harness would vacuously pass. Aborting.');
  process.exit(2);
}
console.log(`Ruleset declares ${declared.length} rules.\n`);

// ---------------------------------------------------------------- noncompliant
console.log('== Linting NONCOMPLIANT fixture — every rule must fire ==');
const bad = lint('noncompliant.yaml');
const fired = new Set(bad.map((r) => r.code));
console.log(`   ${bad.length} findings across ${fired.size} distinct rules.`);

const silent = declared.filter((id) => !fired.has(id));
if (silent.length) {
  console.error(`   FAIL — ${silent.length} rule(s) never fired:`);
  for (const id of silent) console.error(`          ${id}`);
  failures++;
} else {
  console.log('   PASS — every declared rule fired.');
}

const unknown = [...fired].filter((id) => !declared.includes(id));
if (unknown.length) {
  console.error(`   FAIL — findings from rules not declared here: ${unknown.join(', ')}`);
  failures++;
}

// ----------------------------------------------------------------------- clean
console.log('\n== Linting CLEAN fixture — must be silent ==');
const clean = lint('clean.yaml');
if (clean.length) {
  console.error(`   FAIL — ${clean.length} finding(s) on a document that should pass:`);
  for (const r of clean) {
    console.error(`          ${r.code} at ${r.path.join('.')} — ${r.message}`);
  }
  failures++;
} else {
  console.log('   PASS — clean fixture is silent.');
  console.log('   (Which also proves problem-details-cites-obsoleted-rfc7807 does not');
  console.log('    over-match the retained XML namespace urn:ietf:rfc:7807.)');
}

// ---------------------------------------------------------------------- result
console.log('');
if (failures) {
  console.error(`FAILED (${failures} problem${failures === 1 ? '' : 's'})`);
  process.exit(1);
}
console.log('All checks passed.');
