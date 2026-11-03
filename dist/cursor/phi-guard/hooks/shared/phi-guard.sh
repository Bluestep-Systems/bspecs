#!/bin/bash
# Block writes that put client data (PHI) into a BlueStep project's files.
# Enforces: real client and contact data never goes into anything that gets committed —
# placeholders there, real data only in .claude/scratch/ (bluestep-reference →
# conventions/client-data.md).
#
# While debugging, agents copy real phone numbers, emails and record titles into docs, specs,
# comments and README examples, and from there they land in git history, where cleaning them up
# is expensive. This hook runs the shared detector (lib/phi-detect.sh) on the text an Edit or
# Write is about to put in a file and blocks with exit 2, so the agent rewrites it with
# placeholders. It never rewrites the text itself. The pre-commit hook /b6p-setup installs is the
# gate for everything this one cannot see (hand edits, other tools).
#
# This is the phi-guard plugin's one hook. Silent outside B6P projects: the project root must hold
# a U######/ unit folder or an AGENTS.md with the rules-template marker /b6p-setup writes (the text
# "bluestep-tools rules-template") — the same test /b6p-setup uses.

HOOK_NAME="phi-guard"
HOOK_DIR="${BASH_SOURCE[0]%/*}"
# ${BASH_SOURCE[0]%/*} rather than $(dirname ...): no external command, so this still works
# when PATH is empty. And a failed source is fatal — without the helper the checks below would
# all see an empty value, find nothing, and exit 0, which is the fail-open bug again.
source "$HOOK_DIR/lib/hook-input.sh" || {
  echo "BLOCKED: the BlueStep guardrail hook could not load its input helper ($HOOK_DIR/lib/hook-input.sh), so it cannot check this call. Reinstall or update the phi-guard plugin." >&2
  exit 2
}
hook_require_parse

# Above this size the text is a generated bundle or a data dump, not something an agent typed
# by hand: scanning it slows every such write, and it is the wrong layer to judge it. The
# pre-commit check still sees whatever of it gets committed.
MAX_BYTES=524288

ALLOW_NAME=".phi-allow"

# _norm <path> -> a form two paths can be compared in: forward slashes, lower case (Windows
# paths ignore case; on Linux this can only make us check more, never less), and one prefix for
# the same place seen from Windows and from WSL — C:/x and /mnt/c/x become /c/x, and
# //wsl.localhost/<distro>/x (or //wsl$/<distro>/x) becomes /x. No trailing slash.
# In Git Bash an absolute path first goes through `cygpath -m`: its /tmp, /usr and the like are
# mounts, so $PWD can read /tmp/x while Claude Code sends C:\Users\...\Temp\x for the same file.
_norm() {
  local p=$1
  case "$p" in
    /* | [A-Za-z]:*)
      if command -v cygpath >/dev/null 2>&1; then p=$(cygpath -m -- "$p" 2>/dev/null) || p=$1; fi ;;
  esac
  p=$(printf '%s' "$p" | tr '\\' '/' | tr '[:upper:]' '[:lower:]')
  case "$p" in
    //wsl.localhost/* | //wsl\$/*)
      p=${p#//*/}
      case "$p" in */*) p="/${p#*/}" ;; *) p="/" ;; esac ;;
    [a-z]:/* | [a-z]:) p="/${p%%:*}${p#?:}" ;;
    /mnt/[a-z]/* | /mnt/[a-z]) p=${p#/mnt} ;;
  esac
  case "$p" in
    //*) ;;  # some other UNC share: keep the leading double slash
    *) p=$(printf '%s' "$p" | sed 's#//*#/#g') ;;
  esac
  while [ "${#p}" -gt 1 ] && [ "${p%/}" != "$p" ]; do p=${p%/}; done
  printf '%s' "$p"
}

# The project root, with forward slashes for the file tests below (Git Bash reads C:/x and
# //wsl.localhost/x fine; a backslash path it does not always).
ROOT_RAW="${CLAUDE_PROJECT_DIR:-$PWD}"
ROOT=$(printf '%s' "$ROOT_RAW" | tr '\\' '/')

# Not a B6P project: stay out of the way.
is_b6p=""
for d in "$ROOT"/U[0-9][0-9][0-9][0-9][0-9][0-9]; do
  if [ -d "$d" ]; then is_b6p=1; break; fi
done
if [ -z "$is_b6p" ] && [ -f "$ROOT/AGENTS.md" ] && grep -q 'bluestep-tools rules-template' "$ROOT/AGENTS.md" 2>/dev/null; then
  is_b6p=1
fi
[ -n "$is_b6p" ] || exit 0

# file_path / path: Claude Code and Codex. target_file / relative_workspace_path: the names
# Cursor's agent tools have used (see block-generated-files.sh). Text: content (Write),
# new_string (Edit), new_source (NotebookEdit, which the Edit|Write matcher also catches; its
# path key is notebook_path), and for MultiEdit the new_string of each entry in edits — never an
# old_string, so an edit that takes client data OUT of a file is not blocked for the text it
# removes. The line numbers a MultiEdit block reports count through those new_strings in order.
FILE=$(hook_field_path file_path path target_file relative_workspace_path notebook_path)
TEXT=$(hook_field content new_string new_source)
[ -n "$TEXT" ] || TEXT=$(hook_field_items edits new_string)
[ -n "$TEXT" ] || exit 0

# Where the file is, relative to the project root. A relative path is taken as inside the root.
F=$(_norm "$FILE")
R=$(_norm "$ROOT")
case "$F" in
  /*)
    if [ "$R" = "/" ]; then
      REL=${F#/}
    else
      case "$F/" in
        "$R"/*) REL=${F#"$R"} ; REL=${REL#/} ;;
        *) exit 0 ;;  # outside the project: memory files, temp files — never committed from here
      esac
    fi ;;
  *) REL=$F ;;
esac
while [ "${REL#./}" != "$REL" ]; do REL=${REL#./}; done

# Paths that are allowed to hold anything: the scratch folder (git-ignored, for real data while
# debugging), platform-generated and build output, dependencies, lockfiles, and the allowlist.
case "/$REL" in
  */.claude/scratch/* | */declarations/* | */.build/* | */static/assets/* | */node_modules/*) exit 0 ;;
  */package-lock.json | */yarn.lock | */pnpm-lock.yaml) exit 0 ;;
esac
[ "$REL" = "$ALLOW_NAME" ] && exit 0

[ "${#TEXT}" -gt "$MAX_BYTES" ] && exit 0

DETECT="$HOOK_DIR/lib/phi-detect.sh"
if [ ! -f "$DETECT" ]; then
  echo "BLOCKED: the BlueStep client-data hook could not find its detector ($DETECT), so it cannot check this write. Reinstall or update the phi-guard plugin." >&2
  exit 2
fi

ALLOW_ARGS=()
[ -f "$ROOT/$ALLOW_NAME" ] && ALLOW_ARGS=(--allow "$ROOT/$ALLOW_NAME")

FOUND=$(printf '%s\n' "$TEXT" | sh "$DETECT" "${ALLOW_ARGS[@]}" 2>&1)
rc=$?
case "$rc" in
  0) exit 0 ;;
  1) ;;
  *)
    echo "BLOCKED: the BlueStep client-data detector failed (exit $rc), so this write could not be checked. Reinstall or update the phi-guard plugin. Detector said: ${FOUND:0:200}" >&2
    exit 2 ;;
esac

# Findings: "<line>\t<kind>\t<masked>" — the value is already cut to two characters, so the
# message never echoes the data back into the transcript.
{
  echo "BLOCKED: this write to '${FILE:-the file}' has what looks like real client data. Values are cut short on purpose:"
  n=0
  while IFS=$'\t' read -r line kind masked; do
    [ -n "$kind" ] || continue
    n=$((n+1))
    [ "$n" -le 10 ] && echo "  line $line: $kind $masked"
  done <<< "$FOUND"
  [ "$n" -gt 10 ] && echo "  ... and $((n-10)) more"
  echo "Project files get committed, so real client or contact data does not go in them. Instead:"
  echo "  - use placeholders: <client A>, a 555-01xx phone number, name@example.com"
  echo "  - keep real data you need for debugging in .claude/scratch/ (git-ignored, not checked)"
  echo "  - if this is test data that only looks real, add phi-ok to the line"
  echo "  - if it is a public number or domain (the org's own front desk), list it in $ALLOW_NAME at the project root (the number as is, or domain:<domain>)"
  echo "More: the bluestep-reference skill, conventions/client-data.md."
} >&2
exit 2
