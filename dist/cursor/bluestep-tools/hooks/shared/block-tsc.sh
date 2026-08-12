#!/bin/bash
# Block local tsc execution.
# Enforces: rule R16 from CLAUDE.md (compilation is handled by the platform on push).

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [[ "$COMMAND" == tsc* ]] \
   || [[ "$COMMAND" == *" tsc "* ]] \
   || [[ "$COMMAND" == *" tsc" ]] \
   || [[ "$COMMAND" == *"npx tsc"* ]]; then
  echo "BLOCKED: do not run tsc locally. Compilation is handled by the BlueStep platform automatically on push." >&2
  exit 2
fi

exit 0
