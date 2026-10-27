#!/bin/bash
# Test the bluestep-tools guardrail hooks.
# Uses python to build the JSON so backslash payloads survive the shell.
H="$(cd "$(dirname "${BASH_SOURCE[0]}")/../plugin/hooks" && pwd)"
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
# one-tools' Proceed ticket: a fresh file named by this call's tool_use_id stops the second ask.
# Each case points every temp variable at its own folder, so the machine's tickets never count.
jsid() { "$PY" -c 'import json,sys; print(json.dumps({"tool_name":"mcp__Claude_Browser__javascript_tool","tool_input":{"text":sys.argv[1]},"tool_use_id":sys.argv[2]}))' "$1" "$2"; }
TT=$(mktemp -d); mkdir -p "$TT/one-tools-tab-guard"
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
rm -rf "$TT"

echo "=== exec bits in the index ==="
# Claude Code runs the source scripts directly; an edit from Windows over a UNC path has reset
# a mode to 100644 before. core.fileMode may be off, so ask the index, not the filesystem.
for f in $(cd "$H/.." && git ls-files hooks | grep '\.sh$'); do
  mode=$(cd "$H/.." && git ls-files -s "$f" | cut -c1-6)
  if [ "$mode" = 100755 ]; then echo "  PASS  plugin/$f is 100755"; pass=$((pass+1));
  else echo "  FAIL  plugin/$f is $mode in the index — git update-index --chmod=+x"; fail=$((fail+1)); fi
done

echo "=== Cursor preToolUse wrapper (generated) ==="
# The wrapper is generated into dist/cursor by npm run gen; these cases pin its contract:
# tool-name filter, deny JSON, and fail-closed on everything it can see.
W="$H/../../dist/cursor/bluestep-tools/hooks/block-generated-files-cursor.sh"
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

echo
echo "passed=$pass failed=$fail"
[ "$fail" = 0 ]
