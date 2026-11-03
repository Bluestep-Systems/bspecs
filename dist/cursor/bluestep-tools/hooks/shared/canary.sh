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
#
# Second job (0.37.0): one line on stdout — which a SessionStart hook adds to the model's context —
# when the folder holds BlueStep components (a U######/ unit folder) but no rules file at all — no
# AGENTS.md and no CLAUDE.md with content — so the model offers /b6p-setup before the person asks.
# Finite per project: it stops the moment setup runs, and a populated CLAUDE.md the user chose to
# keep also silences it (the rules load through it on Claude Code, the only tool that runs this hook).
# Silent for folders without a unit folder and for an old-template AGENTS.md (that case is the daily
# skills' preflight, at the moment the old file costs something).

HOOK_NAME="canary"
HOOK_DETECT_ONLY=1
source "${BASH_SOURCE[0]%/*}/lib/hook-input.sh" || {
  echo "bluestep-tools: the guardrail hooks cannot load hooks/lib/hook-input.sh — every Edit and Write call in this session will be blocked until the plugin is reinstalled or updated." >&2
  exit 1
}

if [ -z "$_hook_parser" ]; then
  echo "bluestep-tools: no working JSON parser on PATH (tried running jq, python3, python, node; on Windows a python.exe that is only a Microsoft Store alias does not count). The guardrail hooks will BLOCK every Edit and Write call in this session until one is installed — jq is the smallest." >&2
  exit 1
fi

if ls -d U[0-9][0-9][0-9][0-9][0-9][0-9]/ >/dev/null 2>&1 && [ ! -f AGENTS.md ] && [ ! -s CLAUDE.md ]; then
  echo "bluestep-tools: this folder holds BlueStep components (a U######/ unit folder) but no AGENTS.md or CLAUDE.md rules file, so the always-on platform rules are not loaded. Before anything else, tell the user in one line and offer to run /b6p-setup; wait for their answer."
fi

# Third job (0.42.0): phi-guard left this plugin for its own. A project that runs the git
# client-data check (scripts/hooks/phi-check.sh, copied by /b6p-setup) and has not switched it off
# (a `*` line in .phi-allow, read the way the detector reads it: CR and edge blanks trimmed) loses
# the write-time check on update unless phi-guard is installed. The sibling test only means
# something in the marketplace cache layout ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/,
# so it runs only when the plugin root sits there (backslashes normalised for Windows); a dev
# install from a checkout prints nothing. This is the one place a hook looks past its own plugin
# root (the ADR tooling-repo-consolidation.md names the exception): it tests whether the sibling
# cache folder exists and reads nothing in it. A phi-guard that reached the machine by another
# path than that cache (an account-synced install) is not seen here, and the line prints anyway;
# the line says so, so the user can answer "it is installed" once and move on.
# Only in a project that already runs the git check: a project that never ran /b6p-setup since
# 0.41.0 gets no line (nothing here tells the two apart from a project with no client data).
_root="${CLAUDE_PLUGIN_ROOT//\\//}"
_root="${_root%/}"
case "$_root" in
  */plugins/cache/*/*/*)
    if [ -f scripts/hooks/phi-check.sh ] \
      && ! grep -qE '^[[:space:]]*\*[[:space:]]*$' .phi-allow 2>/dev/null \
      && [ ! -d "$_root/../../phi-guard" ]; then
      echo "bluestep-tools: this project runs the git client-data check, but the write-time check now comes from the phi-guard plugin, which is not in this machine's plugin cache — \`claude plugin install phi-guard@bluestep --scope user\` (desktop app: Customize → Plugins → phi-guard), or add \`*\` to \`.phi-allow\` if this project has no client data. If phi-guard is installed another way, tell the user once and move on."
    fi
    ;;
esac

exit 0
