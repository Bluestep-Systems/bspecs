#!/bin/bash
# Block edits to platform-generated files.
# Enforces: rule R1 from CLAUDE.md.

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

if [[ "$FILE" == *"/declarations/"* ]] \
   || [[ "$FILE" == *"B.d.ts" ]] \
   || [[ "$FILE" == *"scriptlibrary.d.ts" ]] \
   || [[ "$FILE" == *"Globals.d.ts" ]]; then
  echo "BLOCKED: '$FILE' is platform-generated. Pull from the platform instead of editing manually: b6p pull \"<DAV URL>\"" >&2
  exit 2
fi

exit 0
