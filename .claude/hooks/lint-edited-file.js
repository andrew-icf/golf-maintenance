#!/usr/bin/env node
// PostToolUse hook: lints the edited file.
// - Go files under backend/: gofmt, then go vet on the file's package.
// - JS files under frontend/: oxlint with the frontend's .oxlintrc.json.
// Errors go back to Claude (exit 2). Warnings don't block. If a tool is missing, the hook skips quietly,
// and if a linter itself breaks, the hook tells the user without blocking (exit 1).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const FRONTEND_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}
const filePath = input?.tool_input?.file_path;
if (!filePath) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const abs = path.resolve(projectDir, filePath);
const rel = path.relative(projectDir, abs);
if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(abs)) process.exit(0);
const parts = rel.split(path.sep);
const extension = path.extname(abs);

function block(message) {
  process.stderr.write(message.trimEnd() + '\n');
  process.exit(2);
}

function warnUser(message) {
  process.stderr.write(message.trimEnd() + '\n');
  process.exit(1);
}

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

if (parts[0] === 'backend' && extension === '.go') {
  const backendDir = path.join(projectDir, 'backend');
  const relToBackend = path.relative(backendDir, abs);

  const gofmt = run('gofmt', ['-l', abs], backendDir);
  if (gofmt.error) process.exit(0); // Go isn't installed; skip quietly
  if (gofmt.status !== 0) {
    block(`gofmt could not parse ${rel}. Fix the syntax error:\n${gofmt.stderr}`);
  }
  if (gofmt.stdout.trim() !== '') {
    block(`gofmt: ${rel} is not formatted. Run \`gofmt -w ${relToBackend}\` from backend/.`);
  }

  const packageDir = './' + path.dirname(relToBackend).split(path.sep).join('/');
  const vet = run('go', ['vet', packageDir], backendDir);
  if (vet.error) process.exit(0);
  if (vet.status !== 0) {
    block(`go vet found problems in ${packageDir} (after editing ${rel}). Fix them before continuing:\n${vet.stderr}`);
  }
  process.exit(0);
}

if (
  parts[0] === 'frontend' &&
  FRONTEND_EXTENSIONS.has(extension) &&
  !parts.includes('node_modules') &&
  parts[1] !== 'dist'
) {
  const frontendDir = path.join(projectDir, 'frontend');
  const oxlint = path.join(frontendDir, 'node_modules', '.bin', 'oxlint');
  if (!fs.existsSync(oxlint)) process.exit(0); // dependencies not installed; skip quietly

  // --quiet reports errors only, so warnings never block.
  const result = run(oxlint, ['--quiet', path.relative(frontendDir, abs)], frontendDir);
  if (result.status === 1) {
    block(`oxlint errors in ${rel}. Fix them before continuing:\n${result.stdout}${result.stderr}`);
  }
  if (result.status !== 0) {
    warnUser(`oxlint hook could not run: ${result.stderr || result.stdout || result.error}`);
  }
  process.exit(0);
}

process.exit(0);
