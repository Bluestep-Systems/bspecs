#!/bin/bash
# Block CSS/HTML dumps into scripts/app.ts when the component has a static/ bundle.
# Enforces: the separate-files convention (rule 6 in the scaffolded CLAUDE.md);
# see the bluestep-reference skill's conventions/separate-files.md.
# User-approved exception: a `b6p:allow-inline-frontend` marker comment in app.ts.

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Normalize Windows-style paths so the checks below work from either side.
FILE=${FILE//\\//}
FILE=$(echo "$FILE" | sed -E 's#^//wsl\.localhost/[^/]+##')

# Only guard scripts/app.ts.
case "$FILE" in
  */scripts/app.ts) ;;
  *) exit 0 ;;
esac

# Only when a sibling static/ folder exists — components without one
# legitimately inline their frontend content.
COMPONENT_DIR=$(dirname "$(dirname "$FILE")")
[ -d "$COMPONENT_DIR/static" ] || exit 0

CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // empty')

# Frontend content in the incoming text?
echo "$CONTENT" | grep -qiE '<style[[:space:]>]|<link[[:space:]]|<script[[:space:]]+src' || exit 0

# User-approved override marker, in the incoming text or already in the file.
if echo "$CONTENT" | grep -q 'b6p:allow-inline-frontend' \
   || { [ -f "$FILE" ] && grep -q 'b6p:allow-inline-frontend' "$FILE"; }; then
  exit 0
fi

echo "BLOCKED: this write puts frontend content (<style>/<link>/<script src>) into '$FILE', but the component has a static/ folder. Route it to the dedicated files instead: CSS -> static/styles.css, markup -> static/index.html, client JS -> static/script.ts (see the bluestep-reference skill's conventions/separate-files.md). ONLY if the USER has explicitly approved inline frontend content for this component, add a comment near the top of app.ts -- // b6p:allow-inline-frontend -- <reason> -- and retry." >&2
exit 2
