#!/bin/sh
# bluestep-tools phi-guard 1
# Check what git is about to record for client data (PHI): phone numbers, emails, record titles.
#
# /b6p-setup copies this file, pre-commit, pre-push and phi-detect.sh into the project's
# scripts/hooks/ and points core.hooksPath there. The agent-side guardrail only sees what an
# agent writes; this is the gate for everything else (hand edits, other tools, pasted files).
# It reads only ADDED lines, so data that is already in history does not block every later
# commit — --all is how a project finds that.
#
# Usage:
#   phi-check.sh --staged        added lines of what is staged (git diff --cached); pre-commit
#   phi-check.sh --range <a>..<b>
#                                added lines between two commits (git diff a..b); pre-push
#   phi-check.sh --all           every tracked file as it is in the index, with a per-file count
#   --emit-lines                 with any of the above: print the added lines the check would read
#                                as "<file>:<line>: <text>" on stdout and exit 0, without checking
#                                them. pre-push feeds these to the optional model review. Lines with
#                                phi-ok or a .phi-allow literal are left out; .phi-allow * prints none.
#
# The rules live in phi-detect.sh, which must sit next to this file. A project allowlist is read
# from .phi-allow at the repo root (format: phi-detect.sh --help). A line containing phi-ok is
# never reported.
#
# Not checked (same list as the agent-side guardrail): .claude/scratch/, declarations/, .build/,
# static/assets/, node_modules/, lockfiles, .phi-allow itself, and binary files (git shows no
# lines for them). Also the phi-detect.sh next to this file, whose notes describe the shapes.
#
# Output: "<file>:<line> <kind> <masked value>", the value cut to two characters so the data
# never lands in terminal scrollback or a CI log.
# Exit: 0 clean, 1 findings or the check could not run (fails closed), 2 bad arguments.
#
# POSIX sh and POSIX awk only: git runs this under Git for Windows' sh, WSL and macOS.

mode=""
range=""
emit=""
while [ $# -gt 0 ]; do
  case "$1" in
    --staged | --all)
      mode=${1#--}; shift ;;
    --range)
      [ $# -ge 2 ] || { echo "phi-check: --range needs <a>..<b>" >&2; exit 2; }
      mode=range; range=$2; shift 2 ;;
    --emit-lines)
      emit=1; shift ;;
    -h | --help)
      sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "phi-check: unknown argument '$1' (use --staged, --range <a>..<b> or --all)" >&2
      exit 2 ;;
  esac
done
[ -n "$mode" ] || { echo "phi-check: say what to check: --staged, --range <a>..<b> or --all" >&2; exit 2; }

HERE=$(cd "$(dirname "$0")" && pwd)
DETECT="$HERE/phi-detect.sh"
if [ ! -f "$DETECT" ]; then
  echo "BLOCKED: the client-data check cannot run: $DETECT is missing. Re-run /b6p-setup to restore the project's scripts/hooks/ files." >&2
  exit 1
fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "BLOCKED: the client-data check cannot run: git rev-parse failed (not inside a git work tree?)." >&2
  exit 1
}
# The detector's own copy is never checked: its rule notes spell out the shapes it looks for
# (phone, email and record-title patterns), which it would report. Its path from the
# repo root, as git names it (scripts/hooks/phi-detect.sh once /b6p-setup installed it).
SELF=""
if [ "$(cd "$HERE" && git rev-parse --show-toplevel 2>/dev/null)" = "$ROOT" ]; then
  SELF=$(cd "$HERE" && git rev-parse --show-prefix)phi-detect.sh
fi
cd "$ROOT" || exit 1

ALLOW_NAME=".phi-allow"

# Scratch files. TMPDIR can point somewhere that does not exist (Git for Windows has handed a
# hook one), so fall back to /tmp, then to the repo's own git dir, before giving up.
T=$(mktemp -d 2>/dev/null) || T=$(mktemp -d /tmp/phi-check.XXXXXX 2>/dev/null) || {
  T="$(git rev-parse --absolute-git-dir 2>/dev/null)/phi-check.$$"
  mkdir "$T" 2>/dev/null || { echo "BLOCKED: the client-data check cannot run: no writable temp folder." >&2; exit 1; }
}
trap 'rm -rf "$T"' EXIT
trap 'exit 1' HUP INT TERM

# Fixed diff shape whatever the user's git config says: a/ b/ prefixes, no color, no external
# diff or textconv, file names unquoted unless they hold control characters or quotes.
DIFF="git -c core.quotepath=off diff -U0 --no-color --no-ext-diff --no-textconv --src-prefix=a/ --dst-prefix=b/"
case "$mode" in
  staged)
    $DIFF --cached -- > "$T/diff" 2> "$T/err" ;;
  range)
    $DIFF "$range" -- > "$T/diff" 2> "$T/err" ;;
  all)
    # Every file in the index as added lines: diff the index against the empty tree.
    EMPTY=$(git hash-object -t tree --stdin < /dev/null) &&
      $DIFF --no-renames --cached "$EMPTY" -- > "$T/diff" 2> "$T/err" ;;
esac
if [ $? -ne 0 ]; then
  echo "BLOCKED: the client-data check cannot run: git diff failed: $(head -n 3 "$T/err")" >&2
  exit 1
fi

# Turn the diff into two files: text (the added lines, which the detector reads) and map (line
# N of text came from "<file>\t<line>"). The new-file line number is the c in "@@ -a,b +c,d @@".
# Binary files carry no hunks, so they never reach text. Skip paths match lower-cased, like the
# guardrail's.
: > "$T/map"
PHI_MAP="$T/map" PHI_SELF="$SELF" LC_ALL=C awk '
function skip(p,   q) {
  q = "/" tolower(p)
  if (q ~ /\/\.claude\/scratch\// || q ~ /\/declarations\// || q ~ /\/\.build\//) return 1
  if (q ~ /\/static\/assets\// || q ~ /\/node_modules\//) return 1
  if (q ~ /\/(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/) return 1
  if (q == "/.phi-allow") return 1
  if (p == self) return 1
  return 0
}
BEGIN { map = ENVIRON["PHI_MAP"]; self = ENVIRON["PHI_SELF"]; inh = 0; keep = 0 }
/^diff --git / { inh = 0; keep = 0; next }
!inh && /^\+\+\+ / {
  p = substr($0, 5)
  sub(/\t$/, "", p)                                  # git adds a tab after names with spaces
  if (p == "/dev/null") { keep = 0; next }           # a deleted file
  if (substr(p, 1, 1) == "\"") { p = substr(p, 2); sub(/"$/, "", p) }
  if (substr(p, 1, 2) == "b/") p = substr(p, 3)
  path = p; keep = !skip(p); next
}
/^@@ / {
  inh = 1
  h = $0; sub(/^@@ -[0-9,]* \+/, "", h); sub(/[^0-9].*$/, "", h)
  ln = h + 0; next
}
inh && /^\+/ {
  if (keep) { print substr($0, 2); print path "\t" ln > map }
  ln++; next
}
inh && /^ / { ln++ }
END { close(map) }
' "$T/diff" > "$T/text"

# --emit-lines: the same added lines, skip list already applied, with their place in front.
# Allowlist literals and * are read the way phi-detect.sh reads them; domain: entries are not
# applied here (a line with an allowed address can still name a person).
if [ -n "$emit" ]; then
  [ -f "$ALLOW_NAME" ] && af=$ALLOW_NAME || af=""
  PHI_ALLOW_FILE=$af LC_ALL=C awk -F '\t' '
BEGIN {
  nlit = 0; f = ENVIRON["PHI_ALLOW_FILE"]
  if (f != "") {
    while ((getline ln < f) > 0) {
      sub(/\r$/, "", ln); sub(/^[ \t]+/, "", ln); sub(/[ \t]+$/, "", ln)
      if (ln == "" || substr(ln, 1, 1) == "#" || substr(ln, 1, 7) == "domain:") continue
      if (ln == "*") exit
      lit[++nlit] = ln
    }
    close(f)
  }
}
FILENAME == ARGV[1] { loc[FNR] = $1 ":" $2; next }
{
  w = $0; sub(/\r$/, "", w)
  if (index(w, "phi-ok")) next
  for (i = 1; i <= nlit; i++) if (index(w, lit[i])) next
  print loc[FNR] ": " w
}' "$T/map" "$T/text"
  exit 0
fi

if [ -f "$ALLOW_NAME" ]; then
  sh "$DETECT" --allow "$ALLOW_NAME" < "$T/text" > "$T/found" 2> "$T/err"
else
  sh "$DETECT" < "$T/text" > "$T/found" 2> "$T/err"
fi
rc=$?
case "$rc" in
  0)
    # --all always ends with a summary line, so a caller can tell a clean scan from one that
    # never ran.
    [ "$mode" = all ] && echo "phi-check: 0 finding(s) in 0 file(s)."
    exit 0 ;;
  1) ;;
  *)
    echo "BLOCKED: the client-data detector failed (exit $rc), so nothing was checked. Re-run /b6p-setup to restore scripts/hooks/. Detector said: $(head -n 3 "$T/err")" >&2
    exit 1 ;;
esac

# "<detector line>\t<kind>\t<masked>" -> "<file>:<line> <kind> <masked>"; --all adds the counts.
report() {
  LC_ALL=C awk -F '\t' -v mode="$mode" -v cap="$1" '
FILENAME == ARGV[1] { f[FNR] = $1; l[FNR] = $2; next }
$2 != "" {
  n++
  if (!(f[$1] in cnt)) order[++nf] = f[$1]
  cnt[f[$1]]++
  if (cap == 0 || n <= cap) print "  " f[$1] ":" l[$1] " " $2 " " $3
}
END {
  if (cap > 0 && n > cap) print "  ... and " (n - cap) " more"
  if (mode == "all") {
    print ""
    print "phi-check: " n " finding(s) in " nf " file(s):"
    for (i = 1; i <= nf; i++) printf "  %5d  %s\n", cnt[order[i]], order[i]
  }
}' "$T/map" "$T/found"
}

if [ "$mode" = all ]; then
  echo "phi-check --all: what looks like real client data in tracked files. Values are cut short on purpose:"
  report 0
  echo "To clean these up: the bluestep-reference skill, conventions/client-data.md."
  exit 1
fi

if [ "$mode" = staged ]; then what="this commit adds"; skip_cmd="git commit --no-verify"
else what="these commits add"; skip_cmd="git push --no-verify"; fi
{
  echo "BLOCKED: $what what looks like real client data. Values are cut short on purpose:"
  report 20
  echo "Committed files stay in git history, so real client or contact data does not go in them. Instead:"
  echo "  - use placeholders: <client A>, a 555-01xx phone number, name@example.com"
  echo "  - keep real data you need for debugging in .claude/scratch/ (git-ignored, not checked)"
  echo "  - if this is test data that only looks real, add phi-ok to the line"
  echo "  - if it is a public number or domain (the org's own front desk), list it in $ALLOW_NAME at the project root (the number as is, or domain:<domain>)"
  echo "  - $skip_cmd skips this check. Try the options above first, and never use it to get real data through."
  echo "More: the bluestep-reference skill, conventions/client-data.md."
} >&2
exit 1
