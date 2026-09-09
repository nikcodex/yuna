// Codemod: mechanically fixes errors surfaced after removing @ts-ignore lines.
// Handles: TS7006/TS7031 (implicit any params), TS18046/18047/18048/18049 (possibly undefined/null -> !)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function getTypecheckErrors() {
  const res = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], { cwd: ROOT, encoding: 'utf8' });
  const out = (res.stdout || '') + (res.stderr || '');
  const errors = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (m) errors.push({ file: m[1], line: +m[2], col: +m[3], code: m[4], msg: m[5] });
  }
  return errors;
}

// Insert text after identifier starting at col0 (returns null if unexpected shape)
function insertAfterIdent(line, col0, text) {
  const before = line.slice(0, col0);
  const rest = line.slice(col0);
  const m = rest.match(/^([A-Za-z_$][\w$]*)/);
  if (!m) return null;
  return before + m[1] + text + rest.slice(m[1].length);
}

function matchBrace(line, start) {
  const open = line[start];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) return null;
  let depth = 0;
  for (let i = start; i < line.length; i++) {
    if (line[i] === open) depth++;
    else if (line[i] === close) { depth--; if (depth === 0) return i; }
  }
  return null; // multi-line pattern
}

const FIXERS = {
  TS7006: (msg) => {
    const m = msg.match(/Parameter '([\w$]+)' implicitly has an 'any' type/);
    if (!m) return null;
    return (line, col0) => insertAfterIdent(line, col0, ': any');
  },
  TS7031: (msg) => {
    if (!/implicitly has an 'any' type/.test(msg)) return null;
    return (line, col0) => {
      const openIdx = line.indexOf('{', col0) !== -1 ? line.indexOf('{', col0) : line.indexOf('[', col0);
      if (openIdx === -1) return null;
      const close = matchBrace(line, openIdx);
      if (close === null || close === undefined) return null;
      return line.slice(0, close + 1) + ': any' + line.slice(close + 1);
    };
  },
  TS18046: (msg) => {
    if (!/'[\w$.]+' is possibly 'undefined'/.test(msg)) return null;
    return (line, col0) => insertAfterIdent(line, col0, '!');
  },
  TS18047: (msg) => {
    if (!/'[\w$.]+' is possibly 'null'/.test(msg)) return null;
    return (line, col0) => insertAfterIdent(line, col0, '!');
  },
  TS18048: (msg) => {
    if (!/'[\w$.]+' is possibly 'undefined'/.test(msg)) return null;
    return (line, col0) => insertAfterIdent(line, col0, '!');
  },
  TS18049: (msg) => {
    if (!/is possibly 'null'/.test(msg)) return null;
    return (line, col0) => insertAfterIdent(line, col0, '!');
  },
};

function runPass() {
  const errors = getTypecheckErrors();
  const fixes = [];
  for (const err of errors) {
    const fixer = FIXERS[err.code];
    if (!fixer) continue;
    const edit = fixer(err.msg);
    if (!edit) continue;
    fixes.push({ ...err, edit });
  }
  const byFile = new Map();
  for (const f of fixes) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  let applied = 0;
  for (const [file, list] of byFile) {
    const absPath = path.resolve(ROOT, file);
    const lines = readFileSync(absPath, 'utf8').split('\n');
    const seen = new Set();
    const sorted = list
      .filter((f) => { const k = `${f.line}:${f.col}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => (b.line - a.line) || (b.col - a.col));
    for (const f of sorted) {
      if (f.line < 1 || f.line > lines.length) continue;
      const res = f.edit(lines[f.line - 1], f.col - 1);
      if (res === null) continue;
      lines[f.line - 1] = res;
      applied++;
    }
    writeFileSync(absPath, lines.join('\n'));
  }
  return { total: errors.length, applied };
}

for (let i = 1; i <= 6; i++) {
  const { total, applied } = runPass();
  console.log(`pass ${i}: ${total} total errors, ${applied} fixes applied`);
  if (applied === 0) break;
}
