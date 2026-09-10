#!/bin/bash
# Test the bluestep-tools guardrail hooks.
# Uses python to build the JSON so backslash payloads survive the shell.
H="$(cd "$(dirname "${BASH_SOURCE[0]}")/../plugin/hooks" && pwd)"
pass=0; fail=0

j() { python -c 'import json,sys; print(json.dumps({"tool_input":{sys.argv[1]:sys.argv[2]}}))' "$1" "$2"; }

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
t "allows app.ts (backslashes)" block-generated-files.sh file_path 'C:\x\U129161\Comp\draft\scripts\app.ts' 0
t "allows README" block-generated-files.sh file_path '/x/draft/README.md' 0
t "allows a path with 'declarations' as a filename part" block-generated-files.sh file_path '/x/draft/scripts/declarations-helper.ts' 0

echo "=== block-tsc.sh ==="
t "blocks bare tsc" block-tsc.sh command 'tsc -p tsconfig.json' 2
t "blocks npx tsc" block-tsc.sh command 'cd /x && npx tsc --noEmit' 2
t "blocks tsc mid-command" block-tsc.sh command 'cd /x && tsc && echo done' 2
t "allows b6p push" block-tsc.sh command 'b6p push --file app.ts' 0
t "allows git status" block-tsc.sh command 'git status' 0
t "allows npm test" block-tsc.sh command 'npm test' 0

echo "=== fail closed ==="
out=$(printf '%s' 'not json at all' | bash "$H/block-generated-files.sh" 2>&1); rc=$?
if [ "$rc" = 2 ]; then echo "  PASS  unparseable input blocks"; pass=$((pass+1));
else echo "  FAIL  unparseable input gave exit $rc"; fail=$((fail+1)); fi

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

echo
echo "passed=$pass failed=$fail"
[ "$fail" = 0 ]
