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
# Exit 1, not 2: a SessionStart exit 2 is a blocking error. The canary only reports.

HOOK_NAME="canary"
HOOK_DETECT_ONLY=1
source "${BASH_SOURCE[0]%/*}/lib/hook-input.sh" || {
  echo "bluestep-tools: the guardrail hooks cannot load hooks/lib/hook-input.sh — every Edit, Write and Bash call in this session will be blocked until the plugin is reinstalled or updated." >&2
  exit 1
}

if [ -z "$_hook_parser" ]; then
  echo "bluestep-tools: no JSON parser on PATH (looked for jq, python3, python, node). The guardrail hooks will BLOCK every Edit, Write and Bash call in this session until one is installed — jq is the smallest." >&2
  exit 1
fi

exit 0
