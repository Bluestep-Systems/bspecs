#!/bin/bash
# Ask before a browser script changes data on a BlueStep org.
# Enforces: reference/gql-in-a-tab.md, "Writes" — a GraphQL mutation from a signed-in tab needs the
# user's yes.
#
# GraphQL that an org no longer serves through the gateway runs as a POST to /gql from a browser
# tab (javascript_tool, or a browser_batch item that runs one). /b6p-setup allows the browser tools
# so a read does not stop on a permission prompt; this hook is what keeps a write from going
# through unasked. A script with no GraphQL mutation goes on. A script with one is put to the user.
# The hook cannot see which org the tab is signed in to, so it never decides a write is fine.
#
# It reads the script's text, so a mutation built at run time is not seen: it is a safety net,
# which is why gql-in-a-tab.md says to write every mutation out in full. In auto mode Claude Code
# may answer the ask without showing it.

HOOK_NAME="tab-guard"
# A failed source is fatal, as in block-generated-files.sh: without the helper nothing below runs.
source "${BASH_SOURCE[0]%/*}/lib/hook-input.sh" || {
  echo "BLOCKED: the BlueStep guardrail hook could not load its input helper (${BASH_SOURCE[0]%/*}/lib/hook-input.sh), so it cannot check this call. Reinstall or update the bluestep-tools plugin." >&2
  exit 2
}
hook_require_parse

# Match on the raw payload rather than one field: a browser_batch nests its scripts in an actions
# array, and the payload is JSON, so a newline in the script arrives as the two characters \n.
# Those count as space here. A match anywhere asks; a stray match only costs one question.
WS='([[:space:]]|\\[nrt])'
MUTATION="(^|[^A-Za-z0-9_\$])mutation(${WS}+[A-Za-z_][A-Za-z0-9_]*)?${WS}*[({]"

printf '%s' "$HOOK_INPUT" | grep -Eq "$MUTATION"
case $? in
  1) exit 0 ;; # no mutation: reads and page checks go on
esac

# The one-tools plugin's tab-guard mod shows its own card first. When the user presses Proceed
# there, it leaves a ticket for this exact call: a file named by the call's tool_use_id, in
# one-tools-tab-guard/ under the system temp folder, fresh for two minutes. one-tools' own hook
# checks what the ticket holds; this one only needs to know the user already said yes to this
# call, so it goes on when a fresh ticket by that name exists and asks otherwise. Without this,
# Proceed was followed by this hook's prompt for the same call. Keep the folder name and the age
# in step with one-tools (hooks/lib/tab-script.mjs).
# Only the real top-level key counts: inside the script's text a quote arrives escaped (\").
ids=$(printf '%s' "$HOOK_INPUT" | grep -Eo '"tool_use_id"[[:space:]]*:[[:space:]]*"[A-Za-z0-9_-]+"' | sed -E 's/.*"([A-Za-z0-9_-]+)"$/\1/' | sort -u)
if [ -n "$ids" ] && [ "$(printf '%s\n' "$ids" | wc -l)" -eq 1 ]; then
  for dir in "$TMPDIR" "$TEMP" "$TMP" /tmp; do
    [ -n "$dir" ] || continue
    command -v cygpath >/dev/null 2>&1 && dir=$(cygpath -u "$dir")
    ticket="${dir%/}/one-tools-tab-guard/$ids"
    if [ -f "$ticket" ] && [ -n "$(find "$ticket" -mmin -2 2>/dev/null)" ]; then
      exit 0
    fi
  done
fi

# A mutation, or grep could not run: ask. Plain words, no org or tool names (the user need not
# know them); the script itself shows under the prompt.
printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"This script would change data in BlueStep. Allow it only if you want Claude to make this change."}}'
exit 0
