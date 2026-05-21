#!/bin/bash
# Require b6p to be invoked through a shell that loads the user's PATH
# (login shell -lc or interactive -ic), so nvm-installed binaries are found.
#
# Why this matters: b6p typically lives under ~/.nvm/.../bin/b6p. nvm only
# adds itself to PATH inside an interactive shell (loaded from .zshrc /
# .bashrc) or sometimes a login shell (.zprofile / .bash_profile). Plain
# `b6p ...` or `wsl b6p ...` skips both and fails with "command not found".
#
# The scaffolder probes the user's environment and writes the detected
# prefix to .claude/b6p-env.json. The /b6p-* skills read that file. This
# hook just enforces that whatever Claude actually runs uses one of the
# acceptable shapes.
#
# Accepted shapes:
#   <shell-binary> -lc '...b6p...'
#   <shell-binary> -ic '...b6p...'
#   wsl <shell-binary> -lc '...b6p...'
#   wsl <shell-binary> -ic '...b6p...'
#
# Where <shell-binary> is bash, zsh, sh, or fish (with an optional path
# prefix like /usr/bin/ or /bin/). Quote style after the flag can be ' or ".
#
# Enforces: rule R14 from CLAUDE.md.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# No b6p in the command at all → nothing to enforce.
if [[ "$COMMAND" != *"b6p"* ]]; then
  exit 0
fi

# Accept: optional 'wsl ', optional absolute path, shell binary name,
# either -lc or -ic flag, then a quote.
SHELL_RE='^(wsl[[:space:]]+)?(/[^[:space:]]+/)?(bash|zsh|sh|fish)[[:space:]]+-[li]c[[:space:]]+[\"'"'"']'

if [[ "$COMMAND" =~ $SHELL_RE ]]; then
  exit 0
fi

cat >&2 <<'EOF'
BLOCKED: b6p must be invoked through a shell that loads PATH (so nvm-installed
binaries like b6p are found).

  Valid shapes:
    <shell> -lc 'b6p ...'   (login shell; loads .zprofile / .bash_profile)
    <shell> -ic 'b6p ...'   (interactive; loads .zshrc / .bashrc — where nvm
                             usually lives)
    Prefix with `wsl ` if calling from Windows into WSL.

  The right prefix for THIS project is in .claude/b6p-env.json (field:
  shellPrefix). Read it and prepend it to your b6p call. If the file is
  missing, run /b6p-detect or auto-detect per the SKILL.md instructions.

  Plain `b6p ...` and `wsl b6p ...` both fail because they skip the user's
  shell startup files. See .claude/instructions/b6p-platform.md.
EOF
exit 2
