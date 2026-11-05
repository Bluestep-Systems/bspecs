// PreToolUse on the browser script tools (the desktop app's built-in browser pane and Claude in
// Chrome: javascript_tool, and browser_batch items that run one). Since release 26.10.21.02 the
// gateway has no GraphQL tools, so GraphQL goes to /gql from a signed-in tab, and this hook guards
// the mutations a tab would send:
// - a script that holds no GraphQL mutation goes on as usual (reads, DOM checks);
// - a lone buildCustomComponent(id) or publishCustomComponent(id) with an id from components[] in
//   .claude/bluestep-one.json, written in the script (not passed as a variable), goes on to the
//   normal permission prompt;
// - any other mutation is put to the user ("ask"), in plain words: a tab may be signed in to any org,
//   and the hook cannot see which, so only the user can tell a test save on a test org from a write
//   to a real one.
// The check reads the script's text, so a mutation built at run time is not seen: it is a safety
// net, not a wall. Does nothing outside a project (lib/config.mjs finds it). A config that cannot be
// read is not a refusal here: it leaves no own component, so every mutation is asked. The script
// reading is in lib/tab-script.mjs, shared with the tab-guard mod (register.tsx): with mods on, the
// mod holds the call first and shows a fuller card. When the user presses Proceed there, the mod
// leaves a ticket for this exact call and this hook does not ask again. No ticket (mods off, no card, a failed mod) and this hook asks as it always did, so a
// script that changes data is never run unasked. bluestep-tools has its own tab guard
// (hooks/tab-guard.sh) that runs beside this one, in parallel, and reads the same ticket, so this
// hook leaves a ticket where it is: the sweep removes it once it is stale.
import { readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cwdOf, loadConfig, readInput } from "./lib/config.mjs";
import { TICKET_FOLDER, TICKET_MAX_AGE_MS, classify, scriptsOf, ticketText } from "./lib/tab-script.mjs";

// Whether the mod left a fresh ticket for this exact call. Leaves it for bluestep-tools' guard (a
// tool_use_id names one call, so a ticket cannot be spent twice) and sweeps the stale ones.
function hasTicket(input, scripts) {
  const folder = join(tmpdir(), TICKET_FOLDER);
  const id = String(input.tool_use_id ?? "");
  let isValid = false;
  if (/^[\w-]+$/.test(id)) {
    const file = join(folder, id);
    try {
      const isFresh = Date.now() - statSync(file).mtimeMs <= TICKET_MAX_AGE_MS;
      isValid = isFresh && readFileSync(file, "utf8") === ticketText(String(input.tool_name ?? ""), scripts);
    } catch {
      // no ticket
    }
  }
  try {
    for (const name of readdirSync(folder)) {
      const file = join(folder, name);
      if (Date.now() - statSync(file).mtimeMs > TICKET_MAX_AGE_MS) rmSync(file, { force: true });
    }
  } catch {
    // no folder
  }
  return isValid;
}

function ask(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: reason,
      },
    })
  );
}

try {
  const input = readInput();
  const loaded = loadConfig(cwdOf(input));
  if (loaded.status !== "none" && input) {
    const config = loaded.status === "ok" ? loaded.config : {};
    const own = new Set(
      (Array.isArray(config.components) ? config.components : []).map((c) => String(c?.id ?? "")).filter(Boolean)
    );
    const scripts = scriptsOf(String(input.tool_name ?? ""), input.tool_input);
    const verdicts = scripts.map((s) => classify(s, own));
    if (verdicts.includes("other") && !hasTicket(input, scripts)) {
      // Short on purpose: the app's card shows about two lines of it. No org or record names: the
      // user need not know them. The mod's card title is this text's first sentence (ASK_TEXT in
      // register.tsx): keep them alike.
      ask(
        "This script would change data in BlueStep. Allow it only if you want Claude to make this change."
      );
    }
  }
} catch {
  // a fault in this hook never blocks the browser
}
process.exit(0);
