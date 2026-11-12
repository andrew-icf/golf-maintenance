#!/usr/bin/env node
// PreToolUse hook: blocks edits to .env files, curl cookie files, and migrations that are already on main.
// Exit 2 blocks the edit and sends the reason back to Claude.
//
// Every comparison ignores capitalization. macOS ignores case in file names, so backend/.ENV or
// Backend/Migrations/... open the same file as the lowercase path and must be caught too.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// A migration on any of these refs counts as already merged. A ref that doesn't exist is skipped.
const BASE_REFS = ['main', 'origin/main'];
const MIGRATIONS_DIR = 'backend/migrations/';

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}
const filePath = input?.tool_input?.file_path || input?.tool_input?.notebook_path;
if (!filePath) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const abs = path.resolve(projectDir, filePath);
const relLower = path.relative(projectDir.toLowerCase(), abs.toLowerCase()).split(path.sep).join('/');
const insideProject = !relLower.startsWith('..') && !path.isAbsolute(relLower);
const shown = insideProject ? path.relative(projectDir, abs).split(path.sep).join('/') : abs;
const baseLower = path.basename(abs).toLowerCase();

function block(reason) {
  process.stderr.write(reason + '\n');
  process.exit(2);
}

function git(args) {
  return spawnSync('git', args, { cwd: projectDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

// .env.example holds placeholder names only, so it's the one exception.
const isEnvFile = (baseLower === '.env' || baseLower.startsWith('.env.')) && baseLower !== '.env.example';
if (isEnvFile) {
  block(
    `Blocked: ${shown} is an environment file and may hold secrets like database passwords. ` +
      `AGENTS.md: "Never commit .env files, cookie files, or secrets." Ask the user to edit it themselves.`,
  );
}

if (baseLower.endsWith('cookies.txt')) {
  block(
    `Blocked: ${shown} is a curl cookie file and holds a live session token. ` +
      `AGENTS.md: "Never commit .env files or cookie files. Curl cookie jars go in /tmp." ` +
      `Let curl write its own cookie jar in /tmp instead of editing one.`,
  );
}

if (insideProject && relLower.startsWith(MIGRATIONS_DIR)) {
  // A migration on main may already be applied somewhere, so changing it would leave databases out of step.
  // Migrations created on this branch (including one goose just created) can still be filled in.
  const refs = BASE_REFS.filter((ref) => {
    const result = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return !result.error && result.status === 0;
  });
  if (refs.length === 0) {
    block(
      `Blocked: couldn't check whether ${shown} is already on ${BASE_REFS.join(' or ')} ` +
        `(git or those branches aren't available here). Ask the user before editing a migration.`,
    );
  }
  for (const ref of refs) {
    // List the whole tree and compare in lowercase, since git's own path matching is case-sensitive.
    const listing = git(['ls-tree', '-r', '--name-only', ref]);
    if (listing.error || listing.status !== 0) {
      block(`Blocked: couldn't list the files on ${ref} to check ${shown}. Ask the user before editing a migration.`);
    }
    const onRef = listing.stdout.split('\n').some((name) => name.toLowerCase() === relLower);
    if (onRef) {
      block(
        `Blocked: ${shown} is already on ${ref}. AGENTS.md: "Migrations in backend/migrations/ are never ` +
          `edited once they are on main. Add a new one." Create a new one from backend/ with ` +
          `\`goose -dir migrations create <name> sql\` and apply it to both databases.`,
      );
    }
  }
}

process.exit(0);
