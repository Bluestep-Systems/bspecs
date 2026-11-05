// Shared by the hooks. Reads the project's .claude/bluestep-one.json.
// loadConfig returns { status: "none" } when no project config is found (the hook then does
// nothing), { status: "ok", config, root } when it parsed, and { status: "error", error, root } when
// it exists but cannot be read or parsed (the tab guard then knows no own component and asks about
// every mutation). root is the project folder, the one holding .claude/.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

// The hook input from stdin; null when it cannot be read or parsed.
export function readInput() {
  try {
    const text = readFileSync(0, "utf8").replace(/^﻿/, "");
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

export function cwdOf(input) {
  return typeof input?.cwd === "string" && input.cwd ? input.cwd : process.cwd();
}

const CONFIG_FILE = "bluestep-one.json";

const hasConfig = (dir) => existsSync(join(dir, ".claude", CONFIG_FILE));

// The project folder: the nearest folder at or above cwd that holds .claude/bluestep-one.json, as git
// finds its repo, so a session that moved into a subfolder keeps its project. The home folder is not
// a project (its .claude/ is the user's own). Failing that, CLAUDE_PROJECT_DIR, the folder the
// session started in, for a session working in an added folder outside the project. null if none.
export function findRoot(cwd) {
  const home = resolve(homedir());
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (dir !== home && hasConfig(dir)) return dir;
    if (dirname(dir) === dir) break;
  }
  const project = process.env.CLAUDE_PROJECT_DIR;
  return project && hasConfig(resolve(project)) ? resolve(project) : null;
}

export function loadConfig(cwd) {
  const root = findRoot(cwd);
  if (!root) return { status: "none" };
  try {
    const config = JSON.parse(readFileSync(join(root, ".claude", CONFIG_FILE), "utf8").replace(/^﻿/, ""));
    if (config === null || typeof config !== "object" || Array.isArray(config)) {
      return { status: "error", error: "the file is not a JSON object", root };
    }
    return { status: "ok", config, root };
  } catch (error) {
    return { status: "error", error: error?.message ?? String(error), root };
  }
}
