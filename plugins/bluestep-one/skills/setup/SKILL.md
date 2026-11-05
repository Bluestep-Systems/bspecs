---
name: setup
description: "Set up or check a BlueStep One component workspace on Claude Code — checks the machine (bluestep-tools and its platform token, Node 20+, git access to the BlueStep One git host, the Claude desktop app's built-in browser pane and a sign-in on the BlueStep One host), then writes what the folder lacks: .claude/bluestep-one.json (the BlueStep One host and git host, the components, the test-data prefix), AGENTS.md, the CLAUDE.md bridge and .claude/settings.json. Asks only for BlueStep One values. Never overwrites a file. Use in a new component workspace, when /bluestep-one:build says to run setup first, or after a plugin update. --check reports and writes nothing. Usage: /bluestep-one:setup [--check]."
---

# /bluestep-one:setup — this machine and this folder, ready to build components

**Decide what you can, ask only what is the user's.** A missing file that conflicts with nothing is
written and reported. A key that already holds a different value is asked about, never changed
silently. Something only a person can do (install a program, type a credential, ask for access) is
handed over as the exact command or click, and the run goes on with everything else. Never ask for
a credential in chat and never write one into a file. Never commit and never stage. Never overwrite
an existing file.

`--check` runs step 1 and reports what step 2 would write, writing nothing.

## Step 1 — the machine

Each check is read-only. Report each as ok / missing, with the fix for each missing one.

1. **bluestep-tools.** Its skills are in this session (`b6p-setup`, `bluestep-reference`). This
   plugin declares it as a dependency, so it is normally installed with it; if it is missing or
   fails to load, name the install line from this plugin's README and stop: the build's GraphQL
   reference and the platform token come from it.
2. **The platform token.** `test -n "$B6PT_TOKEN" && echo OK`. Missing: point to bluestep-tools'
   `/b6p-setup`, which sets it up; the build itself runs from a signed-in browser tab, so a missing
   token is reported, not a stop.
3. **Node 20+.** `node --version`. The plugin's tools run on Node.
4. **The Claude desktop app's built-in browser pane.** The `mcp__Claude_Browser__*` tools are in
   the session. Building, publishing and every check after the push (gates 5 to 9 of
   `/bluestep-one:build`) run in a tab of that pane. Missing (the CLI or an IDE): say in plain
   words that those gates need the desktop app, and that without it the user presses *Rebuild
   draft* and *Publish* in BlueStep One's *Build* tab themselves.
5. **A sign-in on the BlueStep One host.** Once `one.host` is known (step 2), open
   `https://<one.host>/` in the pane yourself and ask the user to sign in on the page that shows,
   with no host in the ask: "Please sign in on the page I opened in the app's browser, so I can
   build and publish your components." Wait for their word.
6. **Git access to the component repos** on `one.gitHost`, when the config names a component:
   `GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never git ls-remote https://<one.gitHost>/git/component/<name>.git`
   (a component's `origin` in its checkout gives the same URL). The two variables make git fail at
   once when no login is saved for that host, instead of opening a login window that hangs the
   run. "could not read Username" means no login yet: hand over `git ls-remote <url>` for the user
   to run in their own terminal, where git asks for their BlueStep login on `one.gitHost` (a
   `b6pt_` token also works as the password) and saves it for later clones and pushes. Then run
   the check again. A 403, or a 404 on a component that exists, means that login cannot read the
   component: the user asks whoever administers the org for access. With no component in the
   config yet, say the login window comes up at the first clone.

## Step 2 — the folder

1. **`.claude/bluestep-one.json`.** Missing: ask only for what is the user's:
   - the BlueStep One host the components are served from, and the git host of the component
     repos (often the same host);
   - the components this folder builds: id (`<n>___<n>`, as the *Build* panel's list shows it),
     name and repo path relative to this folder. None yet is fine (`[]`);
     `/bluestep-one:build --clone` sets up the first one;
   - the test-data prefix, written out in full (for example `ZZ Test` and the user's initials):
     the live check runs only on test records whose names start with it.
   Then write `{ "one": { "host", "gitHost" }, "components": [...], "testPrefix": "..." }` and
   validate it against `${CLAUDE_PLUGIN_ROOT}/config/bluestep-one.schema.json`. Leave `uxCheck`
   out: the UX check takes its thresholds from `${CLAUDE_PLUGIN_ROOT}/config/defaults.json`, and a
   project adds `uxCheck` only to change one, with the reason.
   Present: validate it. A missing required key is asked for; a key that holds a value is left
   alone; a schema error is named with its key and fixed only on the user's yes.
2. **`AGENTS.md`.** Missing: write it from `${CLAUDE_PLUGIN_ROOT}/skills/setup/templates/AGENTS.md.template`,
   with `{{PROJECT_NAME}}` as the folder name. Present: never overwritten; if it does not name
   `/bluestep-one:build`, offer to add the template's *Rule sets* paragraph at its top, and add it
   only on a yes.
3. **The bridge file, on Claude Code.** On Claude Code, `CLAUDE.md` missing: write it from
   `${CLAUDE_PLUGIN_ROOT}/skills/setup/templates/CLAUDE.md.template`. On Claude Code, a `CLAUDE.md`
   that holds more than the bridge is left as it is and named; moving its rules into `AGENTS.md`
   is the user's call.
4. **Project settings, on Claude Code.** On Claude Code, `.claude/settings.json` missing: write
   ```json
   {
     "permissions": {
       "allow": ["Bash(node:*)", "Bash(git:*)", "mcp__Claude_Browser"],
       "deny": ["Edit(types/**)", "Bash(b6p push:*)"]
     },
     "extraKnownMarketplaces": {
       "bluestep": { "source": { "source": "github", "repo": "Bluestep-Systems/bluestep-ai" } }
     }
   }
   ```
   On Claude Code, a present settings file gets only the missing `allow` and `deny` entries added;
   any key that holds a different value is asked about. The two denies are always added: `types/`
   is downloaded by `fetch-types.mjs` and never edited, and a component is never pushed with `b6p`
   (it builds from its own git). The browser tools are allowed because the plugin's tab guard
   already puts every GraphQL mutation a script would send to the user.
5. **`git init`** if the folder is not in a repo, and say so.

## Step 3 — report

One table: each check (ok / missing, and the exact fix), each file (written / skipped / asked, and
why). Then: skills, hooks and the tab-guard mod load at session start, so anything just installed
needs a fresh session. Next step: `/bluestep-one:build <component> --clone` for a new component,
or `/bluestep-one:build <component>` for one already checked out. A second run reports nothing to
do.
