@AGENTS.md

## Claude Code notes

- Project skills live in `.claude/skills/`: use `add-feature` to build a feature, `review-changes` before committing, and `fix-flaky-test` for intermittent failures.
- A hook that blocks an action (exit 2) is enforcing a rule from AGENTS.md. Fix the cause or ask the user; never work around it.
- The Read tool is denied `.env` and cookie files. Don't print them from the shell either; ask the user for any value you need from them.
