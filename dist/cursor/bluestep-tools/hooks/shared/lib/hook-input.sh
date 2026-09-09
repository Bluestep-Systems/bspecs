#!/bin/bash
# Shared input parsing for the guardrail hooks.
#
# Why this exists: the hooks used to parse stdin with `jq`. On a machine without jq the
# command failed, the variable came back empty, no condition matched, and the script fell
# through to `exit 0` — so the guardrail allowed everything, silently. That was the state on
# at least one machine for 30+ days across 16,441 hook invocations.
#
# Two rules follow from that:
#   1. Don't depend on one parser. Try jq, python3, python, then node.
#   2. Never fail open. If nothing can parse the input, BLOCK and say why. A guardrail that
#      can't read its input must not pretend the call is safe.
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/hook-input.sh"
#   FILE=$(hook_field file_path path)
#   CMD=$(hook_field command)

HOOK_INPUT=$(cat)

_hook_parser=""
for _c in jq python3 python node; do
  if command -v "$_c" >/dev/null 2>&1; then _hook_parser="$_c"; break; fi
done

# No parser at all: block, loudly, once, with the fix.
if [ -z "$_hook_parser" ]; then
  echo "BLOCKED: the ${HOOK_NAME:-BlueStep} guardrail hook cannot read its input — none of jq, python3, python or node is on PATH, so it cannot tell whether this call is safe. It blocks rather than allow an unchecked call. Install any one of them (jq is smallest) and retry, or disable the bluestep-tools hooks if you accept losing the guardrails." >&2
  exit 2
fi

# hook_field_path <key> [key...] -> same as hook_field, with backslashes turned into forward
# slashes so a single set of glob tests works on both platforms.
#
# This is not cosmetic. 97% of the file_path values Claude Code sends on this machine use
# backslashes (8,394 of 8,688 measured), and the path tests below are written with forward
# slashes. Without normalising, a Windows path never matches and the guardrail silently allows
# the edit — the same fail-open shape as the missing-jq bug.
#
# Normalising here rather than in bash is deliberate: `${VAR//\\//}` does not substitute
# reliably under MSYS/Git Bash, so the parser we already require does it instead.
hook_field_path() {
  hook_field "$@" | _hook_slashes
}

_hook_slashes() {
  case "$_hook_parser" in
    jq)                 jq -Rr 'gsub("\\\\"; "/")' 2>/dev/null ;;
    python3 | python)   "$_hook_parser" -c 'import sys; sys.stdout.write(sys.stdin.read().replace(chr(92), "/"))' 2>/dev/null ;;
    node)               node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(s.split("\\").join("/")))' 2>/dev/null ;;
  esac
}

# hook_field <key> [key...] -> first non-empty .tool_input.<key>, or empty.
hook_field() {
  case "$_hook_parser" in
    jq)
      local filter="" k
      for k in "$@"; do filter="${filter}.${k} // "; done
      printf '%s' "$HOOK_INPUT" | jq -r ".tool_input | (${filter}empty)" 2>/dev/null
      ;;
    python3 | python)
      printf '%s' "$HOOK_INPUT" | "$_hook_parser" -c '
import json, sys
try:
    d = json.load(sys.stdin).get("tool_input") or {}
except Exception:
    sys.exit(3)
for k in sys.argv[1:]:
    v = d.get(k)
    if v:
        sys.stdout.write(v if isinstance(v, str) else json.dumps(v))
        break
' "$@" 2>/dev/null
      ;;
    node)
      printf '%s' "$HOOK_INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d).on("end", () => {
  let t;
  try { t = (JSON.parse(s) || {}).tool_input || {}; } catch (e) { process.exit(3); }
  for (const k of process.argv.slice(1)) {
    if (t[k]) { process.stdout.write(typeof t[k] === "string" ? t[k] : JSON.stringify(t[k])); return; }
  }
});
' "$@" 2>/dev/null
      ;;
  esac
}

# A parser exists but choked on the payload: also block. Same reasoning.
hook_require_parse() {
  printf '%s' "$HOOK_INPUT" | grep -q '"tool_input"' && return 0
  echo "BLOCKED: the ${HOOK_NAME:-BlueStep} guardrail hook received input it could not recognise, so it cannot tell whether this call is safe. It blocks rather than allow an unchecked call. Report this with the tool you were running." >&2
  exit 2
}
