// What a browser script does with GraphQL, read from its text. Shared by the settings hook
// tab-guard.mjs and the tab-guard mod (hooks/register.tsx), so both judge a script the same way.
// Plain JavaScript with no Node imports: the mod's environment has none.

// The ticket the mod leaves when the user presses Proceed on its card, so the settings hooks do
// not ask a second time: a file in the system temp folder, under this folder, named by the call's
// tool_use_id, holding ticketText of the call. The hook asks whenever it is missing, stale or for
// another script, and sweeps stale ones; it never deletes a fresh one, because bluestep-tools' own
// tab guard (hooks/tab-guard.sh) runs in parallel and goes on only when it finds a fresh ticket by
// this name. Keep the folder, the name and the age in step with that hook.
export const TICKET_FOLDER = "bluestep-one-tab-guard";
export const TICKET_MAX_AGE_MS = 2 * 60 * 1000;

export function ticketText(toolName, scripts) {
  return JSON.stringify({ tool: toolName, scripts });
}

export const MUTATION = /\bmutation\b(?:\s+[A-Za-z_]\w*)?\s*[({]/g;

// The text after the keyword, as it would sit inside a JS string: quotes may be escaped. The
// selection is optional and may hold one nested level, an inline fragment included
// (`... on CustomComponentInterface { publishedSha }`), but no arguments, so no second field.
export const OWN_BUILD_OR_PUBLISH =
  /^mutation(?:\s+[A-Za-z_]\w*)?\s*\{\s*(?:buildCustomComponent|publishCustomComponent)\s*\(\s*id\s*:\s*\\?"(\w+)\\?"\s*\)\s*(?:\{(?:[\s\w,.]|\{[\s\w,.]*\})*\})?\s*\}/;

// The scripts a call runs: javascript_tool's text, or each javascript_tool item of a browser_batch.
export function scriptsOf(toolName, toolInput) {
  if (/__javascript_tool$/.test(toolName)) return [String(toolInput?.text ?? "")];
  if (/__browser_batch$/.test(toolName)) {
    const actions = Array.isArray(toolInput?.actions) ? toolInput.actions : [];
    return actions
      .filter((a) => /(^|__)javascript_tool$/.test(String(a?.name ?? "")))
      .map((a) => String(a?.input?.text ?? ""));
  }
  return [];
}

// "none" (no mutation), "own" (only builds or publishes of our own components), or "other".
export function classify(script, ownComponents) {
  const starts = [...script.matchAll(MUTATION)].map((m) => m.index);
  if (starts.length === 0) return "none";
  for (const at of starts) {
    const match = OWN_BUILD_OR_PUBLISH.exec(script.slice(at));
    if (!match || !ownComponents.has(match[1])) return "other";
  }
  return "own";
}

// The builds and publishes a script runs, in order, as { action: "build" | "publish", id }: each
// mutation OWN_BUILD_OR_PUBLISH reads, whoever owns the id.
export function buildsAndPublishes(script) {
  const found = [];
  for (const m of script.matchAll(MUTATION)) {
    const match = OWN_BUILD_OR_PUBLISH.exec(script.slice(m.index));
    if (match) found.push({ action: /^[^(]*publishCustomComponent/.test(match[0]) ? "publish" : "build", id: match[1] });
  }
  return found;
}

// Each mutation's text, from its keyword to the brace that closes its selection (or `max`
// characters), with escaped quotes and newlines put back, for a person to read.
export function mutationTexts(script, max = 600) {
  const texts = [];
  for (const m of script.matchAll(MUTATION)) {
    const from = m.index;
    let depth = 0;
    let end = Math.min(script.length, from + max);
    for (let i = from; i < script.length && i < from + max; i++) {
      const c = script[i];
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        end = i + 1;
        break;
      }
    }
    const cut = end - from >= max && depth !== 0;
    texts.push(
      script
        .slice(from, end)
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\s+\n/g, "\n") + (cut ? " …" : "")
    );
  }
  return texts;
}

// The text from the brace at `open` to the brace that closes it (or `max` characters, then " …"),
// skipping braces inside quoted strings.
function balanced(script, open, max) {
  let depth = 0;
  let quote = null;
  const stop = Math.min(script.length, open + max);
  for (let i = open; i < stop; i++) {
    const c = script[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return script.slice(open, i + 1);
  }
  return script.slice(open, stop) + " …";
}

// The variables a script sends with its query, as written in it: `variables: { ... }`,
// `const variables = { ... }`, or `variables: name` with `const name = { ... }` in the script. An
// empty object is left out. Values built at run time are not seen.
export function variableTexts(script, max = 600) {
  const texts = [];
  const add = (open) => {
    const text = balanced(script, open, max);
    if (!/^\{\s*\}$/.test(text) && !texts.includes(text)) texts.push(text);
  };
  for (const m of script.matchAll(/\bvariables\s*[:=]\s*(\{|[A-Za-z_$][\w$]*)/g)) {
    if (m[1] === "{") add(m.index + m[0].length - 1);
    else if (m[1] !== "variables") {
      const decl = new RegExp(`\\b(?:const|let|var)\\s+${m[1]}\\s*=\\s*\\{`).exec(script);
      if (decl) add(decl.index + decl[0].length - 1);
    }
  }
  return texts;
}

// What the script says it does, in Claude's words: its first comment before any code
// (`// Saves three test rows on the test record`, the gql-in-a-tab reference asks for it), cut to `max`
// characters. undefined when the script opens with code.
export function summaryOf(script, max = 200) {
  for (const raw of script.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    const m = /^(?:\/\/+|\/\*+)\s*(.*?)\s*(?:\*+\/)?$/.exec(line);
    if (!m || m[1] === "") return undefined;
    return m[1].length > max ? m[1].slice(0, max - 2) + " …" : m[1];
  }
  return undefined;
}

// The system notification the mod raises itself where $.ui.notify has no channel (the desktop app
// has no terminal to write one to). A node program, run as `node -e NOTIFIER`, that reads
// { title, text, tag, link, remove } as JSON on stdin: on Windows a toast that stays until
// dismissed, tagged so the mod can take it back once the card is answered (remove: true), and
// opening `link` when clicked (the desktop app's claude://code/continue?session=local_… link to the
// session holding the card); on macOS osascript, elsewhere notify-send, with no link, where nothing
// is taken back. BLUESTEP_ONE_NOTIFY_DRY=1 prints the
// command instead of running it, for the tests.
export const NOTIFIER = String.raw`
const { spawnSync } = require("node:child_process");
const input = JSON.parse(require("node:fs").readFileSync(0, "utf8") || "{}");
const title = String(input.title ?? ""), text = String(input.text ?? "");
const tag = String(input.tag ?? "").replace(/[^\w-]/g, "").slice(-60);
const link = /^claude:\/\/code\/continue\?session=local_[A-Za-z0-9-]{1,64}$/.test(String(input.link ?? "")) ? input.link : "";
const xml = (s) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
const quoted = (s) => "'" + s.replace(/'/g, "''") + "'";
let argv;
if (process.platform === "win32") {
  const lines = [
    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null",
    "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null",
    "$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'",
  ];
  if (input.remove) {
    lines.push("[Windows.UI.Notifications.ToastNotificationManager]::History.Remove(" + quoted(tag) + ", 'tab-guard', $app)");
  } else {
    // A click on the toast or its button opens the link: the session holding the card.
    const open = link ? ' activationType="protocol" launch="' + xml(link) + '"' : "";
    const button = link
      ? '<action content="Open session" activationType="protocol" arguments="' + xml(link) + '"/>'
      : '<action content="OK" arguments="ok" activationType="foreground"/>';
    const toast = '<toast scenario="reminder"' + open + '><visual><binding template="ToastGeneric"><text>' + xml(title) + "</text><text>" + xml(text) +
      "</text></binding></visual><actions>" + button + "</actions></toast>";
    lines.push(
      "$x = New-Object Windows.Data.Xml.Dom.XmlDocument",
      "$x.LoadXml(" + quoted(toast) + ")",
      "$t = [Windows.UI.Notifications.ToastNotification]::new($x)",
      "$t.Tag = " + quoted(tag) + "; $t.Group = 'tab-guard'",
      "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show($t)"
    );
  }
  argv = ["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(lines.join("\n"), "utf16le").toString("base64")];
} else if (input.remove) {
  argv = [];
} else if (process.platform === "darwin") {
  argv = ["osascript", "-e", "on run argv", "-e", "display notification (item 2 of argv) with title (item 1 of argv)", "-e", "end run", title, text];
} else {
  argv = ["notify-send", title, text];
}
if (process.env.BLUESTEP_ONE_NOTIFY_DRY) {
  console.log(JSON.stringify(argv));
  process.exit(0);
}
process.exit(argv.length === 0 ? 0 : spawnSync(argv[0], argv.slice(1), { stdio: "ignore", timeout: 20000 }).status ?? 1);
`;

// Origins a script names outright in a fetch (`fetch("https://host/gql")`). A relative `/gql` is
// the tab's own origin and is not listed.
export function fetchOrigins(script) {
  const origins = new Set();
  for (const m of script.matchAll(/\bfetch\s*\(\s*[`'"](https?:\/\/[^/`'"\s]+)/g)) origins.add(m[1].toLowerCase());
  return [...origins];
}
