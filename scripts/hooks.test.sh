#!/usr/bin/env bash
# Tests for the Claude Code hooks in .claude/hooks/. Run from anywhere: bash scripts/hooks.test.sh
#
# Don't run this alongside other tests (go test, npm test, Vitest watch). It briefly creates fixture
# files inside the real tree, including a Go package with a deliberate go vet error and an empty
# migration, and removes them on exit. Other test runs could pick them up in the meantime.
set -u
cd "$(dirname "$0")/.."
export CLAUDE_PROJECT_DIR="$PWD"

PROTECT=.claude/hooks/protect-files.js
LINT=.claude/hooks/lint-edited-file.js

# Temporary fixtures, all removed on exit so goose, go vet, and Vitest never see them.
MAIN_MIGRATION="backend/migrations/20260906055859_create_users_table.sql"
BRANCH_MIGRATION="backend/migrations/99999999999999_hook_test.sql"
GO_CLEAN_DIR="backend/internal/hooktestclean"
GO_FORMAT_DIR="backend/internal/hooktestformat"
GO_VET_DIR="backend/internal/hooktestvet"
JS_CLEAN="frontend/src/__hook_test_clean__.jsx"
JS_ERROR="frontend/src/__hook_test_error__.jsx"
JS_WARNING="frontend/src/__hook_test_warning__.jsx"
JS_OUTSIDE="__hook_test_outside__.jsx"
# Throwaway directories outside the repo
NO_GIT_DIR=$(mktemp -d)        # a "project" that isn't a git repo
ORIGIN_REPO=$(mktemp -d)       # a git repo whose origin/main is ahead of main
NODE_ONLY_BIN=$(mktemp -d)     # a PATH with node and nothing else (no go, no gofmt)
FAKE_FRONTEND=$(mktemp -d)     # a "project" whose frontend has no oxlint, then a broken one
cleanup() {
  rm -rf "$BRANCH_MIGRATION" "$GO_CLEAN_DIR" "$GO_FORMAT_DIR" "$GO_VET_DIR" \
    "$JS_CLEAN" "$JS_ERROR" "$JS_WARNING" "$JS_OUTSIDE" \
    "$NO_GIT_DIR" "$ORIGIN_REPO" "$NODE_ONLY_BIN" "$FAKE_FRONTEND"
}
trap cleanup EXIT

pass=0; fail=0
payload() { printf '{"tool_name":"%s","tool_input":{"file_path":"%s"}}' "$1" "$2"; }
notebook_payload() { printf '{"tool_name":"NotebookEdit","tool_input":{"notebook_path":"%s"}}' "$1"; }

# Indents the hook's output under a failure. Builtins only, so it still works when a test
# runs with a stripped-down PATH.
indent() { local line; while IFS= read -r line; do echo "    $line"; done <<< "$1"; }

# expect <name> <expected-exit> <script> <stdin> [stderr-substring]
expect() {
  local name=$1 want=$2 script=$3 input=$4 needle=${5:-}
  local err got
  err=$(printf '%s' "$input" | node "$script" 2>&1 >/dev/null); got=$?
  if [[ $got -ne $want ]]; then
    echo "FAIL: $name (exit $got, expected $want)"; indent "$err"; fail=$((fail+1)); return
  fi
  if [[ -n $needle && $err != *"$needle"* ]]; then
    echo "FAIL: $name (stderr missing \"$needle\")"; indent "$err"; fail=$((fail+1)); return
  fi
  echo "ok:   $name"; pass=$((pass+1))
}

# --- protect-files: environment files
expect "blocks backend/.env"              2 $PROTECT "$(payload Edit "$PWD/backend/.env")" "AGENTS.md"
expect "blocks frontend/.env"             2 $PROTECT "$(payload Write "$PWD/frontend/.env")" "AGENTS.md"
expect "blocks .env.local"                2 $PROTECT "$(payload Write "$PWD/frontend/.env.local")"
expect "blocks .env.production"           2 $PROTECT "$(payload Edit "$PWD/backend/.env.production")"
expect "allows .env.example"              0 $PROTECT "$(payload Edit "$PWD/backend/.env.example")"
expect "blocks .env through NotebookEdit" 2 $PROTECT "$(notebook_payload "$PWD/backend/.env")" "environment file"

# --- protect-files: capitalization (macOS opens the same file whatever the case)
expect "blocks backend/.ENV"              2 $PROTECT "$(payload Edit "$PWD/backend/.ENV")" "environment file"
expect "blocks Frontend/.Env.Local"       2 $PROTECT "$(payload Write "$PWD/Frontend/.Env.Local")" "environment file"
expect "allows backend/.ENV.EXAMPLE"      0 $PROTECT "$(payload Edit "$PWD/backend/.ENV.EXAMPLE")"
expect "blocks Admin-Cookies.TXT"         2 $PROTECT "$(payload Write "$PWD/Admin-Cookies.TXT")" "cookie"
expect "blocks Backend/Migrations/<migration on main>" 2 $PROTECT \
  "$(payload Edit "$PWD/Backend/Migrations/20260906055859_create_users_table.sql")" "already on main"
expect "blocks a migration on main in capitals" 2 $PROTECT \
  "$(payload Edit "$PWD/backend/migrations/20260906055859_CREATE_USERS_TABLE.sql")" "already on main"

# --- protect-files: curl cookie files
expect "blocks cookies.txt"               2 $PROTECT "$(payload Write "$PWD/cookies.txt")" "cookie"
expect "blocks admin-cookies.txt"         2 $PROTECT "$(payload Write "$PWD/backend/admin-cookies.txt")" "cookie"
expect "blocks a cookie jar in /tmp"      2 $PROTECT "$(payload Write "/tmp/staff-cookies.txt")" "cookie"

# --- protect-files: migrations
expect "blocks Edit of a migration on main"  2 $PROTECT "$(payload Edit "$PWD/$MAIN_MIGRATION")" "already on main"
expect "blocks Write of a migration on main" 2 $PROTECT "$(payload Write "$PWD/$MAIN_MIGRATION")" "goose -dir migrations create"
printf -- '-- +goose Up\n-- +goose Down\n' > "$BRANCH_MIGRATION"   # what goose create leaves behind
expect "allows Edit of a new migration on the branch" 0 $PROTECT "$(payload Edit "$PWD/$BRANCH_MIGRATION")"
expect "allows Write of a brand-new migration"        0 $PROTECT "$(payload Write "$PWD/backend/migrations/99999999999998_not_created_yet.sql")"
mkdir -p "$NO_GIT_DIR/backend/migrations"
CLAUDE_PROJECT_DIR="$NO_GIT_DIR" expect "blocks a migration when git can't tell" 2 $PROTECT \
  "$(payload Edit "$NO_GIT_DIR/backend/migrations/1_x.sql")" "couldn't check"

# A throwaway repo where a migration was merged upstream (origin/main) but local main is behind.
# It ignores the user's global and system git config, so commit signing or global git hooks can't
# break the setup.
(
  cd "$ORIGIN_REPO"
  export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
  commit() { git -c user.name="Obi-Wan Kenobi" -c user.email="obi-wan@example.com" commit -q --allow-empty -m "$1"; }
  git init -q -b main && commit "Start"
  git checkout -q -b upstream
  mkdir -p backend/migrations && printf -- '-- +goose Up\n' > backend/migrations/2_merged_upstream.sql
  git add backend/migrations && commit "Merged upstream"
  git update-ref refs/remotes/origin/main HEAD
  git checkout -q main && git branch -q -D upstream
)
CLAUDE_PROJECT_DIR="$ORIGIN_REPO" expect "blocks a migration that is only on origin/main" 2 $PROTECT \
  "$(payload Edit "$ORIGIN_REPO/backend/migrations/2_merged_upstream.sql")" "already on origin/main"
CLAUDE_PROJECT_DIR="$ORIGIN_REPO" expect "allows a new migration when origin/main exists" 0 $PROTECT \
  "$(payload Write "$ORIGIN_REPO/backend/migrations/3_new_on_branch.sql")"

# --- protect-files: everything else
expect "allows the dev seed"              0 $PROTECT "$(payload Edit "$PWD/backend/seed/dev_seed.sql")"
expect "allows a Go source file"          0 $PROTECT "$(payload Edit "$PWD/backend/internal/router/router.go")"
expect "allows a relative path"           0 $PROTECT "$(payload Edit "frontend/src/api.js")"
expect "allows a notebook outside the rules" 0 $PROTECT "$(notebook_payload "$PWD/analysis.ipynb")"
expect "ignores malformed input"          0 $PROTECT "not json"
expect "ignores a missing file path"      0 $PROTECT '{"tool_input":{}}'

# --- lint-edited-file: Go
mkdir -p "$GO_CLEAN_DIR" "$GO_FORMAT_DIR" "$GO_VET_DIR"
printf 'package hooktestclean\n\nfunc Answer() int { return 42 }\n' > "$GO_CLEAN_DIR/clean.go"
printf 'package hooktestformat\nfunc  Answer( ) int {return 42}\n' > "$GO_FORMAT_DIR/format.go"
printf 'package hooktestvet\n\nimport "fmt"\n\nfunc Show() { fmt.Printf("%%d\\n", "Chewbacca") }\n' > "$GO_VET_DIR/vet.go"
expect "clean Go file passes"             0 $LINT "$(payload Write "$PWD/$GO_CLEAN_DIR/clean.go")"
expect "unformatted Go file blocks"       2 $LINT "$(payload Write "$PWD/$GO_FORMAT_DIR/format.go")" "gofmt -w"
expect "go vet error blocks"              2 $LINT "$(payload Write "$PWD/$GO_VET_DIR/vet.go")" "go vet"
# Without Go on the PATH, even an unformatted file passes: the hook skips quietly.
ln -s "$(command -v node)" "$NODE_ONLY_BIN/node"
PATH="$NODE_ONLY_BIN" expect "skips Go files quietly when Go is missing" 0 $LINT \
  "$(payload Write "$PWD/$GO_FORMAT_DIR/format.go")"

# --- lint-edited-file: frontend
printf 'export function Greeting({ name }) {\n  return <p>Hello, { name }</p>\n}\n' > "$JS_CLEAN"
printf "import { useState } from 'react'\n\nexport function Counter({ show }) {\n  if (show) {\n    useState(0)\n  }\n  return null\n}\n" > "$JS_ERROR"
# A non-constant export next to a component triggers the only-export-components warning
# (constant exports are allowed by .oxlintrc.json, so they wouldn't warn).
printf "export function droidName() {\n  return 'R2-D2'\n}\n\nexport function Droid() {\n  return <p>{ droidName() }</p>\n}\n" > "$JS_WARNING"
expect "clean JSX file passes"            0 $LINT "$(payload Write "$PWD/$JS_CLEAN")"
expect "oxlint error blocks"              2 $LINT "$(payload Write "$PWD/$JS_ERROR")" "rules-of-hooks"
# Guard: the warning fixture must have warnings and no errors, or the next case proves nothing.
# Checked by exit code, not by output text: oxlint's output format changes with the environment
# (it switches to a one-line "agent" format when AI_AGENT or CLAUDECODE is set).
(cd frontend && ./node_modules/.bin/oxlint "${JS_WARNING#frontend/}" >/dev/null 2>&1); plain_exit=$?
(cd frontend && ./node_modules/.bin/oxlint --max-warnings 0 "${JS_WARNING#frontend/}" >/dev/null 2>&1); strict_exit=$?
if [[ $plain_exit -eq 0 && $strict_exit -ne 0 ]]; then
  echo "ok:   warning fixture really warns"; pass=$((pass+1))
else
  echo "FAIL: warning fixture should warn without erroring (oxlint exit $plain_exit; with --max-warnings 0, exit $strict_exit)"
  fail=$((fail+1))
fi
expect "oxlint warning does not block"    0 $LINT "$(payload Write "$PWD/$JS_WARNING")"

# A project whose frontend has no node_modules: an error file passes, because the hook skips quietly.
mkdir -p "$FAKE_FRONTEND/frontend/src"
cp "$JS_ERROR" "$FAKE_FRONTEND/frontend/src/Counter.jsx"
CLAUDE_PROJECT_DIR="$FAKE_FRONTEND" expect "skips JS quietly when oxlint isn't installed" 0 $LINT \
  "$(payload Write "$FAKE_FRONTEND/frontend/src/Counter.jsx")"
# Then give it an oxlint that crashes (exit 2): the user is told (exit 1), and the edit isn't blocked.
mkdir -p "$FAKE_FRONTEND/frontend/node_modules/.bin"
printf '#!/bin/sh\necho "oxlint panicked: config could not be loaded" >&2\nexit 2\n' > "$FAKE_FRONTEND/frontend/node_modules/.bin/oxlint"
chmod +x "$FAKE_FRONTEND/frontend/node_modules/.bin/oxlint"
CLAUDE_PROJECT_DIR="$FAKE_FRONTEND" expect "a broken oxlint warns the user without blocking" 1 $LINT \
  "$(payload Write "$FAKE_FRONTEND/frontend/src/Counter.jsx")" "oxlint hook could not run"

# --- lint-edited-file: skipped files
cp "$JS_ERROR" "$JS_OUTSIDE"
expect "skips non-code files"             0 $LINT "$(payload Edit "$PWD/README.md")"
expect "skips JS outside frontend/"       0 $LINT "$(payload Write "$PWD/$JS_OUTSIDE")"
expect "skips a file that doesn't exist"  0 $LINT "$(payload Write "$PWD/frontend/src/missing.jsx")"
expect "ignores malformed input"          0 $LINT "not json"

echo; echo "$pass passed, $fail failed"
[[ $fail -eq 0 ]]
