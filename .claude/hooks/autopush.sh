#!/usr/bin/env bash
#
# Daily checkpoint push, gated on the project's verification gates.
#
# Runs from a SessionEnd hook, so it only ever fires while the project is
# actually being worked on — "24 hours of active usage", not a wall-clock cron
# that would also fire on days nothing happened.
#
# It refuses to publish a broken tree: tsc, lint, test and build must all pass
# before anything is committed or pushed. If any gate fails the working tree is
# left exactly as it was and the reason is reported.
#
# Emits a single JSON object on stdout ({"systemMessage": "..."}) so the result
# is visible in the session rather than silently swallowed.

set -uo pipefail

REPO_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
INTERVAL_SECONDS=$(( 24 * 60 * 60 ))

cd "$REPO_DIR" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Lives inside .git, so it is never committed and never shows up in status.
STAMP="$(git rev-parse --git-dir)/claude-autopush-stamp"

say() {
  # Escape backslashes and quotes so the message is always valid JSON.
  printf '{"systemMessage": "%s"}\n' \
    "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"
}

now=$(date +%s)

# First ever run: start the clock, do nothing else. Without this the very first
# session would push immediately, which is surprising.
if [ ! -f "$STAMP" ]; then
  printf '%s\n' "$now" > "$STAMP"
  exit 0
fi

last=$(cat "$STAMP" 2>/dev/null || printf '0')
case "$last" in (*[!0-9]*|'') last=0 ;; esac
[ $(( now - last )) -lt "$INTERVAL_SECONDS" ] && exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
# Detached HEAD has no branch to push; leave it alone entirely.
[ "$branch" = "HEAD" ] || [ -z "$branch" ] && exit 0

upstream=$(git rev-parse --abbrev-ref "@{upstream}" 2>/dev/null)
if [ -z "$upstream" ]; then
  say "Daily checkpoint skipped: '$branch' has no upstream. Push it once manually to set one."
  printf '%s\n' "$now" > "$STAMP"
  exit 0
fi

dirty=$(git status --porcelain)
unpushed=$(git rev-list "$upstream".."$branch" --count 2>/dev/null || printf '0')

if [ -z "$dirty" ] && [ "$unpushed" = "0" ]; then
  # Nothing to do — reset the clock so it checks again tomorrow, not instantly.
  printf '%s\n' "$now" > "$STAMP"
  exit 0
fi

# --- Gates. Anything failing here aborts without touching the tree. --------
run_gate() {
  local name="$1"; shift
  if ! "$@" >/dev/null 2>&1; then
    say "Daily checkpoint SKIPPED — $name failed. Nothing was committed or pushed; the working tree is untouched. Run the gates yourself to see the failure."
    exit 0
  fi
}

run_gate "typecheck (tsc)" npx tsc --noEmit
run_gate "lint"            npm run lint
run_gate "tests"           npm run test
run_gate "build"           npm run build

# --- All green: commit anything outstanding, then push. -------------------
if [ -n "$dirty" ]; then
  git add -A || exit 0
  changed=$(git diff --cached --name-only | wc -l | tr -d ' ')
  git commit -q -m "chore: daily checkpoint ($(date +%Y-%m-%d), ${changed} files)" \
    -m "Automated end-of-session checkpoint. All verification gates passed
(tsc, lint, test, build) before this was created.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" || exit 0
fi

if git push -q origin "$branch" 2>/dev/null; then
  printf '%s\n' "$now" > "$STAMP"
  say "Daily checkpoint pushed to origin/$branch — all gates green."
else
  say "Daily checkpoint: gates passed and work is committed locally, but the push to origin/$branch failed (offline, or the remote has moved on). Push manually when you can."
fi
