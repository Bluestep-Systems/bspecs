// Every SKILL.md's frontmatter must parse as YAML, or Claude Code drops the skill from the list it
// offers the model (an unquoted "Usage: …" in a description is enough to drop it).
// No YAML parser ships here, so this checks the one shape the skills use: each frontmatter line is
// `key: value`, and a value that holds ": " or " #", or starts with a YAML indicator, is a
// double-quoted string that parses as JSON.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// The plugin lives in plugins/<name>/ of its repo; the repo's own skills are in
// <repo>/.claude/skills. An installed copy has no such folder there, and it is skipped.
const REPO = join(ROOT, "..", "..");

function skillFiles() {
  const out = [];
  const bases = [join(ROOT, "skills"), join(ROOT, ".claude", "skills"), join(REPO, ".claude", "skills")];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      const f = join(base, name, "SKILL.md");
      if (existsSync(f)) out.push(f);
    }
  }
  return out;
}

function frontmatter(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  assert.equal(lines[0], "---", "the file starts with ---");
  const end = lines.indexOf("---", 1);
  assert.ok(end > 0, "the frontmatter is closed by ---");
  return lines.slice(1, end);
}

const INDICATOR = /^[-?:,\[\]{}#&*!|>'"%@`]/;

test("every skill's frontmatter is plain key: value YAML that parses", () => {
  const files = skillFiles();
  assert.ok(files.length > 0);
  for (const f of files) {
    const lines = frontmatter(readFileSync(f, "utf8"));
    const keys = new Set();
    for (const line of lines) {
      const m = /^([a-z][a-z0-9-]*): (.*)$/.exec(line);
      assert.ok(m, `${f}: not a key: value line: ${line.slice(0, 60)}`);
      const [, key, value] = m;
      keys.add(key);
      if (value.startsWith('"')) {
        assert.doesNotThrow(() => JSON.parse(value), `${f}: ${key} is not a valid quoted string`);
      } else {
        assert.ok(
          !value.includes(": ") && !value.includes(" #") && !INDICATOR.test(value),
          `${f}: ${key} needs double quotes (it holds ": ", " #" or starts with an indicator)`
        );
      }
    }
    assert.ok(keys.has("name") && keys.has("description"), `${f}: name and description`);
  }
});
