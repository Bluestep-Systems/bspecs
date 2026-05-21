#!/bin/bash
# Require b6p to be invoked through a login shell.
#
# Two valid shapes (depending on whether Claude runs in WSL or Windows):
#   1. inside WSL/Linux:  bash -lc 'b6p ...'
#   2. on Windows host:   wsl bash -lc 'b6p ...'
#
# Why -lc: b6p is installed under nvm (~/.nvm/...), and nvm only adds itself
# to PATH inside a login shell. Plain `b6p ...` or `wsl b6p ...` skips the
# login profile and fails with "command not found: b6p".
#
# Enforces: rule R14 from CLAUDE.md.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# No b6p in the command at all → nothing to enforce.
if [[ "$COMMAND" != *"b6p"* ]]; then
  exit 0
fi

# Accept either of the two valid shapes.
# Pattern: optional `wsl ` prefix, then `bash -lc ` followed by a quote.
if [[ "$COMMAND" =~ ^(wsl[[:space:]]+)?bash[[:space:]]+-lc[[:space:]]+[\'\"] ]]; then
  exit 0
fi

cat >&2 <<EOF
BLOCKED: b6p must be invoked through a login shell so nvm/PATH loads.

  Valid shapes (pick based on where Claude is running):
    Inside WSL:        bash -lc 'b6p pull "<DAV URL>"'
    From Windows host: wsl bash -lc 'b6p pull "<DAV URL>"'

  To detect which one to use, run \`uname -s\` first:
    Linux → use bash -lc
    anything else → use wsl bash -lc

  Plain \`b6p ...\` and \`wsl b6p ...\` both fail with "command not found"
  because they skip the login shell. See .claude/instructions/b6p-platform.md.
EOF
exit 2
