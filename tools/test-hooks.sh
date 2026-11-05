#!/bin/bash
# Test the guardrail hooks of every plugin under plugins/ (bluestep-tools and phi-guard), the
# phi-guard git hooks /b6p-setup copies into projects, and the generated Cursor wrappers.
# Uses python to build the JSON so backslash payloads survive the shell.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H="$ROOT/plugins/bluestep-tools/hooks"   # block-generated-files, tab-guard, canary
PG="$ROOT/plugins/phi-guard/hooks"       # phi-guard and its detector
PCA="$ROOT/plugins/bluestep-tools/skills/b6p-setup/assets/phi-guard"   # the project copy
pass=0; fail=0

# python3 on Linux/WSL, python on Windows Git Bash — the harness must run in both.
PY=$(command -v python3 || command -v python) || { echo "test-hooks: need python3 or python to build test payloads" >&2; exit 1; }
j() { "$PY" -c 'import json,sys; print(json.dumps({"tool_input":{sys.argv[1]:sys.argv[2]}}))' "$1" "$2"; }

t() { # name script key value expected_exit
  local out rc
  out=$(j "$3" "$4" | bash "$H/$2" 2>&1); rc=$?
  if [ "$rc" = "$5" ]; then
    echo "  PASS  $1"; pass=$((pass+1))
  else
    echo "  FAIL  $1 — expected exit $5, got $rc"; echo "        ${out:0:100}"; fail=$((fail+1))
  fi
}

echo "=== block-generated-files.sh ==="
t "blocks declarations/ (forward slashes)" block-generated-files.sh file_path '/x/U129161/Comp/declarations/index.d.ts' 2
t "blocks declarations\\ (BACKSLASHES - 97% of real input)" block-generated-files.sh file_path 'C:\Users\f\code\news-and-ads\U141260\Get News\declarations\index.d.ts' 2
t "blocks UNC wsl path with backslashes" block-generated-files.sh file_path '\\wsl.localhost\ubuntu\home\f\Proj\U129161\C\declarations\index.d.ts' 2
t "blocks B.d.ts" block-generated-files.sh file_path 'C:\x\B.d.ts' 2
t "blocks scriptlibrary.d.ts" block-generated-files.sh file_path '/x/scriptlibrary.d.ts' 2
t "blocks Globals.d.ts" block-generated-files.sh file_path '/x/Globals.d.ts' 2
t "blocks declarations/ relative to the workspace root" block-generated-files.sh file_path 'declarations/index.d.ts' 2
t "blocks declarations/ via target_file (Cursor key)" block-generated-files.sh target_file 'src/declarations/Foo.d.ts' 2
t "blocks declarations/ via relative_workspace_path (Cursor key)" block-generated-files.sh relative_workspace_path 'declarations/Foo.d.ts' 2
t "allows app.ts (backslashes)" block-generated-files.sh file_path 'C:\x\U129161\Comp\draft\scripts\app.ts' 0
t "allows README" block-generated-files.sh file_path '/x/draft/README.md' 0
t "allows a path with 'declarations' as a filename part" block-generated-files.sh file_path '/x/draft/scripts/declarations-helper.ts' 0

echo "=== fail closed ==="
out=$(printf '%s' 'not json at all' | bash "$H/block-generated-files.sh" 2>&1); rc=$?
if [ "$rc" = 2 ]; then echo "  PASS  unparseable input blocks"; pass=$((pass+1));
else echo "  FAIL  unparseable input gave exit $rc"; fail=$((fail+1)); fi
out=$(printf '%s' '{"tool_name":"Write","tool_input":{"file_path":"src/app.ts"' | bash "$H/block-generated-files.sh" 2>&1); rc=$?
if [ "$rc" = 2 ]; then echo "  PASS  truncated JSON that still contains \"tool_input\" blocks"; pass=$((pass+1));
else echo "  FAIL  truncated JSON gave exit $rc"; fail=$((fail+1)); fi
out=$(printf '%s' '{"tool_name":"Write","tool_input":"not an object"}' | bash "$H/block-generated-files.sh" 2>&1); rc=$?
if [ "$rc" = 2 ]; then echo "  PASS  tool_input that is not an object blocks"; pass=$((pass+1));
else echo "  FAIL  non-object tool_input gave exit $rc"; fail=$((fail+1)); fi

# no parser on PATH: keep bash reachable by absolute path, empty the rest
BASH_BIN=$(command -v bash)
TMPD=$(mktemp -d)
out=$(j file_path '/x/U1/C/declarations/index.d.ts' | env -i PATH="$TMPD" "$BASH_BIN" "$H/block-generated-files.sh" 2>&1); rc=$?
if [ "$rc" = 2 ]; then
  echo "  PASS  no parser on PATH blocks (exit 2)"; pass=$((pass+1))
  echo "        ${out:0:95}..."
else
  echo "  FAIL  no parser gave exit $rc (want 2)"; echo "        ${out:0:120}"; fail=$((fail+1))
fi
rmdir "$TMPD" 2>/dev/null

# Windows Store aliases (#243): python3/python are on PATH but only print "Python was not found"
# and exit non-zero. Detection must skip them and land on the working node, not pick a dead one.
# The stubs go in front of the real tool folder rather than into an `env -i` PATH of symlinks:
# Git Bash copies on `ln -s`, and a copied cat.exe cannot find msys-2.0.dll.
TOOLD=$(dirname "$BASH_BIN")
NODE_BIN=$(command -v node)
STUBD=$(mktemp -d)
for s in jq python3 python; do printf '#!/bin/sh\necho "Python was not found" >&2\nexit 9\n' > "$STUBD/$s"; chmod +x "$STUBD/$s"; done
# The no-node cases need a tool folder without node. Git Bash's /usr/bin has none; on Linux,
# where /usr/bin may hold node, a folder with a symlinked cat (the one tool the hook needs) does.
NONODE="$TOOLD"
if [ -x "$TOOLD/node" ] || [ -x "$TOOLD/node.exe" ]; then
  NONODE=$(mktemp -d); ln -s "$(command -v cat)" "$NONODE/cat"
fi
if [ -x "$NONODE/node" ] || [ -x "$NONODE/node.exe" ]; then
  echo "  SKIP  only dead aliases, no node (could not build a folder without node)"
else
  out=$(printf '{"hook_event_name":"SessionStart","source":"startup"}' | PATH="$STUBD:$NONODE" "$BASH_BIN" "$H/canary.sh" 2>&1); rc=$?
  if [ "$rc" = 1 ]; then echo "  PASS  only dead aliases, no node: canary reports no working parser (exit 1)"; pass=$((pass+1));
  else echo "  FAIL  only dead aliases, no node: canary gave exit $rc (want 1): ${out:0:100}"; fail=$((fail+1)); fi
  out=$(j file_path 'C:\x\draft\app.ts' | PATH="$STUBD:$NONODE" "$BASH_BIN" "$H/block-generated-files.sh" 2>&1); rc=$?
  if [ "$rc" = 2 ] && [[ "$out" == *"App execution aliases"* ]]; then echo "  PASS  only dead aliases, no node: blocks and names the alias workaround"; pass=$((pass+1));
  else echo "  FAIL  only dead aliases, no node: expected the no-parser block, got $rc: ${out:0:100}"; fail=$((fail+1)); fi
fi
if [ -n "$NODE_BIN" ]; then
  SP="$STUBD:$TOOLD:$(dirname "$NODE_BIN")"
  out=$(j file_path 'C:\x\U1\C\declarations\index.d.ts' | PATH="$SP" "$BASH_BIN" "$H/block-generated-files.sh" 2>&1); rc=$?
  if [ "$rc" = 2 ] && [[ "$out" == *declarations* ]]; then echo "  PASS  dead aliases + node: falls through to node, still blocks declarations"; pass=$((pass+1));
  else echo "  FAIL  dead aliases + node: expected the declarations block (exit 2), got $rc: ${out:0:100}"; fail=$((fail+1)); fi
  out=$(j file_path 'C:\x\draft\app.ts' | PATH="$SP" "$BASH_BIN" "$H/block-generated-files.sh" 2>&1); rc=$?
  if [ "$rc" = 0 ]; then echo "  PASS  dead aliases + node: app.ts allowed via node"; pass=$((pass+1));
  else echo "  FAIL  dead aliases + node: app.ts gave exit $rc: ${out:0:100}"; fail=$((fail+1)); fi
  out=$(printf '{"hook_event_name":"SessionStart","source":"startup"}' | PATH="$SP" "$BASH_BIN" "$H/canary.sh" 2>&1); rc=$?
  if [ "$rc" = 0 ] && [ -z "$out" ]; then echo "  PASS  dead aliases + node: canary finds node, silent"; pass=$((pass+1));
  else echo "  FAIL  dead aliases + node: canary gave exit $rc: ${out:0:100}"; fail=$((fail+1)); fi
else
  echo "  SKIP  dead aliases + node (no node on PATH)"
fi
[ "$NONODE" != "$TOOLD" ] && rm -rf "$NONODE"
rm -rf "$STUBD"

echo "=== tab-guard.sh ==="
# Payloads as Claude Code sends them: javascript_tool's text, or browser_batch actions.
js() { "$PY" -c 'import json,sys; print(json.dumps({"tool_name":"mcp__Claude_Browser__javascript_tool","tool_input":{"text":sys.argv[1]}}))' "$1"; }
batch() { "$PY" -c 'import json,sys; print(json.dumps({"tool_name":"mcp__claude-in-chrome__browser_batch","tool_input":{"actions":[{"name":"navigate","input":{"url":"https://x"}},{"name":"javascript_tool","input":{"text":sys.argv[1]}}]}}))' "$1"; }
tg() { # name expected(ask|go) payload
  local out rc got
  out=$(printf '%s' "$3" | bash "$H/tab-guard.sh" 2>&1); rc=$?
  if [ "$rc" = 0 ] && [[ "$out" == *'"permissionDecision":"ask"'* ]]; then got=ask
  elif [ "$rc" = 0 ] && [ -z "$out" ]; then got=go
  else got="exit $rc: ${out:0:60}"; fi
  if [ "$got" = "$2" ]; then echo "  PASS  $1"; pass=$((pass+1)); else echo "  FAIL  $1 — expected $2, got $got"; fail=$((fail+1)); fi
}
tg "read query goes on" go "$(js 'const query = `{ user { id super } }`; await fetch("/gql")')"
tg "remoteObject read goes on" go "$(js 'const query = `{ remoteObject(id: "1") { ... on RelateQuery { unitKey } } }`;')"
tg "MutationObserver goes on" go "$(js 'new MutationObserver(() => {}); const mutations = [];')"
tg "mutation { ... } asks" ask "$(js 'const query = `mutation { updateRelateQuery(id: "1") { id } }`;')"
tg "named mutation with variables asks" ask "$(js 'const query = `mutation Fix($id: ID!) { updateRelateQuery(id: $id) { id } }`;')"
tg "mutation over a newline asks" ask "$(js "$(printf 'const query = `mutation\n{\n  createUnit { id }\n}`;')")"
tg "mutation inside browser_batch asks" ask "$(batch 'const q = "mutation { createRecord { id } }";')"
tg "read inside browser_batch goes on" go "$(batch 'const q = "{ user { id } }";')"
out=$(printf '%s' 'not json' | bash "$H/tab-guard.sh" 2>&1); rc=$?
if [ "$rc" = 2 ]; then echo "  PASS  unparseable input blocks"; pass=$((pass+1));
else echo "  FAIL  unparseable input gave exit $rc"; fail=$((fail+1)); fi
# bluestep-one's Proceed ticket: a fresh file named by this call's tool_use_id stops the second
# ask. The old one-tools folder name still counts for one release cycle, so both are pinned.
# Each case points every temp variable at its own folder, so the machine's tickets never count.
jsid() { "$PY" -c 'import json,sys; print(json.dumps({"tool_name":"mcp__Claude_Browser__javascript_tool","tool_input":{"text":sys.argv[1]},"tool_use_id":sys.argv[2]}))' "$1" "$2"; }
TT=$(mktemp -d); mkdir -p "$TT/one-tools-tab-guard" "$TT/bluestep-one-tab-guard"
tgt() { local saved_tmpdir="$TMPDIR" saved_temp="$TEMP" saved_tmp="$TMP"; export TMPDIR="$TT" TEMP="$TT" TMP="$TT"; tg "$@"; export TMPDIR="$saved_tmpdir" TEMP="$saved_temp" TMP="$saved_tmp"; }
SAVE='const q = "mutation { createRecord { id } }";'
: > "$TT/one-tools-tab-guard/toolu_ok"
tgt "a fresh one-tools ticket for this call goes on" go "$(jsid "$SAVE" toolu_ok)"
tgt "a ticket for another call asks" ask "$(jsid "$SAVE" toolu_other)"
: > "$TT/one-tools-tab-guard/toolu_old"; touch -d '10 minutes ago' "$TT/one-tools-tab-guard/toolu_old" 2>/dev/null || touch -t "$(date -v-10M +%Y%m%d%H%M.%S)" "$TT/one-tools-tab-guard/toolu_old"
tgt "a stale ticket asks" ask "$(jsid "$SAVE" toolu_old)"
tgt "a tool_use_id written inside the script is not the call's" ask "$(jsid "$SAVE"' x = {"tool_use_id":"toolu_ok"};' toolu_none)"
: > "$TT/x"
tgt "an id that would leave the ticket folder is not read" ask "$(jsid "$SAVE" ../x)"
: > "$TT/bluestep-one-tab-guard/toolu_new"
tgt "a fresh bluestep-one ticket for this call goes on" go "$(jsid "$SAVE" toolu_new)"
tgt "a bluestep-one ticket for another call asks" ask "$(jsid "$SAVE" toolu_other2)"
: > "$TT/bluestep-one-tab-guard/toolu_newold"; touch -d '10 minutes ago' "$TT/bluestep-one-tab-guard/toolu_newold" 2>/dev/null || touch -t "$(date -v-10M +%Y%m%d%H%M.%S)" "$TT/bluestep-one-tab-guard/toolu_newold"
tgt "a stale bluestep-one ticket asks" ask "$(jsid "$SAVE" toolu_newold)"
rm -rf "$TT"

echo "=== phi-detect.sh ==="
# Every value here is synthetic: area codes 395/495 are N9X codes NANP keeps unassigned, the
# domains are invented, the names are made up. This repo is public — keep it that way.
# The phi-guard plugin's copy; the shared-copies section checks the project copy is the same bytes.
PD="$PG/lib/phi-detect.sh"
TAB=$(printf '\t')
pc() { # name kind value [args...] — must be caught, as <kind>, without echoing the value
  local name="$1" kind="$2" val="$3" out rc; shift 3
  out=$(printf 'see %s here\n' "$val" | sh "$PD" "$@" 2>&1); rc=$?
  if [ "$rc" = 1 ] && [[ "$out" == *"$TAB$kind$TAB"* ]] && [[ "$out" != *"$val"* ]]; then
    echo "  PASS  catches $name"; pass=$((pass+1))
  else
    echo "  FAIL  $name — expected exit 1 with a masked $kind, got $rc: ${out:0:80}"; fail=$((fail+1))
  fi
}
pn() { # name text [args...] — must pass clean: exit 0, no output
  local name="$1" text="$2" out rc; shift 2
  out=$(printf '%s\n' "$text" | sh "$PD" "$@" 2>&1); rc=$?
  if [ "$rc" = 0 ] && [ -z "$out" ]; then echo "  PASS  clean: $name"; pass=$((pass+1))
  else echo "  FAIL  $name — expected clean, got $rc: ${out:0:80}"; fail=$((fail+1)); fi
}
pc "(NXX) NXX-XXXX"            phone '(395) 482-1335'
pc "(NXX)NXX-XXXX"             phone '(395)482-1335'
pc "NXX-NXX-XXXX"              phone '395-482-1335'
pc "NXX.NXX.XXXX"              phone '395.482.1335'
pc "+1 NXX NXX XXXX"           phone '+1 495 271 0846'
pc "+1 (NXX) NXX-XXXX"         phone '+1 (495) 271-0846'
pc "1-NXX-NXX-XXXX"            phone '1-395-482-1335'
pc "an email outside the allowed domains" email 'alpha.testcase@someclinic-invented.org'
pc "an email on a subdomain"   email 'front.desk@mail.someclinic-invented.org'
pc "a record title (XX)"       record-title '(CL) Testcase, Alpha'
pc "a record title (XXX)"      record-title '(ABC) Sample, Beta'
pc "a domain allowed elsewhere is not allowed here" email 'beta@someclinic-invented.org' --domains other-invented.org
pn "exchange 555"              'call (395) 555-0142 or 395-555-0199'
pn "toll-free"                 '1-800-395-4410, (888) 432-1098, 877.241.6630, +1 866 241 6630'
pn "example.com/.org/.net"     'jane@example.com, joe@example.org, x@mail.example.net'
pn ".test / .invalid / .example" 'dev@site.test, a@b.invalid, c@d.example'
pn "the vendor domain"         'support@bluestep.net'
pn "image names and git remotes" 'logo@2x.png icon@3x.svg git@github.com:org/repo.git'
pn "platform record ids"       'record 120130___195147, script 530024___41, id 5300241234567'
pn "ISO dates and times"       '2026-10-28 2026-10-28T12:30:45Z 10/28/2026'
pn "version strings"           'v0.40.1, 1.12.345, 2.395.482.1335.7, 10.395.482.1335'
pn "a long digit run"          '39548213350 3954821335 +13954821335'
pn "digits running on"         'x12-395-482-1335 395-482-13350 id395-482-1335'
pn "phi-ok on the line"        'fixture: (395) 482-1335 alpha@someclinic-invented.org // phi-ok'
pn "--domains"                 'alpha@someclinic-invented.org' --domains 'other-invented.org, someclinic-invented.org'
PA=$(mktemp)
printf '# public numbers\n(395) 482-1335\ndomain:someclinic-invented.org\n' > "$PA"
pn "allowlist literal"         'front desk (395) 482-1335' --allow "$PA"
pn "allowlist domain:"         'front.desk@mail.someclinic-invented.org' --allow "$PA"
pc "allowlist does not cover another number" phone '(395) 482-1336' --allow "$PA"
printf '*\r\n' > "$PA"
pn "allowlist * (CRLF file)"   '(395) 482-1335 alpha@someclinic-invented.org (CL) Testcase, Alpha' --allow "$PA"
rm -f "$PA"
pn "missing allowlist file is empty" 'nothing to see' --allow "/nonexistent/.phi-allow"
pn "CRLF clean line"           "$(printf 'version 0.40.1 on 2026-10-28\r')"
pc "CRLF line"                 phone "$(printf '395-482-1335\r')"
out=$(printf 'line one\nline two (395) 482-1335\nline three\n' | sh "$PD"); rc=$?
if [ "$rc" = 1 ] && [ "$(printf '%s' "$out" | cut -f1)" = 2 ]; then echo "  PASS  reports the line number"; pass=$((pass+1));
else echo "  FAIL  line number — expected 2, got rc=$rc: ${out:0:60}"; fail=$((fail+1)); fi
out=$(printf 'x\n' | sh "$PD" --bogus 2>&1); rc=$?
if [ "$rc" = 2 ]; then echo "  PASS  unknown argument exits 2"; pass=$((pass+1));
else echo "  FAIL  unknown argument gave exit $rc"; fail=$((fail+1)); fi

echo "=== phi-guard.sh ==="
# Same synthetic fixtures as the detector section. A value starting with "json:" is parsed, so
# MultiEdit's edits list goes in as a real list.
jw() { "$PY" -c 'import json,sys; a=sys.argv[1:]; print(json.dumps({"tool_name":"Write","tool_input":{k:(json.loads(v[5:]) if v.startswith("json:") else v) for k,v in zip(a[::2],a[1::2])}}))' "$@"; }
pg() { # name expected_exit project_root payload — never echoes a raw value, a block names the reference
  local out rc
  out=$(printf '%s' "$4" | CLAUDE_PROJECT_DIR="$3" bash "$PG/phi-guard.sh" 2>&1); rc=$?
  if [ "$rc" != "$2" ]; then
    echo "  FAIL  $1 — expected exit $2, got $rc: ${out:0:100}"; fail=$((fail+1))
  elif [[ "$out" == *"482-1335"* || "$out" == *"271-0846"* || "$out" == *"someclinic-invented"* || "$out" == *"Testcase"* ]]; then
    echo "  FAIL  $1 — the message echoes a raw value: ${out:0:100}"; fail=$((fail+1))
  elif [ "$2" = 2 ] && [[ "$out" != *"conventions/client-data.md"* ]]; then
    echo "  FAIL  $1 — the block does not point at conventions/client-data.md: ${out:0:100}"; fail=$((fail+1))
  else
    echo "  PASS  $1"; pass=$((pass+1))
  fi
}
PHONE='call (395) 482-1335 today'
B6=$(mktemp -d); mkdir -p "$B6/U123456"
NB=$(mktemp -d)
AG=$(mktemp -d); printf '# rules\n<!-- bluestep-tools rules-template 3 -->\n' > "$AG/AGENTS.md"
pg "blocks a phone in a B6P project (Write content)" 2 "$B6" "$(jw file_path "$B6/docs/notes.md" content "$PHONE")"
pg "blocks in a project marked only by AGENTS.md" 2 "$AG" "$(jw file_path "$AG/README.md" content "$PHONE")"
pg "blocks an email via new_string (Edit)" 2 "$B6" "$(jw file_path "$B6/README.md" old_string x new_string 'mail alpha.testcase@someclinic-invented.org')"
pg "blocks a record title via edits (MultiEdit)" 2 "$B6" "$(jw file_path "$B6/README.md" edits 'json:[{"old_string":"a","new_string":"owner: (CL) Testcase, Alpha"}]')"
pg "blocks a phone in a later edit of the list" 2 "$B6" "$(jw file_path "$B6/README.md" edits 'json:[{"old_string":"a","new_string":"clean"},{"old_string":"b","new_string":"call (395) 482-1335"}]')"
pg "allows a MultiEdit that only removes client data (old_string)" 0 "$B6" "$(jw file_path "$B6/README.md" edits 'json:[{"old_string":"owner: (CL) Testcase, Alpha","new_string":"owner: <client A>"},{"old_string":"(395) 482-1335","new_string":"(395) 555-0142"}]')"
pg "blocks a relative path (taken as inside the root)" 2 "$B6" "$(jw file_path 'U123456/Comp/draft/README.md' content "$PHONE")"
pg "blocks a CRLF write" 2 "$B6" "$(jw file_path "$B6/notes.md" content "$(printf 'one\r\nphone 495-271-0846\r\n')")"
if ! command -v cygpath >/dev/null 2>&1; then
  # Linux/WSL: the temp root is a WSL path, so Windows' view of it is //wsl.localhost/<distro>/...
  pg "blocks the same place seen through //wsl.localhost/<distro>" 2 "$B6" "$(jw file_path "//wsl.localhost/ubuntu$B6/notes.md" content "$PHONE")"
else
  # Git Bash: the temp root is /tmp/..., a mount; Claude Code sends C:\...\Temp\... for it.
  pg "blocks a Windows backslash path (C:\\...)" 2 "$B6" "$(jw file_path "$(cygpath -w "$B6/notes.md")" content "$PHONE")"
fi
pg "allows the same text outside a B6P project" 0 "$NB" "$(jw file_path "$NB/notes.md" content "$PHONE")"
pg "allows a path outside the project root" 0 "$B6" "$(jw file_path "$NB/memory.md" content "$PHONE")"
pg "allows under .claude/scratch/" 0 "$B6" "$(jw file_path "$B6/.claude/scratch/dump.md" content "$PHONE")"
pg "allows under declarations/" 0 "$B6" "$(jw file_path "$B6/U123456/C/declarations/x.d.ts" content "$PHONE")"
pg "allows under .build/" 0 "$B6" "$(jw file_path "$B6/U123456/C/draft/.build/app.js" content "$PHONE")"
pg "allows a lockfile" 0 "$B6" "$(jw file_path "$B6/package-lock.json" content "$PHONE")"
pg "allows writing .phi-allow itself" 0 "$B6" "$(jw file_path "$B6/.phi-allow" content '(395) 482-1335')"
pg "allows clean text" 0 "$B6" "$(jw file_path "$B6/README.md" content 'call (395) 555-0142 or jane@example.com, record 530024___41')"
pg "allows a phi-ok line" 0 "$B6" "$(jw file_path "$B6/test.ts" content 'const fx = "(395) 482-1335"; // phi-ok')"
pg "allows an empty write" 0 "$B6" "$(jw file_path "$B6/empty.md" content '')"
pg "allows text over the size cap" 0 "$B6" "$("$PY" -c 'import json,sys; print(json.dumps({"tool_input":{"file_path":sys.argv[1],"content":"x"*600000+"\ncall (395) 482-1335\n"}}))' "$B6/bundle.js")"
printf '# the front desk\n(395) 482-1335\n' > "$B6/.phi-allow"
pg "allows a .phi-allow literal" 0 "$B6" "$(jw file_path "$B6/README.md" content "$PHONE")"
pg ".phi-allow literal does not cover another number" 2 "$B6" "$(jw file_path "$B6/README.md" content 'call 495-271-0846')"
printf '*\n' > "$B6/.phi-allow"
pg "allows everything with .phi-allow *" 0 "$B6" "$(jw file_path "$B6/README.md" content "$PHONE (CL) Testcase, Alpha")"
rm -f "$B6/.phi-allow"
out=$(printf '%s' 'not json' | CLAUDE_PROJECT_DIR="$B6" bash "$PG/phi-guard.sh" 2>&1); rc=$?
if [ "$rc" = 2 ]; then echo "  PASS  unparseable input blocks"; pass=$((pass+1));
else echo "  FAIL  unparseable input gave exit $rc"; fail=$((fail+1)); fi
# The detector missing or broken must block, not allow: a copy of the hook without it.
GC=$(mktemp -d); mkdir -p "$GC/lib"; cp "$PG/phi-guard.sh" "$GC/"; cp "$PG/lib/hook-input.sh" "$GC/lib/"
out=$(jw file_path "$B6/README.md" content 'nothing here' | CLAUDE_PROJECT_DIR="$B6" bash "$GC/phi-guard.sh" 2>&1); rc=$?
if [ "$rc" = 2 ] && [[ "$out" == *Reinstall* ]]; then echo "  PASS  missing detector blocks"; pass=$((pass+1));
else echo "  FAIL  missing detector gave exit $rc: ${out:0:100}"; fail=$((fail+1)); fi
printf '#!/bin/sh\nexit 2\n' > "$GC/lib/phi-detect.sh"
out=$(jw file_path "$B6/README.md" content 'nothing here' | CLAUDE_PROJECT_DIR="$B6" bash "$GC/phi-guard.sh" 2>&1); rc=$?
if [ "$rc" = 2 ] && [[ "$out" == *Reinstall* ]]; then echo "  PASS  detector exit 2 blocks"; pass=$((pass+1));
else echo "  FAIL  detector exit 2 gave exit $rc: ${out:0:100}"; fail=$((fail+1)); fi
# The generated Cursor wrapper for this hook, in the phi-guard plugin's own dist tree.
WP="$ROOT/dist/cursor/phi-guard/hooks/phi-guard-cursor.sh"
if [ ! -f "$WP" ]; then
  echo "  FAIL  $WP missing — run npm run gen"; fail=$((fail+1))
else
  out=$(jw file_path "$B6/README.md" content "$PHONE" | CLAUDE_PROJECT_DIR="$B6" sh "$WP")
  if [[ "$out" == *'"permission":"deny"'* ]] && [[ "$out" != *"482-1335"* ]]; then echo "  PASS  Cursor wrapper: phone in a B6P project → deny, masked"; pass=$((pass+1));
  else echo "  FAIL  Cursor wrapper: expected a masked deny, got ${out:0:100}"; fail=$((fail+1)); fi
  out=$(jw file_path "$NB/README.md" content "$PHONE" | CLAUDE_PROJECT_DIR="$NB" sh "$WP")
  if [[ "$out" == *'"permission":"allow"'* ]]; then echo "  PASS  Cursor wrapper: non-B6P project → allow"; pass=$((pass+1));
  else echo "  FAIL  Cursor wrapper: expected allow, got ${out:0:100}"; fail=$((fail+1)); fi
fi
rm -rf "$GC" "$B6" "$NB" "$AG"

echo "=== phi-check.sh ==="
# The project copy /b6p-setup installs: phi-check.sh + pre-commit + the detector, all from the
# b6p-setup assets ($PCA), in a temp repo's scripts/hooks/. Same synthetic values as above.
if ! git --version >/dev/null 2>&1; then
  echo "  SKIP  phi-check.sh (git not runnable)"
else
  PCR=""
  newrepo() { # a fresh repo with the hook files in scripts/hooks/; sets PCR
    PCR=$(mktemp -d)
    (cd "$PCR" && git init -q && git config user.email t@example.com && git config user.name T \
      && git config commit.gpgsign false && git config core.autocrlf false) || return 1
    mkdir -p "$PCR/scripts/hooks"
    cp "$PCA/phi-check.sh" "$PCA/pre-commit" "$PCA/phi-detect.sh" "$PCR/scripts/hooks/"
    chmod +x "$PCR/scripts/hooks/"*
  }
  # Commit what is staged without running any hook (setting up history, not testing).
  gc() { (cd "$PCR" && git add -A && git commit -q --no-verify -m "$1") >/dev/null 2>&1; }
  ck() { # name expected_exit needle args... — runs phi-check.sh in $PCR; never echoes a raw value
    local name="$1" want="$2" needle="$3" out rc; shift 3
    out=$(cd "$PCR" && sh scripts/hooks/phi-check.sh "$@" 2>&1); rc=$?
    if [ "$rc" != "$want" ]; then
      echo "  FAIL  $name — expected exit $want, got $rc: ${out:0:120}"; fail=$((fail+1))
    elif [ -n "$needle" ] && [[ "$out" != *"$needle"* ]]; then
      echo "  FAIL  $name — output lacks '$needle': ${out:0:120}"; fail=$((fail+1))
    elif [[ "$out" == *"482-1335"* || "$out" == *"271-0846"* || "$out" == *"someclinic-invented"* || "$out" == *"Testcase"* ]]; then
      echo "  FAIL  $name — the output echoes a raw value: ${out:0:120}"; fail=$((fail+1))
    else
      echo "  PASS  $name"; pass=$((pass+1))
    fi
  }

  newrepo
  printf 'one\ntwo\nthree\ncall (395) 482-1335\n' > "$PCR/notes.md"
  (cd "$PCR" && git add -A)
  ck "staged value → exit 1, file:line with the real line, masked" 1 "notes.md:4 phone (3…" --staged
  ck "the block names --no-verify and the reference" 1 "conventions/client-data.md" --staged
  (cd "$PCR" && git reset -q && rm notes.md && printf 'call (395) 555-0142\n' > clean.md && git add -A)
  ck "clean staged file (and the hook files themselves) → 0" 0 "" --staged
  gc clean
  # An old leak already in HEAD: later commits that do not add a value pass, and a new value
  # in the same file is reported at its own line only.
  printf 'a\nb\nc\nmail alpha@someclinic-invented.org\ne\nf\ng\nh\n' > "$PCR/old.md"
  gc "old leak"
  sed 's/^b$/b changed/' "$PCR/old.md" > "$PCR/old.tmp" && mv "$PCR/old.tmp" "$PCR/old.md"
  (cd "$PCR" && git add -A)
  ck "a line already in HEAD is not reported (added lines only)" 0 "" --staged
  sed 's/^g$/owner (CL) Testcase, Alpha/' "$PCR/old.md" > "$PCR/old.tmp" && mv "$PCR/old.tmp" "$PCR/old.md"
  (cd "$PCR" && git add -A)
  out=$(cd "$PCR" && sh scripts/hooks/phi-check.sh --staged 2>&1)
  if [[ "$out" == *"old.md:7 record-title"* ]] && [[ "$out" != *"old.md:4"* ]]; then echo "  PASS  a second hunk maps to its real line, the old line stays out"; pass=$((pass+1));
  else echo "  FAIL  hunk mapping — want old.md:7 and no old.md:4: ${out:0:160}"; fail=$((fail+1)); fi
  (cd "$PCR" && git reset -q --hard)
  mkdir -p "$PCR/.claude/scratch" "$PCR/U123456/Comp/declarations"
  printf 'call (395) 482-1335\n' > "$PCR/.claude/scratch/x.md"
  printf '// (395) 482-1335\n' > "$PCR/U123456/Comp/declarations/x.d.ts"
  (cd "$PCR" && git add -A)
  ck "skips .claude/scratch/ and declarations/" 0 "" --staged
  gc skipped
  printf 'front desk (395) 482-1335\n' > "$PCR/desk.md"
  printf '# public numbers\n(395) 482-1335\n' > "$PCR/.phi-allow"
  (cd "$PCR" && git add -A)
  ck ".phi-allow literal (and .phi-allow itself is not checked)" 0 "" --staged
  printf 'front desk 495-271-0846\n' >> "$PCR/desk.md"; (cd "$PCR" && git add -A)
  ck ".phi-allow literal does not cover another number" 1 "desk.md:2 phone" --staged
  printf '*\n' > "$PCR/.phi-allow"; (cd "$PCR" && git add -A)
  ck ".phi-allow * turns the check off" 0 "" --staged
  (cd "$PCR" && git reset -q --hard)
  printf 'GIF89a\000\001\002 call (395) 482-1335\000\n' > "$PCR/blob.bin"; (cd "$PCR" && git add -A)
  ck "binary file skipped" 0 "" --staged
  gc binary
  BASE=$(cd "$PCR" && git rev-parse HEAD)
  printf 'x\nmail alpha@someclinic-invented.org\n' > "$PCR/leak.md"; gc leak
  TIP=$(cd "$PCR" && git rev-parse HEAD)
  ck "--range finds a value added between two commits" 1 "leak.md:2 email" --range "$BASE..$TIP"
  ck "--range over clean commits → 0" 0 "" --range "$BASE~1..$BASE"
  ck "--range with a bad revision fails closed" 1 "cannot run" --range "nope..$TIP"
  # Tracked now: old.md (line 4) and leak.md (line 2); scratch/ and declarations/ stay out.
  ck "--all finds committed values, with a per-file count" 1 "2 finding(s) in 2 file(s)" --all
  ck "--all names the file and line" 1 "leak.md:2 email" --all
  printf '*\n' > "$PCR/.phi-allow"; (cd "$PCR" && git add -A)
  ck "--all with nothing found still prints a summary" 0 "0 finding(s) in 0 file(s)" --all
  (cd "$PCR" && git reset -q --hard)
  out=$(cd "$PCR" && TMPDIR="$PCR/no-such-dir" sh scripts/hooks/phi-check.sh --range "$BASE..$TIP" 2>&1); rc=$?
  if [ "$rc" = 1 ] && [[ "$out" == *"leak.md:2 email"* ]]; then echo "  PASS  a TMPDIR that does not exist still checks"; pass=$((pass+1));
  else echo "  FAIL  bad TMPDIR gave exit $rc: ${out:0:120}"; fail=$((fail+1)); fi
  rm -f "$PCR/scripts/hooks/phi-detect.sh"
  ck "missing detector → exit 1, says re-run /b6p-setup" 1 "Re-run /b6p-setup" --staged
  rm -rf "$PCR"

  # The real thing: git commit with core.hooksPath pointing at the copy.
  newrepo
  (cd "$PCR" && git config core.hooksPath scripts/hooks)
  printf 'contact: 395.482.1335\n' > "$PCR/README.md"
  out=$(cd "$PCR" && git add -A && git commit -q -m first 2>&1); rc=$?
  if [ "$rc" != 0 ] && [[ "$out" == *"README.md:1 phone"* ]] && [[ "$out" != *"482"* ]] && ! (cd "$PCR" && git rev-parse -q --verify HEAD >/dev/null 2>&1); then
    echo "  PASS  git commit through core.hooksPath is blocked"; pass=$((pass+1))
  else echo "  FAIL  git commit was not blocked (rc=$rc): ${out:0:120}"; fail=$((fail+1)); fi
  printf 'contact: 395-555-0142\n' > "$PCR/README.md"
  out=$(cd "$PCR" && git add -A && git commit -q -m first 2>&1); rc=$?
  if [ "$rc" = 0 ] && (cd "$PCR" && git rev-parse -q --verify HEAD >/dev/null 2>&1); then
    echo "  PASS  the same commit goes through once fixed (hook files included)"; pass=$((pass+1))
  else echo "  FAIL  fixed commit failed (rc=$rc): ${out:0:120}"; fail=$((fail+1)); fi
  rm -rf "$PCR"
fi

echo "=== pre-push ==="
# The push side of the project copy: a work repo with the four hook files in scripts/hooks/ and a
# bare remote. Most cases feed pre-push the ref lines git would; one real git push at the end.
# The model review never calls claude here: PHI_REVIEW_CLAUDE points at a stub that answers
# canned JSON and leaves a trace (cwd, stdin, args) in $M.
if ! git --version >/dev/null 2>&1; then
  echo "  SKIP  pre-push (git not runnable)"
else
  PP=$(mktemp -d); BARE="$PP/remote.git"; R="$PP/work"; M="$PP/model"; mkdir -p "$M"
  Z=0000000000000000000000000000000000000000
  git init -q --bare "$BARE" && git -C "$BARE" symbolic-ref HEAD refs/heads/main
  git init -q "$R"
  (cd "$R" && git symbolic-ref HEAD refs/heads/main && git config user.email t@example.com \
    && git config user.name T && git config commit.gpgsign false && git config core.autocrlf false \
    && git remote add origin "$BARE")
  mkdir -p "$R/scripts/hooks"
  cp "$PCA/phi-check.sh" "$PCA/pre-commit" "$PCA/pre-push" "$PCA/phi-detect.sh" "$R/scripts/hooks/"
  chmod +x "$R/scripts/hooks/"*
  printf 'scripts/\n' > "$R/.git/info/exclude"
  mkstub() { # name body — a model stand-in that records how it was called
    printf '#!/bin/sh\ntouch "%s/called"\npwd > "%s/cwd"\ncat > "%s/stdin"\nprintf "%%s\\n" "$*" > "%s/args"\n%s\n' \
      "$M" "$M" "$M" "$M" "$2" > "$M/$1"
    chmod +x "$M/$1"
  }
  mkstub find.sh "echo '{\"findings\":[{\"loc\":\"talk.md:2\",\"kind\":\"name\"}]}'"
  mkstub fence.sh "printf '%s\\n' 'Here you go:' '\`\`\`json' '{\"findings\": [' '  {\"kind\": \"name\", \"loc\": \"talk.md:2\"}' ']}' '\`\`\`'"
  mkstub none.sh "echo '{\"findings\":[]}'"
  mkstub nologin.sh "echo 'Not logged in · Please run /login'; exit 1"
  mkstub fail.sh "echo 'not logged in' >&2; exit 3"
  mkstub garbage.sh "echo 'I cannot help with that.'"
  mkstub elsewhere.sh "echo '{\"findings\":[{\"loc\":\"talk.md:99\",\"kind\":\"name\"}]}'"
  STUB="$M/find.sh"
  pp() { # name expected_exit needle ref-line — pre-push by hand in $R; never echoes a raw value
    local name="$1" want="$2" needle="$3" out rc
    rm -f "$M/called"
    out=$(cd "$R" && printf '%s\n' "$4" | PHI_REVIEW_CLAUDE="$STUB" sh scripts/hooks/pre-push origin "$BARE" 2>&1); rc=$?
    if [ "$rc" != "$want" ]; then
      echo "  FAIL  $name — expected exit $want, got $rc: ${out:0:140}"; fail=$((fail+1))
    elif [ -n "$needle" ] && [[ "$out" != *"$needle"* ]]; then
      echo "  FAIL  $name — output lacks '$needle': ${out:0:140}"; fail=$((fail+1))
    elif [[ "$out" == *"482-1335"* || "$out" == *"someclinic-invented"* || "$out" == *"Testcase"* || "$out" == *"Testperson"* ]]; then
      echo "  FAIL  $name — the output echoes a raw value: ${out:0:140}"; fail=$((fail+1))
    else
      echo "  PASS  $name"; pass=$((pass+1))
    fi
  }
  called() { # name yes|no — did the last pp run the model stub?
    local got=no; [ -f "$M/called" ] && got=yes
    if [ "$got" = "$2" ]; then echo "  PASS  $1"; pass=$((pass+1)); else echo "  FAIL  $1 — stub called: $got"; fail=$((fail+1)); fi
  }
  co() { (cd "$R" && git checkout -q "$@") >/dev/null 2>&1; }
  cm() { (cd "$R" && git add -A && git commit -q --no-verify -m "$1") >/dev/null 2>&1; }
  sha() { (cd "$R" && git rev-parse "$1"); }

  # main on the remote already holds an old leak; every branch below starts there.
  printf 'hello\n' > "$R/README.md"
  printf 'mail alpha@someclinic-invented.org\n' > "$R/old.md"; cm base
  (cd "$R" && git push -q --no-verify origin main && git remote set-head origin main) >/dev/null 2>&1
  BASE=$(sha HEAD)
  co -b leak; printf 'call (395) 482-1335\n' > "$R/leak.md"; cm leak; LEAK=$(sha HEAD)
  co main; co -b clean; printf 'call (395) 555-0142\n' > "$R/clean.md"; cm clean; CLEAN=$(sha HEAD)
  co main; co --orphan solo; printf 'owner (CL) Testcase, Alpha\n' > "$R/solo.md"
  (cd "$R" && git rm -q --cached old.md README.md && rm -f old.md README.md); cm solo; SOLO=$(sha HEAD)

  pp "regex finding in a pushed commit blocks, masked" 1 "leak.md:1 phone (3…" "refs/heads/leak $LEAK refs/heads/leak $BASE"
  pp "the regex block names git push --no-verify" 1 "git push --no-verify" "refs/heads/leak $LEAK refs/heads/leak $BASE"
  pp "clean push passes" 0 "" "refs/heads/clean $CLEAN refs/heads/clean $BASE"
  pp "new branch (zero remote sha): only commits since origin/HEAD, old leak on main not re-reported" 0 "" "refs/heads/clean $CLEAN refs/heads/clean $Z"
  pp "new branch with a leak blocks" 1 "leak.md:1 phone" "refs/heads/leak $LEAK refs/heads/leak $Z"
  pp "remote tip this clone never fetched → same as a new branch" 0 "" "refs/heads/clean $CLEAN refs/heads/clean 1234567890123456789012345678901234567890"
  (cd "$R" && git remote set-head origin -d) >/dev/null 2>&1
  pp "no origin/HEAD: commits on no remote ref are checked" 1 "leak.md:1 phone" "refs/heads/leak $LEAK refs/heads/leak $Z"
  pp "no origin/HEAD, clean new branch → 0" 0 "" "refs/heads/clean $CLEAN refs/heads/clean $Z"
  (cd "$R" && git remote set-head origin main) >/dev/null 2>&1
  pp "unrelated root commit: checked from the empty tree" 1 "solo.md:1 record-title" "refs/heads/solo $SOLO refs/heads/solo $Z"
  pp "branch delete (zero local sha) → 0" 0 "" "(delete) $Z refs/heads/gone $BASE"
  pp "nothing new (the tip is already on the remote) → 0" 0 "" "refs/heads/other $BASE refs/heads/other $Z"

  # Model review. talk.md line 2 is free text the regex cannot see; line 3 carries phi-ok and
  # line 4 a .phi-allow literal, so neither may reach the model.
  co main; co -b talk
  printf 'meeting notes\ntalked to Jane Testperson about the bill\nfixture Jane Testperson phi-ok\nfront desk: Alpha Frontdesk\n' > "$R/talk.md"
  printf 'Alpha Frontdesk\n' > "$R/.phi-allow"; cm talk; TALK=$(sha HEAD)
  TL="refs/heads/talk $TALK refs/heads/talk $BASE"
  pp "review off: clean regex → 0" 0 "" "$TL"
  called "review off: the model is not called" no
  (cd "$R" && git config bluestep.phiReview true)
  pp "review on + findings → blocks with file:line kind" 1 "talk.md:2 name" "$TL"
  called "review on: the model is called" yes
  if grep -q '^talk.md:2: talked to' "$M/stdin" && ! grep -q 'phi-ok' "$M/stdin" && ! grep -q 'Frontdesk' "$M/stdin"; then
    echo "  PASS  model input: file:line: prefixes, phi-ok and .phi-allow lines left out"; pass=$((pass+1))
  else echo "  FAIL  model input was: $(head -c 200 "$M/stdin")"; fail=$((fail+1)); fi
  case "$(cat "$M/cwd")" in
    "$R"*) echo "  FAIL  the model ran inside the repo"; fail=$((fail+1)) ;;
    *) echo "  PASS  the model runs from a temp folder outside the repo"; pass=$((pass+1)) ;;
  esac
  if grep -q -- '-p --model haiku --tools' "$M/args"; then echo "  PASS  model args: -p --model haiku --tools ..."; pass=$((pass+1));
  else echo "  FAIL  model args were: $(cat "$M/args" | head -c 160)"; fail=$((fail+1)); fi
  pp "the model block gives the fixes and --no-verify" 1 "git push --no-verify" "$TL"
  STUB="$M/fence.sh";     pp "answer in a \`\`\`json fence, keys swapped → still blocks" 1 "talk.md:2 name" "$TL"
  STUB="$M/none.sh";      pp "review on + {\"findings\":[]} → 0" 0 "" "$TL"
  STUB="$M/fail.sh";      pp "model exits non-zero → warns and passes" 0 "model review skipped: claude exited with 3" "$TL"
  STUB="$M/nologin.sh";   pp "not logged in (said on stdout) → the warning says why" 0 "exited with 1 (Not logged in" "$TL"
  STUB="$M/garbage.sh";  pp "unreadable answer → warns and passes" 0 "not the expected JSON" "$TL"
  STUB="$M/elsewhere.sh"; pp "answer names a line that was not sent → warns and passes" 0 "not sent" "$TL"
  STUB="$M/no-such-claude"; pp "PHI_REVIEW_CLAUDE missing → warns and passes" 0 "model review skipped" "$TL"
  STUB="$M/find.sh"
  pp "review on, regex finding → the regex blocks first" 1 "leak.md:1 phone" "refs/heads/leak $LEAK refs/heads/leak $BASE"
  called "review on, regex finding: the model is not called" no
  co main; co -b big
  awk 'BEGIN { for (i = 1; i <= 2000; i++) printf "line %d of a long generated file with plain words in it ok\n", i }' > "$R/big.txt"
  cm big; BIG=$(sha HEAD)
  pp "over the size cap → warns and passes" 0 "over the 102400-byte limit" "refs/heads/big $BIG refs/heads/big $BASE"
  called "over the size cap: the model is not called" no
  (cd "$R" && git config bluestep.phiReview false)

  # The real thing: git push with core.hooksPath pointing at the copy.
  (cd "$R" && git config core.hooksPath scripts/hooks)
  co leak
  out=$(cd "$R" && PHI_REVIEW_CLAUDE="$M/find.sh" git push origin leak 2>&1); rc=$?
  if [ "$rc" != 0 ] && [[ "$out" == *"leak.md:1 phone"* ]] && [[ "$out" != *"482-1335"* ]] && [ -z "$(git -C "$BARE" for-each-ref refs/heads/leak)" ]; then
    echo "  PASS  git push through core.hooksPath is blocked, the remote has no leak branch"; pass=$((pass+1))
  else echo "  FAIL  git push was not blocked (rc=$rc): ${out:0:140}"; fail=$((fail+1)); fi
  co clean
  out=$(cd "$R" && PHI_REVIEW_CLAUDE="$M/find.sh" git push origin clean 2>&1); rc=$?
  if [ "$rc" = 0 ] && [ -n "$(git -C "$BARE" for-each-ref refs/heads/clean)" ]; then
    echo "  PASS  a clean git push goes through"; pass=$((pass+1))
  else echo "  FAIL  clean git push failed (rc=$rc): ${out:0:140}"; fail=$((fail+1)); fi
  rm -rf "$PP"
fi

echo "=== shared copies are the same bytes ==="
# Each plugin installs alone, so a shared script lives once per plugin; gen:check holds the same
# pairs, this keeps the harness honest about what it just tested.
for pair in "plugins/bluestep-tools/hooks/lib/hook-input.sh plugins/phi-guard/hooks/lib/hook-input.sh" \
            "plugins/phi-guard/hooks/lib/phi-detect.sh plugins/bluestep-tools/skills/b6p-setup/assets/phi-guard/phi-detect.sh"; do
  set -- $pair
  if cmp -s "$ROOT/$1" "$ROOT/$2"; then echo "  PASS  $1 = $2"; pass=$((pass+1));
  else echo "  FAIL  $1 and $2 differ — copy one over the other"; fail=$((fail+1)); fi
done

# Every hook script of every plugin (lib/ included) and every shebang asset of every skill, as
# repo paths. The index is the list, so a stray untracked file is not counted.
SCRIPTS=$(cd "$ROOT" && git ls-files plugins | while IFS= read -r f; do
  case "$f" in
    plugins/*/hooks/*.sh) echo "$f" ;;
    plugins/*/skills/*/assets/*) [ "$(head -c 2 "$f")" = '#!' ] && echo "$f" ;;
  esac
done)

echo "=== phi-guard markers move together ==="
# /b6p-setup's phi-guard migration refreshes a project's four copies when their line-2 marker is
# below the shipped one, and the plugin's detector is the same bytes as the project's. A bump in
# one file and not the others would leave a project mixed. Every phi-guard asset and every
# phi-detect.sh must carry the marker; any other script that carries one must match too.
M0=$(sed -n 2p "$PCA/phi-check.sh")
case "$M0" in
  "# bluestep-tools phi-guard "[0-9]*) echo "  PASS  plugins/bluestep-tools/skills/b6p-setup/assets/phi-guard/phi-check.sh carries the marker ($M0)"; pass=$((pass+1)) ;;
  *) echo "  FAIL  phi-check.sh line 2 is not a phi-guard marker: $M0"; fail=$((fail+1)) ;;
esac
for f in $SCRIPTS; do
  [ "$f" = plugins/bluestep-tools/skills/b6p-setup/assets/phi-guard/phi-check.sh ] && continue
  m=$(sed -n 2p "$ROOT/$f")
  case "$f" in
    */assets/phi-guard/*|*/phi-detect.sh) ;;
    *) case "$m" in "# bluestep-tools phi-guard "*) ;; *) continue ;; esac ;;
  esac
  if [ "$m" = "$M0" ]; then echo "  PASS  $f marker matches"; pass=$((pass+1));
  else echo "  FAIL  $f line 2 is '$m', expected '$M0'"; fail=$((fail+1)); fi
done

echo "=== exec bits in the index ==="
# Claude Code runs the source scripts directly; an edit from Windows over a UNC path has reset
# a mode to 100644 before. core.fileMode may be off, so ask the index, not the filesystem.
for f in $SCRIPTS; do
  mode=$(cd "$ROOT" && git ls-files -s "$f" | cut -c1-6)
  if [ "$mode" = 100755 ]; then echo "  PASS  $f is 100755"; pass=$((pass+1));
  else echo "  FAIL  $f is $mode in the index — git update-index --chmod=+x"; fail=$((fail+1)); fi
done

echo "=== Cursor preToolUse wrapper (generated) ==="
# The wrapper is generated into dist/cursor by npm run gen; these cases pin its contract:
# tool-name filter, deny JSON, and fail-closed on everything it can see.
W="$ROOT/dist/cursor/bluestep-tools/hooks/block-generated-files-cursor.sh"
jc() { "$PY" -c 'import json,sys; print(json.dumps({"tool_name":sys.argv[1],"tool_input":{sys.argv[2]:sys.argv[3]}}))' "$1" "$2" "$3"; }
perm() { "$PY" -c 'import json,sys; print(json.load(sys.stdin)["permission"])' 2>/dev/null || echo INVALID_JSON; }
c() { # name expected_permission output
  if [ "$3" = "$2" ]; then echo "  PASS  $1"; pass=$((pass+1)); else echo "  FAIL  $1 — expected $2, got $3"; fail=$((fail+1)); fi
}
if [ ! -f "$W" ]; then
  echo "  FAIL  $W missing — run npm run gen"; fail=$((fail+1))
else
  c "Write declarations (backslashes) → deny" deny "$(jc Write path 'C:\p\declarations\B.d.ts' | sh "$W" | perm)"
  c "Write target_file declarations → deny" deny "$(jc Write target_file 'src/declarations/Foo.d.ts' | sh "$W" | perm)"
  c "StrReplace Globals.d.ts → deny" deny "$(jc StrReplace file_path '/p/Globals.d.ts' | sh "$W" | perm)"
  c "apply_patch declarations → deny (filter is case-insensitive)" deny "$(jc apply_patch path 'declarations/x.ts' | sh "$W" | perm)"
  c "Delete B.d.ts → deny" deny "$(jc Delete path '/p/B.d.ts' | sh "$W" | perm)"
  c "Write app.ts → allow" allow "$(jc Write path 'src/app.ts' | sh "$W" | perm)"
  c "Read declarations → allow (not an edit tool)" allow "$(jc Read path 'declarations/B.d.ts' | sh "$W" | perm)"
  c "Shell → allow" allow "$(jc Shell command 'rm declarations/B.d.ts' | sh "$W" | perm)"
  c "pretty-printed payload (newline after the colon) → deny" deny "$(printf '{"tool_name":\n  "Write",\n  "tool_input": {"path": "x/declarations/a.ts"}}' | sh "$W" | perm)"
  c "quote in the path → deny, valid JSON" deny "$(jc Write path 'x/declarations/a "q".ts' | sh "$W" | perm)"
  c "control char in the path → deny, valid JSON" deny "$(jc Write path "$(printf 'x/declarations/a\001b.ts')" | sh "$W" | perm)"
  c "invalid JSON on an edit → deny" deny "$(printf '{"tool_name":"Write","tool_input":{"path":"src/app.ts"' | sh "$W" | perm)"
  c "empty stdin → deny" deny "$(: | sh "$W" | perm)"
  WT=$(mktemp -d); cp -r "$(dirname "$W")"/. "$WT/"
  chmod -x "$WT/shared/block-generated-files.sh"
  c "shared script without exec bit → still deny on declarations" deny "$(jc Write path '/p/declarations/x.ts' | sh "$WT/block-generated-files-cursor.sh" | perm)"
  rm -f "$WT/shared/block-generated-files.sh"
  c "shared script missing → deny" deny "$(jc Write path 'src/app.ts' | sh "$WT/block-generated-files-cursor.sh" | perm)"
  rm -rf "$WT"
  out=$(jc Write path 'src/app.ts' | env -i PATH="$TMPD" "$(command -v sh)" "$W" 2>/dev/null); rc=$?
  c "no tools on PATH → deny (not allow)" deny "$(printf '%s' "$out" | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["permission"])' 2>/dev/null || echo "INVALID_JSON_or_rc=$rc")"
fi

echo "=== canary.sh (SessionStart) ==="
NUDGE=$(mktemp -d); mkdir -p "$NUDGE/U123456"
out=$(cd "$NUDGE" && printf '{"hook_event_name":"SessionStart","source":"startup"}' | bash "$H/canary.sh" 2>/dev/null); rc=$?
if [ "$rc" = 0 ] && [[ "$out" == *"/b6p-setup"* ]]; then echo "  PASS  nudge: U######/ and no AGENTS.md → one stdout line, exit 0"; pass=$((pass+1)); else echo "  FAIL  nudge: expected the /b6p-setup line, exit 0 — got rc=$rc: ${out:0:80}"; fail=$((fail+1)); fi
printf '# rules\n\n- keep it short\n' > "$NUDGE/CLAUDE.md"
out=$(cd "$NUDGE" && printf '{"hook_event_name":"SessionStart","source":"startup"}' | bash "$H/canary.sh" 2>/dev/null); rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then echo "  PASS  nudge: U######/ with a populated CLAUDE.md and no AGENTS.md → silent"; pass=$((pass+1)); else echo "  FAIL  nudge: expected silence with CLAUDE.md — got rc=$rc: ${out:0:80}"; fail=$((fail+1)); fi
rm -f "$NUDGE/CLAUDE.md"; touch "$NUDGE/AGENTS.md"
out=$(cd "$NUDGE" && printf '{"hook_event_name":"SessionStart","source":"startup"}' | bash "$H/canary.sh" 2>/dev/null); rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then echo "  PASS  nudge: U######/ with AGENTS.md → silent"; pass=$((pass+1)); else echo "  FAIL  nudge: expected silence — got rc=$rc: ${out:0:80}"; fail=$((fail+1)); fi
rm -rf "$NUDGE"
PLAIN=$(mktemp -d); mkdir -p "$PLAIN/src"; : > "$PLAIN/package.json"
out=$(cd "$PLAIN" && printf '{"hook_event_name":"SessionStart","source":"startup"}' | bash "$H/canary.sh" 2>/dev/null); rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then echo "  PASS  nudge: non-B6P folder (no U######/) → silent"; pass=$((pass+1)); else echo "  FAIL  nudge: expected silence in a non-B6P folder — got rc=$rc: ${out:0:80}"; fail=$((fail+1)); fi
rm -rf "$PLAIN"
out=$(printf '{"hook_event_name":"SessionStart","source":"startup"}' | bash "$H/canary.sh" 2>&1); rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then echo "  PASS  parser present: silent, exit 0"; pass=$((pass+1));
else echo "  FAIL  parser present gave exit $rc, output '${out:0:80}'"; fail=$((fail+1)); fi
TMPD=$(mktemp -d)
out=$(printf '{"hook_event_name":"SessionStart","source":"startup"}' | env -i PATH="$TMPD" "$BASH_BIN" "$H/canary.sh" 2>&1 >/dev/null); rc=$?
lines=$(printf '%s' "$out" | grep -c .)
if [ "$rc" = 1 ] && [ "$lines" = 1 ]; then
  echo "  PASS  no parser on PATH: one stderr line, exit 1 (non-blocking)"; pass=$((pass+1))
  echo "        ${out:0:95}..."
else
  echo "  FAIL  no parser gave exit $rc with $lines stderr line(s) (want 1 and 1)"; echo "        ${out:0:120}"; fail=$((fail+1))
fi
rmdir "$TMPD" 2>/dev/null

# The phi-guard nudge. It reads the sibling plugin folder only in the marketplace cache layout
# .../plugins/cache/<marketplace>/<plugin>/<version>/, so the cases build that layout in a temp
# folder with a copy of canary.sh and its lib/. The project is a folder with the git check copied in.
CC=$(mktemp -d); CR="$CC/plugins/cache/bluestep/bluestep-tools/0.42.0"
mkdir -p "$CR/hooks"; cp "$H/canary.sh" "$CR/hooks/"; cp -r "$H/lib" "$CR/hooks/"
PJ=$(mktemp -d); mkdir -p "$PJ/scripts/hooks"; cp "$PCA/phi-check.sh" "$PJ/scripts/hooks/"; : > "$PJ/AGENTS.md"
cn() { # name expected(line|silent) plugin_root canary_script — runs in $PJ
  local out rc got
  out=$(cd "$PJ" && printf '{"hook_event_name":"SessionStart","source":"startup"}' | CLAUDE_PLUGIN_ROOT="$3" bash "$4" 2>&1); rc=$?
  if [ "$rc" = 0 ] && [ -z "$out" ]; then got=silent
  elif [ "$rc" = 0 ] && [[ "$out" == *"phi-guard@bluestep"* ]] && [ "$(printf '%s\n' "$out" | grep -c .)" = 1 ]; then got=line
  else got="exit $rc: ${out:0:80}"; fi
  if [ "$got" = "$2" ]; then echo "  PASS  $1"; pass=$((pass+1)); else echo "  FAIL  $1 — expected $2, got $got"; fail=$((fail+1)); fi
}
cn "phi-guard nudge: git check, no .phi-allow, phi-guard not installed → one line, exit 0" line "$CR" "$CR/hooks/canary.sh"
if command -v cygpath >/dev/null 2>&1; then
  # Git Bash: Claude Code hands the plugin root over as C:\...\plugins\cache\...
  cn "phi-guard nudge: a Windows backslash plugin root is the cache layout too" line "$(cygpath -w "$CR")" "$CR/hooks/canary.sh"
else
  cn "phi-guard nudge: a plugin root with a trailing slash is the cache layout too" line "$CR/" "$CR/hooks/canary.sh"
fi
printf '# no client data here\n *  \r\n' > "$PJ/.phi-allow"
cn "phi-guard nudge: a * line in .phi-allow (edge blanks, CRLF) → silent" silent "$CR" "$CR/hooks/canary.sh"
printf '# a * in a comment is not the switch\n(395) 555-0142\n' > "$PJ/.phi-allow"
cn "phi-guard nudge: .phi-allow without a * line → still one line" line "$CR" "$CR/hooks/canary.sh"
rm -f "$PJ/.phi-allow"
mkdir -p "$CC/plugins/cache/bluestep/phi-guard/0.1.0"
cn "phi-guard nudge: sibling phi-guard in the cache → silent" silent "$CR" "$CR/hooks/canary.sh"
rm -rf "$CC/plugins/cache/bluestep/phi-guard"
cn "phi-guard nudge: a checkout root (dev install) → silent" silent "$ROOT/plugins/bluestep-tools" "$H/canary.sh"
rm -f "$PJ/scripts/hooks/phi-check.sh"
cn "phi-guard nudge: no git check in the project → silent" silent "$CR" "$CR/hooks/canary.sh"
rm -rf "$CC" "$PJ"

echo
echo "passed=$pass failed=$fail"
[ "$fail" = 0 ]
