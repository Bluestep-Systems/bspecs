#!/bin/bash
# Session canary for the guardrail hooks (SessionStart, matcher "startup").
#
# Why: the hooks failed silently for 77 days because `jq` was missing — every call fell through
# to exit 0. They now fail CLOSED without a parser (lib/hook-input.sh), which is safe but turns a
# missing parser into "every Edit/Write/Bash is blocked" with the reason buried in per-call hook
# output. This runs the same parser detection once, at session start, and says so in one line
# where the person will see it. Silent when a parser is found: nothing on stdout (stdout of a
# SessionStart hook is added to the model's context, and this must cost nothing), exit 0.
#
# Second check (0.33.0): the project still carries the old 142-line AGENTS.md / CLAUDE.md from the
# pre-split template (recognised by its "## Critical rules (always apply)" heading). It works, but
# costs ~4 K tokens every turn for content the plugin now serves on demand, and nothing else tells
# the person a shorter file exists. One stderr line, once per session, gone as soon as they swap.
# The project dir is CLAUDE_PROJECT_DIR (set by Claude Code for hooks), falling back to $PWD.
#
# Exit 1, not 2: a SessionStart exit 2 is a blocking error. The canary only reports.

HOOK_NAME="canary"
HOOK_DETECT_ONLY=1
source "${BASH_SOURCE[0]%/*}/lib/hook-input.sh" || {
  echo "bluestep-tools: the guardrail hooks cannot load hooks/lib/hook-input.sh — every Edit, Write and Bash call in this session will be blocked until the plugin is reinstalled or updated." >&2
  exit 1
}

rc=0
if [ -z "$_hook_parser" ]; then
  echo "bluestep-tools: no JSON parser on PATH (looked for jq, python3, python, node). The guardrail hooks will BLOCK every Edit, Write and Bash call in this session until one is installed — jq is the smallest." >&2
  rc=1
fi

_proj="${CLAUDE_PROJECT_DIR:-$PWD}"
for _f in "$_proj/AGENTS.md" "$_proj/CLAUDE.md"; do
  if [ -f "$_f" ] && grep -q '^## Critical rules (always apply)' "$_f" 2>/dev/null; then
    echo "bluestep-tools: this project's ${_f##*/} is the old 142-line rules file (~4 K tokens every turn). Run /project-init once to swap it for the short one; it keeps your project-specific lines." >&2
    rc=1
    break
  fi
done

exit $rc
