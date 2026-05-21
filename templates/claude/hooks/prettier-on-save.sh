#!/bin/bash
# Auto-format TypeScript files after edit.
# Enforces: rule R15 from CLAUDE.md.

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE" == *.ts ]]; then
  if ! command -v prettier >/dev/null 2>&1; then
    echo "prettier-on-save: prettier not found on PATH. Install with: npm i -g prettier" >&2
    exit 0
  fi
  prettier --write \
    --print-width 120 \
    --tab-width 2 \
    --trailing-comma es5 \
    --semi \
    "$FILE" >&2
fi

exit 0
