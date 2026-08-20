#!/bin/bash
# Block local tsc execution.
# Enforces: Critical rule 3 from the scaffolded AGENTS.md (never run tsc locally — the b6p CLI's
# transpile during a publish push is the only build; the platform never compiles).

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [[ "$COMMAND" == tsc* ]] \
   || [[ "$COMMAND" == *" tsc "* ]] \
   || [[ "$COMMAND" == *" tsc" ]] \
   || [[ "$COMMAND" == *"npx tsc"* ]]; then
  echo "BLOCKED: do not run tsc locally. The b6p CLI runs the only build (its own transpile) during a publish push; a hand-run tsc has no declarations wired up and produces stray .js files and misleading errors." >&2
  exit 2
fi

exit 0
