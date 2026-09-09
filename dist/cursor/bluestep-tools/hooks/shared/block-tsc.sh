#!/bin/bash
# Block local tsc execution.
# Enforces: Critical rule 3 — never run tsc locally. The b6p CLI's transpile during a publish
# push is the only build; a hand-run tsc has no declarations wired up, so it produces stray .js
# files and errors that don't reflect what the platform will do.
#
# Scope note: this hook is deliberately a blunt string match. It is correct only where the
# plugin is enabled, which is meant to be BlueStep component workspaces. In a plain TypeScript
# repo — b6p-core, b6p-cli, bspecs — running tsc is normal and this hook has no business there.
# Keep bluestep-tools off in those repos rather than teaching this hook about paths.

HOOK_NAME="block-tsc"
# ${BASH_SOURCE[0]%/*} rather than $(dirname ...): no external command, so this still works
# when PATH is empty. And a failed source is fatal — without the helper the checks below would
# all see an empty value, match nothing, and exit 0, which is the fail-open bug again.
source "${BASH_SOURCE[0]%/*}/lib/hook-input.sh" || {
  echo "BLOCKED: the BlueStep guardrail hook could not load its input helper (${BASH_SOURCE[0]%/*}/lib/hook-input.sh), so it cannot check this call. Reinstall or update the bluestep-tools plugin." >&2
  exit 2
}
hook_require_parse

COMMAND=$(hook_field command)

if [[ "$COMMAND" == tsc* ]] \
   || [[ "$COMMAND" == *" tsc "* ]] \
   || [[ "$COMMAND" == *" tsc" ]] \
   || [[ "$COMMAND" == *"npx tsc"* ]]; then
  echo "BLOCKED: do not run tsc locally. The b6p CLI runs the only build (its own transpile) during a publish push; a hand-run tsc has no declarations wired up and produces stray .js files and misleading errors. To check types, push a draft and read what the platform reports." >&2
  exit 2
fi

exit 0
