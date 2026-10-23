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

# HOOK_DETECT_ONLY=1 (set by hooks/canary.sh before sourcing) runs the parser detection and
# nothing else: no stdin read, no block. The canary reports the result instead of enforcing it.
if [ -z "${HOOK_DETECT_ONLY:-}" ]; then
  HOOK_INPUT=$(cat)
fi

# Probe each parser by running it, not with `command -v`. On Windows, python3.exe and python.exe
# exist in WindowsApps as Microsoft Store app execution aliases even when no Python is installed:
# `command -v` finds them, running them prints "Python was not found" and exits non-zero, and a
# guardrail that picked one blocked every Edit and Write while a working node sat unused (#243).
_hook_parser=""
if jq -n 1 >/dev/null 2>&1; then _hook_parser=jq
elif python3 -c "import json" >/dev/null 2>&1; then _hook_parser=python3
elif python -c "import json" >/dev/null 2>&1; then _hook_parser=python
elif node -e 0 >/dev/null 2>&1; then _hook_parser=node
fi

# No parser at all: block, loudly, once, with the fix.
if [ -z "$_hook_parser" ] && [ -z "${HOOK_DETECT_ONLY:-}" ]; then
  echo "BLOCKED: the ${HOOK_NAME:-BlueStep} guardrail hook cannot read its input — none of jq, python3, python or node runs from PATH, so it cannot tell whether this call is safe. It blocks rather than allow an unchecked call. Install any one of them (jq is smallest) and retry, or disable the bluestep-tools hooks if you accept losing the guardrails." >&2
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

# A parser exists but the payload is not JSON with a tool_input object: also block. Same
# reasoning. This parses for real — a grep for the "tool_input" string let a truncated payload
# through (hook_field came back empty, nothing matched, exit 0: the fail-open shape again).
hook_require_parse() {
  case "$_hook_parser" in
    jq)
      printf '%s' "$HOOK_INPUT" | jq -e '.tool_input | type == "object"' >/dev/null 2>&1 && return 0
      ;;
    python3 | python)
      printf '%s' "$HOOK_INPUT" | "$_hook_parser" -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(1)
sys.exit(0 if isinstance(d, dict) and isinstance(d.get("tool_input"), dict) else 1)
' 2>/dev/null && return 0
      ;;
    node)
      printf '%s' "$HOOK_INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d).on("end", () => {
  let d;
  try { d = JSON.parse(s); } catch (e) { process.exit(1); }
  process.exit(d && typeof d === "object" && d.tool_input && typeof d.tool_input === "object" ? 0 : 1);
});
' 2>/dev/null && return 0
      ;;
  esac
  echo "BLOCKED: the ${HOOK_NAME:-BlueStep} guardrail hook received input it could not recognise, so it cannot tell whether this call is safe. It blocks rather than allow an unchecked call. Report this with the tool you were running." >&2
  exit 2
}
