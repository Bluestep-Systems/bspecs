#!/bin/sh
# bluestep-tools phi-guard 1
# Find client data (PHI) in text: phone numbers, email addresses, record titles.
#
# Why this exists: while debugging, agents copy real client and contact data into docs, spec
# files, comments and README examples, and from there it lands in git history. Cleaning that up
# once took redacting dozens of files, republishing components and recreating a repo. This is the
# one detector behind every layer that tries to stop it: the write-time guardrail (phi-guard.sh),
# and the pre-commit / pre-push hooks that /b6p-setup copies into a project. One copy of the
# rules, so the layers never disagree.
#
# It has to run wherever git hooks and agent hooks run — Git Bash on Windows, WSL, macOS with
# bash 3.2 and BSD awk — so it is POSIX sh plus POSIX awk: no gawk extensions, no regex interval
# counts like {3} (some awks don't support them), no grep -P, no jq.
#
# Usage:
#   phi-detect.sh [--allow <file>] [--domains <list>] < text
#
#   --allow <file>    project allowlist, one entry per line, '#' starts a comment line:
#                       <literal>      this exact text is fine anywhere (a public support number)
#                       domain:<d>     emails at <d> (and its subdomains) are fine
#                       *              the whole check is off for this project
#                     A missing file is the same as an empty one.
#   --domains <list>  more allowed email domains, comma- or space-separated.
#
# Output: one line per finding, "<line number>\t<kind>\t<masked value>", where kind is phone,
# email or record-title and the value is cut to its first two characters plus "…" — so a block
# message never echoes the data back into a transcript or terminal scrollback.
# Exit: 0 nothing found, 1 findings, 2 bad arguments.
#
# What counts (and what doesn't):
#   phone         US-style numbers WITH separators or parentheses: (NXX) NXX-XXXX, NXX-NXX-XXXX,  phi-ok
#                 NXX.NXX.XXXX, +1 NXX NXX XXXX (N = 2-9). A bare digit run never counts, so
#                 record ids, timestamps and long numbers stay out. Allowed: exchange 555 (the
#                 placeholder range) and toll-free area codes 800/833/844/855/866/877/888.
#   email         local@domain.tld outside the allowed domains: example.com/.org/.net, any .test,  phi-ok
#                 .invalid, .example or .localhost name, bluestep.net, plus --domains and
#                 domain: entries. Not counted: image names like logo@2x.png and git@ remotes.
#   record-title  "(XX) Last, First" — 2-3 capitals in parentheses, then "Word, Word".  phi-ok
#   A line containing phi-ok is skipped (for test data that only looks real).

allow_file=""
domains=""
while [ $# -gt 0 ]; do
  case "$1" in
    --allow)
      [ $# -ge 2 ] || { echo "phi-detect: --allow needs a file" >&2; exit 2; }
      allow_file=$2; shift 2 ;;
    --domains)
      [ $# -ge 2 ] || { echo "phi-detect: --domains needs a list" >&2; exit 2; }
      domains=$2; shift 2 ;;
    -h | --help)
      sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "phi-detect: unknown argument '$1' (use --allow <file> or --domains <list>)" >&2
      exit 2 ;;
  esac
done

# Paths and lists go in through the environment, not awk -v: -v treats backslashes as escapes,
# which mangles a Windows path. LC_ALL=C makes [A-Z] mean A to Z in every awk and locale.
PHI_ALLOW_FILE=$allow_file PHI_DOMAINS=$domains LC_ALL=C awk '
BEGIN {
  # Allowed email domains (suffix match: sub.example.com counts) and top-level names.
  nd = split("example.com example.org example.net bluestep.net", dom, " ")
  extra = ENVIRON["PHI_DOMAINS"]
  gsub(/,/, " ", extra)
  ne = split(extra, tmp, " ")
  for (i = 1; i <= ne; i++) dom[++nd] = tolower(tmp[i])
  split("test invalid example localhost", t, " ")
  for (i in t) tld_ok[t[i]] = 1
  split("png jpg jpeg gif svg webp", t, " ")
  for (i in t) img_ext[t[i]] = 1

  # The project allowlist.
  nlit = 0; off = 0
  f = ENVIRON["PHI_ALLOW_FILE"]
  if (f != "") {
    while ((getline ln < f) > 0) {
      sub(/\r$/, "", ln)
      sub(/^[ \t]+/, "", ln); sub(/[ \t]+$/, "", ln)
      if (ln == "" || substr(ln, 1, 1) == "#") continue
      if (ln == "*") { off = 1; continue }
      if (substr(ln, 1, 7) == "domain:") {
        d = substr(ln, 8); sub(/^[ \t]+/, "", d)
        if (d != "") dom[++nd] = tolower(d)
        continue
      }
      lit[++nlit] = ln
    }
    close(f)
  }

  # Patterns, built from pieces because there are no {n} counts. N = 2-9, D = any digit.
  D = "[0-9]"; N = "[2-9]"
  NXX = N D D; XXXX = D D D D; S = "[-. ]"
  re_plus  = "\\+1" S "?" NXX S NXX S XXXX
  re_plusp = "\\+1" S "?\\(" NXX "\\)" S "?" NXX S XXXX
  re_paren = "\\(" NXX "\\) ?" NXX S XXXX
  re_dash  = NXX "-" NXX "-" XXXX
  re_dot   = NXX "\\." NXX "\\." XXXX
  re_email = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z][A-Za-z]+"
  re_title = "\\([A-Z][A-Z][A-Z]?\\) ?[A-Z][A-Za-z\047-]+, ?[A-Z][A-Za-z\047-]+"

  found = 0
}

function mask(v) { return substr(v, 1, 2) "\342\200\246" }   # "…" as UTF-8 bytes

function report(kind, v) {
  printf "%d\t%s\t%s\n", NR, kind, mask(v)
  found = 1
}

# Replace w[st .. st+len-1] with spaces, so a value is reported once and the next pattern
# does not see it again.
function blank(st, len,   pad) {
  pad = sprintf("%" len "s", "")
  w = substr(w, 1, st - 1) pad substr(w, st + len)
}

# The character at position i of w, or "" off either end. Not substr(w, 0, 1): gawk returns
# the first character for that.
function ch(i) { return i < 1 ? "" : substr(w, i, 1) }

function is_alnum(c) { return c ~ /[A-Za-z0-9_]/ }
function is_digit(c) { return c ~ /[0-9]/ }

# A phone match only counts when it is not part of a longer number: no letter or digit
# right before or after it, and no ".5" / "-5" running on (a dotted version, a longer id).
# One exception on the left: a lone country code, as in 1-NXX-NXX-XXXX.
function phone_bounded(st, len,   p1, p2, p3, n1, n2) {
  p1 = ch(st - 1); p2 = ch(st - 2); p3 = ch(st - 3)
  n1 = ch(st + len); n2 = ch(st + len + 1)
  if (is_alnum(p1)) return 0
  if ((p1 == "-" || p1 == ".") && is_digit(p2)) {
    if (p2 != "1" || is_alnum(p3)) return 0
  }
  if (is_digit(n1)) return 0
  if ((n1 == "-" || n1 == ".") && is_digit(n2)) return 0
  return 1
}

function phone_allowed(v,   d) {
  d = v; gsub(/[^0-9]/, "", d)
  if (length(d) == 11) d = substr(d, 2)
  if (substr(d, 4, 3) == "555") return 1
  if (substr(d, 1, 3) ~ /^8(00|33|44|55|66|77|88)$/) return 1
  return 0
}

function email_allowed(v,   at, local, d, n, parts, i) {
  at = index(v, "@")
  local = substr(v, 1, at - 1)
  d = tolower(substr(v, at + 1))
  if (local == "git") return 1                       # git@host:org/repo remotes
  n = split(d, parts, ".")
  if (parts[n] in tld_ok) return 1
  if (parts[n] in img_ext) return 1                  # logo@2x.png
  for (i = 1; i <= nd; i++) {
    if (d == dom[i]) return 1
    if (length(d) > length(dom[i]) + 1 && substr(d, length(d) - length(dom[i])) == "." dom[i]) return 1
  }
  return 0
}

# Find every match of re in w, left to right. kind decides the boundary and allow checks.
function scan(re, kind,   from, rest, st, len, v, ok) {
  from = 1
  while (from <= length(w)) {
    rest = substr(w, from)
    if (!match(rest, re)) break
    st = from + RSTART - 1; len = RLENGTH
    v = substr(w, st, len)
    ok = 1
    if (kind == "phone") ok = phone_bounded(st, len)
    if (!ok) { from = st + 1; continue }             # try again one character on
    if (kind == "phone" && !phone_allowed(v)) report(kind, v)
    else if (kind == "email" && !email_allowed(v)) report(kind, v)
    else if (kind == "record-title") report(kind, v)
    blank(st, len)
    from = st + len
  }
}

{
  if (off) next
  w = $0
  sub(/\r$/, "", w)                                  # CRLF files
  if (index(w, "phi-ok")) next
  for (i = 1; i <= nlit; i++) {                      # allowlist literals: plain text, not regex
    while ((p = index(w, lit[i])) > 0) blank(p, length(lit[i]))
  }
  scan(re_email, "email")
  scan(re_title, "record-title")
  scan(re_plusp, "phone")
  scan(re_plus,  "phone")
  scan(re_paren, "phone")
  scan(re_dash,  "phone")
  scan(re_dot,   "phone")
}

END { exit found ? 1 : 0 }
'
